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
