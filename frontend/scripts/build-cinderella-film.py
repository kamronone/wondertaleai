#!/usr/bin/env python3
"""Build narrated Cinderella picture films locally with FFmpeg and edge-tts."""
import argparse
import asyncio
import json
import math
import subprocess
import tempfile
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = {"cinderella": {5: "cinderella-walking"}, "red-hood": {1: "red-hood-walk-wave"}, "three-pigs": {4: "three-pigs-building", 7: "three-pigs-wolf"}}
VOICES = {"ru": "ru-RU-SvetlanaNeural", "uz": "uz-UZ-MadinaNeural", "en": "en-US-JennyNeural"}

def run(*args):
    return subprocess.check_output(args, text=True).strip()

def stamp(seconds):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02}.{ms:03}"

FPS = 25
SCENE_PAUSE = 0.8


def shared_scene_timeline(durations):
    """All language versions use the same frame-exact scene boundaries."""
    if set(durations) != set(VOICES) or any(len(values) != 8 for values in durations.values()):
        raise ValueError("Expected eight narration durations in all three languages")
    if any(not math.isfinite(value) or not 0.2 <= value <= 120
           for values in durations.values() for value in values):
        raise ValueError("Invalid narration duration")
    return [math.ceil((max(durations[lang][i] for lang in VOICES) + SCENE_PAUSE) * FPS)
            for i in range(8)]


def audio_duration(path):
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", str(path)))


def validate_source(story, source, public_dir, audio_dir=None):
    """Validate all inputs before any TTS, FFmpeg or output writes."""
    if (not isinstance(source, dict) or source.get("storyId") != story
            or source.get("languages") != list(VOICES)
            or not isinstance(source.get("scenes"), list)
            or len(source["scenes"]) != 8):
        raise ValueError("Invalid film source")
    missing = []
    for i, scene in enumerate(source["scenes"], 1):
        expected = f"/images/classics/{story}/pages/page-{i}.png"
        if (not isinstance(scene, dict) or type(scene.get("page")) is not int
                or scene["page"] != i or scene.get("image") != expected
                or not isinstance(scene.get("narration"), dict)
                or set(scene["narration"]) != set(VOICES)
                or any(not isinstance(text, str) or not 10 <= len(text.strip()) <= 500
                       or "\n" in text or "\r" in text
                       for text in scene["narration"].values())):
            raise ValueError(f"Invalid film scene {i}")
        image = public_dir / expected.lstrip("/")
        if not image.is_file():
            missing.append(expected)
        else:
            with image.open("rb") as file:
                if file.read(8) != b"\x89PNG\r\n\x1a\n":
                    raise ValueError(f"Invalid PNG: {expected}")
        if audio_dir is not None:
            for lang in VOICES:
                clip = audio_dir / f"{lang}-{i}.mp3"
                if not clip.is_file() or clip.stat().st_size == 0:
                    missing.append(f"audio/{lang}-{i}.mp3")
    return missing


async def main():
    parser = argparse.ArgumentParser(description="Render a classic picture film")
    parser.add_argument("--check", action="store_true", help="Validate assets only; no TTS, FFmpeg or output")
    parser.add_argument("--audio-dir", type=Path, help="Use existing local ru-N.mp3, uz-N.mp3, en-N.mp3; no external TTS")
    parser.add_argument("--allow-network-tts", action="store_true", help="Explicitly permit external TTS for public classic narration")
    parser.add_argument("--static", action="store_true", help="Disable camera motion and fades")
    parser.add_argument("--story", choices=["cinderella", "snow-white", "rapunzel"], default="cinderella")
    parser.add_argument("--music", type=Path, help="Local background audio with cleared usage rights")
    parser.add_argument("--music-volume", type=float, default=0.10)
    parser.add_argument("--effects-dir", type=Path, help="Directory containing licensed scene effects named page-N.wav")
    parser.add_argument("--effects-volume", type=float, default=0.12)
    args = parser.parse_args()
    if not 0 <= args.effects_volume <= 0.25:
        parser.error("--effects-volume must be between 0 and 0.25")
    if args.effects_dir and not args.effects_dir.is_dir():
        parser.error("--effects-dir must be an existing directory")
    if not 0 <= args.music_volume <= 0.25:
        parser.error("--music-volume must be between 0 and 0.25")
    if args.music and not args.music.is_file():
        parser.error("--music must point to an existing audio file")
    source_path = ROOT / "scripts/film-sources" / f"{args.story}.json"
    if args.audio_dir is not None and not args.audio_dir.is_dir():
        parser.error("--audio-dir must be an existing directory")
    if args.audio_dir and args.allow_network_tts:
        parser.error("Choose local audio or external TTS, not both")
    source = json.loads(source_path.read_text(encoding="utf-8"))
    missing = validate_source(args.story, source, ROOT / "public", args.audio_dir)
    if missing:
        parser.error("Missing film inputs: " + ", ".join(missing))
    scenes = source["scenes"]
    if args.check:
        print(f"Source ready: {args.story}, {len(scenes)} scenes, {len(VOICES)} languages; no media generated")
        return
    if not args.audio_dir and not args.allow_network_tts:
        parser.error("Provide --audio-dir or explicitly allow --allow-network-tts")
    if not args.audio_dir:
        try:
            import edge_tts
        except ImportError:
            sys.exit("Install narration dependency: python -m pip install edge-tts==7.2.7")
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Required executable missing: {tool}")
    # Probe all provided clips before rendering any scenes.
    if args.audio_dir:
        for lang in VOICES:
            for scene in scenes:
                clip = args.audio_dir / f"{lang}-{scene['page']}.mp3"
                seconds = float(run("ffprobe", "-v", "error", "-select_streams", "a:0",
                    "-show_entries", "stream=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(clip)))
                if not math.isfinite(seconds) or not 0.2 <= seconds <= 120:
                    parser.error(f"Invalid audio duration: {clip.name}")
    out = ROOT / "cartoon-build" / args.story
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        # Obtain and measure every narration clip before any video render.
        durations = {lang: [] for lang in VOICES}
        for lang, voice in VOICES.items():
            for scene in scenes:
                i = scene["page"]
                audio = work / f"{lang}-{i}.mp3"
                spoken = scene["narration"][lang]
                if lang == "uz":
                    spoken = spoken.translate(str.maketrans({"ş":"sh","Ş":"Sh","ç":"ch","Ç":"Ch","ö":"oʻ","Ö":"Oʻ","ğ":"gʻ","Ğ":"Gʻ"}))
                if args.audio_dir:
                    shutil.copyfile(args.audio_dir / f"{lang}-{i}.mp3", audio)
                else:
                    await edge_tts.Communicate(spoken, voice, rate="-10%").save(str(audio))
                duration = audio_duration(audio)
                if not math.isfinite(duration) or not 0.2 <= duration <= 120:
                    raise ValueError("Invalid narration duration")
                durations[lang].append(duration)
        timeline = shared_scene_timeline(durations)
        expected_length = sum(timeline) / FPS
        for lang in VOICES:
            cues = ["WEBVTT", ""]
            segments = []
            offset_frames = 0
            for scene in scenes:
                i = scene["page"]
                audio = work / f"{lang}-{i}.mp3"
                segment = work / f"{lang}-{i}.mp4"
                narration = scene["narration"][lang]
                frames = timeline[i-1]
                scene_seconds = frames / FPS
                image = ROOT / "public" / scene["image"].lstrip("/")
                base = "scale=768:1024:force_original_aspect_ratio=decrease,pad=768:1024:(ow-iw)/2:(oh-ih)/2,setsar=1"
                if args.static:
                    camera = base + ",scale=384:512"
                else:
                    zoom = f"1+0.035*on/{frames}" if i % 2 else f"1.035-0.035*on/{frames}"
                    camera = base + f",zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=384x512:fps=25"
                    fade_start = max(0, scene_seconds - 0.25)
                    camera += f",fade=t=in:st=0:d=0.25,fade=t=out:st={fade_start}:d=0.25"
                animation_name = ANIMATIONS.get(args.story, {}).get(i)
                animation = ROOT / "public/images/classics" / args.story / "animations" / f"{animation_name}.gif" if animation_name else None
                visual_args = ["-loop", "1", "-framerate", "25", "-i", str(image)]
                if not args.static and animation and animation.is_file():
                    visual_args = ["-stream_loop", "-1", "-ignore_loop", "1", "-i", str(animation)]
                    camera = "fps=25," + base + ",scale=384:512" + f",fade=t=in:st=0:d=0.25,fade=t=out:st={fade_start}:d=0.25"
                effect = args.effects_dir / f"page-{i}.wav" if args.effects_dir else None
                audio_args = ["-map", "0:v:0", "-map", "1:a:0", "-af", "apad"]
                if effect and effect.is_file():
                    mix = (f"[1:a]aresample=48000,aformat=channel_layouts=mono,apad[voice];"
                           f"[2:a]aresample=48000,aformat=channel_layouts=mono,volume={args.effects_volume},adelay=250:all=1[fx];"
                           "[voice][fx]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:latency=1[mix]")
                    audio_args = ["-i", str(effect), "-filter_complex", mix, "-map", "0:v:0", "-map", "[mix]"]
                run("ffmpeg", "-y", "-v", "error", *visual_args, "-i", str(audio), *audio_args, "-vf", camera, "-t", str(scene_seconds), "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "1", str(segment))
                actual = audio_duration(segment)
                if not math.isfinite(actual) or abs(actual - scene_seconds) > 0.08:
                    raise ValueError("Rendered scene duration differs from common timeline")
                cues.extend([f"{stamp(offset_frames/FPS)} --> {stamp((offset_frames+frames)/FPS)}", narration, ""])
                offset_frames += frames
                segments.append(segment)
            manifest = work / f"{lang}.txt"
            manifest.write_text("".join(f"file '{p.name}'\n" for p in segments), encoding="utf-8")
            target = out / f"film-{lang}.mp4"
            joined = work / f"joined-{lang}.mp4"
            run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", "-movflags", "+faststart", str(joined))
            if args.music:
                length = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(joined)))
                fade = min(1.0, length / 2)
                mix = (
                    f"[1:a]aresample=48000,aformat=channel_layouts=mono,volume={args.music_volume},"
                    f"atrim=duration={length},afade=t=in:d={fade},"
                    f"afade=t=out:st={length-fade}:d={fade}[bg];"
                    "[0:a][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:latency=1[mix]"
                )
                run("ffmpeg", "-y", "-v", "error", "-i", str(joined), "-stream_loop", "-1", "-i", str(args.music.resolve()), "-filter_complex", mix, "-map", "0:v:0", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", str(target))
            else:
                shutil.copyfile(joined, target)
            actual_length = audio_duration(target)
            if not math.isfinite(actual_length) or abs(actual_length - expected_length) > 0.25:
                raise ValueError("Rendered film duration differs from common timeline")
            (out / f"{lang}.vtt").write_text("\n".join(cues), encoding="utf-8")
    print(f"Review generated films before publishing: {out}")

if __name__ == "__main__":
    asyncio.run(main())
