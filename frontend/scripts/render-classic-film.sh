#!/usr/bin/env bash
set -euo pipefail

public_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../public" && pwd)"
story="${1:-}"
case "$story" in
  three-pigs|red-hood) ;;
  *) printf 'Usage: bash %s {three-pigs|red-hood} [output.mp4]\n' "$0" >&2; exit 2 ;;
esac
art_dir="$public_dir/images/classics/$story"
output="${2:-$public_dir/cartoons/$story/film.mp4}"
work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
mkdir -p -- "$(dirname -- "$output")"

# Every scene lasts ten seconds. The WebVTT tracks use the same cuts.
for scene in {1..8}; do
  case "$story:$scene" in
    three-pigs:4) animation=three-pigs-building ;;
    three-pigs:7) animation=three-pigs-wolf ;;
    red-hood:2) animation=red-hood-walk-wave ;;
    *) animation="" ;;
  esac

  framing='scale=384:512:force_original_aspect_ratio=increase,crop=384:512'
  if [[ -n "$animation" ]]; then
    input=(-ignore_loop 1 -stream_loop -1 -i "$art_dir/animations/$animation.gif")
    video_filter="$framing,fps=24"
  else
    input=(-i "$art_dir/pages/page-$scene.png")
    canvas='scale=1152:1536:force_original_aspect_ratio=increase,crop=1152:1536'
    if [[ "$story:$scene" == red-hood:8 ]]; then
      # Keep every character in the final panoramic illustration visible.
      canvas='split[background][art];[background]scale=1152:1536:force_original_aspect_ratio=increase,crop=1152:1536,boxblur=45[blurred];[art]scale=1152:-2[foreground];[blurred][foreground]overlay=(W-w)/2:(H-h)/2'
    fi
    video_filter="$canvas,zoompan=z='1+0.055*(1-cos(PI*on/239))/2':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=240:s=384x512:fps=24"
  fi

  ffmpeg -hide_banner -loglevel error "${input[@]}" -filter_complex_threads 1 -filter_complex "$video_filter" \
    -t 10 -an -c:v libx264 -threads 2 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p \
    "$work_dir/$scene.mp4"
  printf "file '%s.mp4'\n" "$scene" >> "$work_dir/scenes.txt"
done

ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i "$work_dir/scenes.txt" \
  -c copy -movflags +faststart "$work_dir/film.mp4"
mv -- "$work_dir/film.mp4" "$output"
