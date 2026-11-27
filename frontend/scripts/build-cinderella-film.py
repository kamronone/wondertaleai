#!/usr/bin/env python3
"""Build narrated Cinderella picture films locally with FFmpeg and edge-tts."""
import asyncio
import json
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
SOURCE = ROOT / "scripts/film-sources/cinderella.json"
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
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Required executable missing: {tool}")
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    scenes = source["scenes"]
    for scene in scenes:
        image = ROOT / "public" / scene["image"].lstrip("/")
        if not image.is_file():
            raise FileNotFoundError(image)
    out = ROOT / "cartoon-build/cinderella"
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
                run("ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "25", "-i", str(image), "-i", str(audio), "-vf", "scale=384:512:force_original_aspect_ratio=decrease,pad=384:512:(ow-iw)/2:(oh-ih)/2,setsar=1", "-af", "apad=pad_dur=0.8", "-t", str(duration+0.8), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "1", str(segment))
                actual = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(segment)))
                cues.extend([f"{stamp(offset)} --> {stamp(offset+min(duration,actual))}", narration, ""])
                offset += actual
                segments.append(segment)
            manifest = work / f"{lang}.txt"
            manifest.write_text("".join(f"file '{p.name}'\n" for p in segments), encoding="utf-8")
            run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", "-movflags", "+faststart", str(out / f"film-{lang}.mp4"))
            (out / f"{lang}.vtt").write_text("\n".join(cues), encoding="utf-8")
    print(f"Review generated films before publishing: {out}")

if __name__ == "__main__":
    asyncio.run(main())
