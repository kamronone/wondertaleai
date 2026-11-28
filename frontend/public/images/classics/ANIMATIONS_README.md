# Character animation assets

In reader Settings → Living illustrations → Magic, built-in classic demo stories
can show real character-motion GIFs rather than only CSS light/zoom effects.

## Prepared GIFs

The following four files are **generated but must be uploaded into this branch**
before the published site can play them:

| Story | Page | Expected repository path | Action |
|---|---:|---|---|
| Red Riding Hood | 1 | `frontend/public/images/classics/red-hood/animations/red-hood-walk-wave.gif` | Walks, turns and waves |
| Three Little Pigs | 4 | `frontend/public/images/classics/three-pigs/animations/three-pigs-building.gif` | Pig lifts and sets a brick, blinks |
| Three Little Pigs | 5 | `frontend/public/images/classics/three-pigs/animations/three-pigs-wolf.gif` | Wolf opens its mouth and blows |
| Cinderella | 5 | `frontend/public/images/classics/cinderella/animations/cinderella-walking.gif` | Walks, turns her head, gown sways |

All 4 GIF files were generated in 6 frames at ~430 ms per frame, loop
indefinitely, and occupy approximately 2.1 MB combined.

The code in `classic_page_art.ts` maps each story and page to a corresponding
GIF, and `main.tsx` requests it only in Magic mode. Missing GIFs fall back to
the original page PNG (then built-in SVG if PNG also fails).

**Never replace any user's custom photo, personal image, or authenticated media.**

Reduced-motion device settings, bedtime timer, and night mode turn off character
animations. Keep the static illustrations for printing and offline fallback.

## Release gates

1. Upload the four GIF binaries into the exact paths above on branch
   `fix/private-book-access`.
2. Verify each GitHub file exists and GIF magic bytes and 6 decoded frames.
3. Build frontend, run tests, and deploy an isolated Preview.
4. Test Safari iPhone animated playback, missing-GIF fallback, and low-power
   / reduced-motion settings; only then approve Production.

A code commit by itself **does not** put GIF assets on Netlify.
