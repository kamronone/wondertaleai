# Classic picture-film preparation

The three draft scripts are original short retellings in Russian, Uzbek and English. They are not published films. Each script has eight ordered scenes.

Run the preflight (Python standard library only):

```sh
python scripts/build-cinderella-film.py --story cinderella --check
python scripts/build-cinderella-film.py --story rapunzel --check
python scripts/build-cinderella-film.py --story snow-white --check
```

From the frontend directory, supply 24 locally recorded or licensed narration MP3s in `cartoon-audio/cinderella/`, named `ru-1.mp3` through `ru-8.mp3`, and equivalently for `uz` and `en`. The local path never contacts a speech provider.

```sh
python scripts/build-cinderella-film.py --story cinderella --audio-dir cartoon-audio/cinderella --check
python scripts/build-cinderella-film.py --story cinderella --audio-dir cartoon-audio/cinderella
```

FFmpeg and FFprobe are needed for rendering, not for preflight. External TTS is opt-in with `--allow-network-tts` and must be authorized separately. Output remains in `cartoon-build/<story>/`; inspect all video/audio/caption tracks and confirm rights and quality before copying to public or registering a film. No child data is accepted by this classic-only renderer.

## Offline synthetic draft narration

```sh
python scripts/prepare-local-classic-narration.py --story snow-white --language ru --language en
```

Requires local eSpeak, FFmpeg and FFprobe. The output is a separate draft directory under cartoon-build, not the public catalog. Russian and English are supported by this helper; Uzbek is deliberately not synthesized using a different language. Listen to each clip and replace low-quality narration before release. Full rendering still requires all 24 approved clips in the supplied audio directory.
