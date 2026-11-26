#!/usr/bin/env bash
set -euo pipefail

public_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../public" && pwd)"
art_dir="$public_dir/images/classics/three-pigs"
output="$public_dir/cartoons/three-pigs/film.mp4"
work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
mkdir -p -- "$(dirname -- "$output")"

# Every scene lasts ten seconds. The WebVTT tracks use the same cuts.
for scene in {1..8}; do
  case "$scene" in
    4) input=(-ignore_loop 1 -stream_loop -1 -i "$art_dir/animations/three-pigs-building.gif") ;;
    7) input=(-ignore_loop 1 -stream_loop -1 -i "$art_dir/animations/three-pigs-wolf.gif") ;;
    *) input=(-i "$art_dir/pages/page-$scene.png") ;;
  esac

  framing='scale=384:512:force_original_aspect_ratio=increase,crop=384:512'
  if [[ "$scene" == 4 || "$scene" == 7 ]]; then
    video_filter="$framing,fps=24"
  else
    video_filter="scale=1152:1536:force_original_aspect_ratio=increase,crop=1152:1536,zoompan=z='1+0.055*(1-cos(PI*on/239))/2':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=240:s=384x512:fps=24"
  fi

  ffmpeg -hide_banner -loglevel error "${input[@]}" -filter_threads 1 -vf "$video_filter" \
    -t 10 -an -c:v libx264 -threads 2 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p \
    "$work_dir/$scene.mp4"
  printf "file '%s.mp4'\n" "$scene" >> "$work_dir/scenes.txt"
done

ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i "$work_dir/scenes.txt" \
  -c copy -movflags +faststart "$work_dir/film.mp4"
mv -- "$work_dir/film.mp4" "$output"
