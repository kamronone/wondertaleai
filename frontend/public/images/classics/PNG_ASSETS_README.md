# Storybook PNG assets

The reader expects 8 page-specific PNGs per classic in `frontend/public/images/classics/<classic-id>/pages/page-N.png`.
The offline vector fallback is used until those PNGs are present.
User-owned illustrations and private authenticated illustrations always have priority.

## Prepared image set (not yet committed as binaries)

- Cinderella: `cinderella/pages/page-1.png` through `page-8.png`, 1200×900.
- Three Little Pigs: `three-pigs/pages/page-1.png` through `page-8.png`, 760×1024.

The prepared 16-image archive is an out-of-repository conversation artifact and must be uploaded before release.
Never mark these 16 files as deployed based on this manifest alone.

## Release checklist

1. Upload all 16 PNGs to the exact directory paths above.
2. Check HTTP 200 and content-type image/png for page 1 and page 8 of each classic.
3. Test changing pages on a narrow phone viewport and verify different page images.
4. Test missing PNG fallback, custom-image priority and private account media isolation.
5. Run `npm test` and `npm run build` in `frontend`.
6. Deploy Preview, verify, then promote to Production only after checks pass.
