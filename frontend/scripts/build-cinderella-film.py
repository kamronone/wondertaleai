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

try:
    import edge_tts
except ImportError:
    sys.exit('Install narration dependency: python -m pip install edge-tts==7.2.7')

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

async def main():
    parser = argparse.ArgumentParser(description="Render a classic picture film")
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
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Required executable missing: {tool}")
    source = json.loads(source_path.read_text(encoding="utf-8"))
    scenes = source["scenes"]
    for scene in scenes:
        image = ROOT / "public" / scene["image"].lstrip("/")
        if not image.is_file():
            raise FileNotFoundError(image)
    out = ROOT / "cartoon-build" / args.story
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        for lang, voice in VOICES.items():
            cues = ["WEBVTT", ""]
            segments = []
            offset = 0.0
            for scene in scenes:
                i = scene["page"]
                audio = work / f"{lang}-{i}.mp3"
                segment = work / f"{lang}-{i}.mp4"
                narration = scene["narration"][lang]
                spoken = narration
                if lang == "uz":
                    spoken = spoken.translate(str.maketrans({"ş":"sh","Ş":"Sh","ç":"ch","Ç":"Ch","ö":"oʻ","Ö":"Oʻ","ğ":"gʻ","Ğ":"Gʻ"}))
                await edge_tts.Communicate(spoken, voice, rate="-10%").save(str(audio))
                duration = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio)))
                image = ROOT / "public" / scene["image"].lstrip("/")
                frames = max(1, math.ceil((duration + 0.8) * 25))
                base = "scale=768:1024:force_original_aspect_ratio=decrease,pad=768:1024:(ow-iw)/2:(oh-ih)/2,setsar=1"
                if args.static:
                    camera = base + ",scale=384:512"
                else:
                    zoom = f"1+0.035*on/{frames}" if i % 2 else f"1.035-0.035*on/{frames}"
                    camera = base + f",zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=384x512:fps=25"
                    fade_start = max(0, duration + 0.8 - 0.25)
                    camera += f",fade=t=in:st=0:d=0.25,fade=t=out:st={fade_start}:d=0.25"
                animation_name = ANIMATIONS.get(args.story, {}).get(i)
                animation = ROOT / "public/images/classics" / args.story / "animations" / f"{animation_name}.gif" if animation_name else None
                visual_args = ["-loop", "1", "-framerate", "25", "-i", str(image)]
                if not args.static and animation and animation.is_file():
                    visual_args = ["-stream_loop", "-1", "-ignore_loop", "1", "-i", str(animation)]
                    camera = "fps=25," + base + ",scale=384:512" + f",fade=t=in:st=0:d=0.25,fade=t=out:st={fade_start}:d=0.25"
                effect = args.effects_dir / f"page-{i}.wav" if args.effects_dir else None
                audio_args = ["-map", "0:v:0", "-map", "1:a:0", "-af", "apad=pad_dur=0.8"]
                if effect and effect.is_file():
                    mix = (f"[1:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=0.8[voice];"
                           f"[2:a]aresample=48000,aformat=channel_layouts=mono,volume={args.effects_volume},adelay=250:all=1[fx];"
                           "[voice][fx]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:latency=1[mix]")
                    audio_args = ["-i", str(effect), "-filter_complex", mix, "-map", "0:v:0", "-map", "[mix]"]
                run("ffmpeg", "-y", "-v", "error", *visual_args, "-i", str(audio), *audio_args, "-vf", camera, "-t", str(duration+0.8), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "1", str(segment))
                actual = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(segment)))
                cues.extend([f"{stamp(offset)} --> {stamp(offset+min(duration,actual))}", narration, ""])
                offset += actual
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
            (out / f"{lang}.vtt").write_text("\n".join(cues), encoding="utf-8")
    print(f"Review generated films before publishing: {out}")

if __name__ == "__main__":
    asyncio.run(main())
