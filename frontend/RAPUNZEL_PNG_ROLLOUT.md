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

## Install the reviewed ZIP (one command)

From the `frontend` directory run:

```bash
npm run install:rapunzel:art -- ./ertakcha_rapunzel_8_png.zip
```

The ZIP must first be available in that directory. The installer validates the
eight individual PNGs, file signatures, resolution, and duplicate content, then
writes only the exact expected image paths. It never executes ZIP contents.
This step modifies the local checkout; commit all eight images to
`fix/private-book-access` before changing the preview environment.

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
