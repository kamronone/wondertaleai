#!/usr/bin/env python3
"""Make explicitly draft, offline eSpeak narration for public classic scripts.

Only Russian and English are supported by this helper. Uzbek must come
from a genuinely Uzbek voice or reviewed recording, never a substitute.
The result is not a release-ready voice track.
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOICES = {"ru": "ru+f2", "en": "en-us+f2"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--story", required=True, choices=("cinderella", "rapunzel", "snow-white"))
    parser.add_argument("--language", action="append", choices=tuple(VOICES), required=True)
    args = parser.parse_args()
    if len(set(args.language)) != len(args.language):
        parser.error("Duplicate language")
    for executable in ("espeak", "ffmpeg", "ffprobe"):
        if shutil.which(executable) is None:
            parser.error(f"Required local executable: {executable}")
    source = json.loads((ROOT / "scripts/film-sources" / f"{args.story}.json").read_text(encoding="utf-8"))
    if source.get("storyId") != args.story or len(source.get("scenes", [])) != 8:
        parser.error("Invalid classic source")
    clips = []
    for page, scene in enumerate(source["scenes"], 1):
        if scene.get("page") != page:
            parser.error("Invalid page order")
        for language in args.language:
            text = scene.get("narration", {}).get(language)
            if not isinstance(text, str) or not 10 <= len(text.strip()) <= 500:
                parser.error("Invalid narration text")
            clips.append((language, page, text))
    installed = subprocess.check_output(["espeak", "--voices"], text=True)
    codes = {line.split()[1] for line in installed.splitlines()[1:] if len(line.split()) > 1}
    if any(VOICES[language].split("+")[0] not in codes for language in args.language):
        parser.error("Required matching local voice is missing")
    target = ROOT / "cartoon-build" / args.story / "draft-local-audio"
    if target.exists():
        parser.error("Draft audio directory already exists; keep or move the earlier result")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Finish all clips before publishing the directory locally. Never write to public.
    with tempfile.TemporaryDirectory(prefix="draft-voice-", dir=target.parent) as temp:
        work = Path(temp)
        ready = work / "ready"
        ready.mkdir()
        for language, page, text in clips:
            wav = work / f"{language}-{page}.wav"
            mp3 = ready / f"{language}-{page}.mp3"
            subprocess.run(["espeak", "-v", VOICES[language], "-s", "145", "-p", "46",
                            "-w", str(wav), "--stdin"], input=text.encode("utf-8"), check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ar", "48000",
                            "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", str(mp3)], check=True)
            seconds = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(mp3)], text=True))
            if not 0.2 <= seconds <= 120:
                raise ValueError("Invalid draft audio duration")
        (ready / "DRAFT.txt").write_text(
            "Synthetic offline eSpeak; pronunciation and quality require listening review. "
            "No Uzbek audio produced. Not approved for release.\n", encoding="utf-8")
        ready.rename(target)
    print(f"Created {len(clips)} draft clips: {target}")


if __name__ == "__main__":
    main()
