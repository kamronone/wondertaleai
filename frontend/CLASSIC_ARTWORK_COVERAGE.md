# WonderTale story illustration coverage audit

Working branch: `fix/private-book-access`. This is a source audit, not a Netlify deployment verification.

## Current inventory

- 30 built-in classic story IDs are declared in `frontend/src/classics.ts`.
- All 30 support deterministic local, page-specific SVG fallback illustrations through `classicPageArtwork`, even without a network connection.
- Four classics have eight committed PNG pages each (32 PNGs total): `red-hood`, `cinderella`, `three-pigs`, and `rapunzel`.
- The other 26 do **not** have complete eight-page PNG bundles. Existing cover WebP/SVG assets are not equivalent to per-page PNG art.
- Four built-in character-motion GIFs exist across Red Riding Hood, Cinderella and Three Little Pigs. They do not animate all eight scenes.
- Custom user illustrations and authenticated private media must remain higher-priority than built-in bundled graphics.

## Remaining full PNG packs, in suggested implementation order

1. `snow-white`, `ugly-duckling`, `bremen`, `hansel-gretel`
2. `sleeping-beauty`, `puss-boots`, `frog-prince`, `goldilocks`
3. `jack-beanstalk`, `pinocchio`, `thumbelina`, `princess-pea`
4. `emperor-clothes`, `elves-shoemaker`, `little-mermaid`, `snow-queen`
5. `nutcracker`, `aladdin`, `ali-baba`, `kolobok`
6. `turnip`, `teremok`, `ryaba`, `masha-bears`
7. `twelve-months`, `fisherman-fish`

This is **208 additional original PNG pages** (26 stories × 8 pages). Generate genuinely scene-specific illustrations consistent in character identity, style and action across a story. Do not rename SVG, copy one page eight times, or represent a cover as a page illustration.

## Acceptance criteria for each new bundle

1. Eight distinct PNG files exist as `public/images/classics/<id>/pages/page-1.png` through `page-8.png`.
2. Check PNG signatures, dimensions, unique SHA-256 fingerprints and meaningful alignment to each chapter's RU/UZ/EN story beats.
3. Update the bundled PNG ID registration in `src/classic_page_art.ts` only after all eight verified files are committed. Update release image checker in `scripts/check-classic-page-assets.mjs` to include the new pack.
4. Open a separate Preview and verify that the reader requests all eight PNGs and gracefully falls back to the correct offline SVG when an image fails.
5. Confirm that no private/user-uploaded artwork is replaced, no browser zoom is reintroduced and no Production build is touched without permission.

## Automated regression coverage

- `tests/classic_story_catalog_integrity.test.mjs` checks that all 30 story IDs have eight story-specific chapter entries on each supported language.
- `tests/classic_artwork_coverage.test.mjs` verifies the 30-story fallback architecture and the expected 32 committed PNG paths.
- Run `npm test && npm run build && npm run check:images:release` from `frontend/` before a Preview release.

A passing source test cannot prove PNG visual quality, live deployment correctness or iPhone Safari rendering. Those remain independent release checks.
