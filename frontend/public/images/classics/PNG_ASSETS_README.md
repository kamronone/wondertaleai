# Storybook PNG assets

The reader expects one original PNG per page, at `frontend/public/images/classics/<classic-id>/pages/page-N.png`.
The reader uses offline vector art only when an expected PNG fails to load.
User-provided illustrations and private authenticated media always take priority.

## Bundled image sets (verified in the GitHub branch)

- Red Riding Hood: `red-hood/pages/page-1.png` through `page-8.png` (8 PNGs).
- Cinderella: `cinderella/pages/page-1.png` through `page-8.png` (8 PNGs; 1000 × 750).
- Three Little Pigs: `three-pigs/pages/page-1.png` through `page-8.png` (8 PNGs; 742 × 1000).

All 16 new Cinderella and Three Little Pigs PNGs were committed on branch
`fix/private-book-access` in Git commit `5bbd70f89df7a8ae9146a64e3f0faccbf2229c64`.
Their existence in GitHub **does not prove** they are currently served by Netlify or Vercel.

## Release checklist

1. Check `npm run check:images:release`, `npm test`, and `npm run build` in `frontend`.
2. Verify HTTP 200, `Content-Type: image/png`, and distinct bytes for pages 1 and 8 of each story on the target Preview hostname.
3. Test page navigation on iPhone, Safari image rendering, and the missing-file fallback.
4. Verify custom-image precedence, private account media isolation, and old saved books.
5. Deploy Preview and inspect it before publishing to Production.

## Bundled moving character artwork

Four actual animated GIFs are now committed directly to this working branch:

- `red-hood/animations/red-hood-walk-wave.gif` — page 1, walking and waving
- `three-pigs/animations/three-pigs-building.gif` — page 4, placing a brick
- `three-pigs/animations/three-pigs-wolf.gif` — page 7, blowing at the brick house
- `cinderella/animations/cinderella-walking.gif` — page 5, walking and turning

In the reader's **Magic** art setting these files load instead of the original page PNG.
The default **Gentle** and **Off** modes retain the static illustration.
Broken GIF links fall back first to the original PNG, then to the offline SVG.
Motion is disabled when the device requests reduced motion, when night mode
is on or while the bedtime timer runs.

These four files do **not** animate every page of a story. No automatic
per-page video generation or paid provider is enabled.

Deployment status: GitHub branch files are confirmed, but a Netlify
Production release and live-device verification are separate steps.
