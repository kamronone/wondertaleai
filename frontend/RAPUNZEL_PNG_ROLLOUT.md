# Rapunzel illustrated PNG rollout

This branch supports a new eight-page Rapunzel PNG collection. Until all
eight verified images are installed, bundled vector scenes remain visible.

## Artwork destinations

Place the generated assets at these exact paths:

- `frontend/public/images/classics/rapunzel/pages/page-1.png`
- `frontend/public/images/classics/rapunzel/pages/page-2.png`
- `frontend/public/images/classics/rapunzel/pages/page-3.png`
- `frontend/public/images/classics/rapunzel/pages/page-4.png`
- `frontend/public/images/classics/rapunzel/pages/page-5.png`
- `frontend/public/images/classics/rapunzel/pages/page-6.png`
- `frontend/public/images/classics/rapunzel/pages/page-7.png`
- `frontend/public/images/classics/rapunzel/pages/page-8.png`

Each page has distinct scene content (960×720 PNG) matching the eight
story beats. Do not replace the images with identical copies or change
custom user-uploaded illustrations.

## Enable only after uploading

Set `VITE_RAPUNZEL_PNG_READY=true` in the **Preview** build environment,
not Production, after all PNG files are present.

The `check:images:release` command becomes a 32-file validation and
fails if any of the Rapunzel images is absent, invalid or duplicated.
Without this flag, the original 24-file check and deterministic vector
fallback continue to work. Reader upgrades the original bundled Rapunzel
SVG but never overwrites private/custom illustration URLs.

Check the new Netlify Ertakcha **deploy preview** before any Production
promotion. No access to the retired WonderTale Netlify project is needed.
