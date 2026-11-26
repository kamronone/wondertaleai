"""Render caption-timed narration into the bundled MP4 variants.

Run after render-three-pigs-film.sh with Python 3, eSpeak NG and FFmpeg.
The public story text stays local during synthesis.
"""
import os
import subprocess
import tempfile
import wave
from pathlib import Path


MEDIA = Path(__file__).resolve().parents[1] / "public" / "cartoons" / "three-pigs"
VOICES = {
    "ru": ("ru+f3", "rus"),
    "uz": ("uz+f3", "uzb"),
    "en": ("en-us+f3", "eng"),
}
UZBEK = str.maketrans({"Ç": "Ch", "ç": "ch", "Ş": "Sh", "ş": "sh", "Ğ": "Gʻ", "ğ": "gʻ", "Ö": "Oʻ", "ö": "oʻ"})


def milliseconds(stamp):
    minutes, seconds = stamp.split(":")
    whole, fraction = seconds.split(".")
    return (int(minutes) * 60 + int(whole)) * 1000 + int(fraction)


def read_cues(language):
    header, *blocks = (MEDIA / f"{language}.vtt").read_text(encoding="utf-8").strip().split("\n\n")
    if header != "WEBVTT":
        raise ValueError(f"Expected a WebVTT file for {language}")
    for block in blocks:
        timing, *lines = block.splitlines()
        start, end = map(milliseconds, timing.split(" --> "))
        text = " ".join(lines)
        if language == "uz":
            text = text.translate(UZBEK)
        yield start, end, text


def synthesize_cue(synthesizer, voice, text, output, available_ms):
    for speed in (151, 166, 181, 196, 211):
        subprocess.run(
            [synthesizer, "-v", voice, "-s", str(speed), "-p", "46", "-w", output, "--stdin"],
            input=text.encode(),
            check=True,
        )
        with wave.open(str(output), "rb") as sample:
            rate = sample.getframerate()
            if sample.getnchannels() != 1 or sample.getsampwidth() != 2:
                raise ValueError("Expected mono 16-bit PCM from eSpeak NG")
            length = sample.getnframes()
            if length * 1000 <= rate * available_ms:
                return rate, sample.readframes(length)
    raise ValueError(f"Cue exceeds its allotted time: {text}")


def render_narration(synthesizer, language, voice, directory):
    cues = list(read_cues(language))
    fragments = []
    rate = None
    previous_end = 0
    for start, end, text in cues:
        if start != previous_end or not text or end <= start + 300:
            raise ValueError(f"Invalid caption window in {language}: {start}–{end}")
        sample_rate, pcm = synthesize_cue(synthesizer, voice, text, directory / "cue.wav", end - start - 300)
        if rate is not None and sample_rate != rate:
            raise ValueError("Expected a consistent synthesizer sample rate")
        rate = sample_rate
        fragments.append((start, pcm))
        previous_end = end
    if rate is None:
        raise ValueError(f"No captions found for {language}")
    if previous_end != 80000:
        raise ValueError(f"Expected 80 seconds of captions, got {previous_end} ms")

    output = directory / f"{language}.wav"
    timeline = bytearray(previous_end * rate // 1000 * 2)
    for start, pcm in fragments:
        offset = (start + 150) * rate // 1000 * 2
        timeline[offset:offset + len(pcm)] = pcm
    with wave.open(str(output), "wb") as track:
        track.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        track.writeframes(timeline)
    return output


def main():
    synthesizer = os.environ.get("ESPEAK_NG", "espeak-ng")
    with tempfile.TemporaryDirectory(prefix="wondertale-narration-", dir=MEDIA) as work:
        directory = Path(work)
        results = []
        for language, (voice, audio_code) in VOICES.items():
            narration = render_narration(synthesizer, language, voice, directory)
            result = directory / f"film-{language}.mp4"
            subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-i", MEDIA / "film.mp4", "-i", narration,
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                    "-af", "highpass=f=90,lowpass=f=6800,loudnorm=I=-18:TP=-2:LRA=7",
                    "-c:a", "aac", "-ar", "24000", "-b:a", "56k",
                    "-metadata:s:a:0", f"language={audio_code}", "-movflags", "+faststart", result,
                ],
                check=True,
            )
            results.append(result)
        for result in results:
            result.replace(MEDIA / result.name)


if __name__ == "__main__":
    main()
