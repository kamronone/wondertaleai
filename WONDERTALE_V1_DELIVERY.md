# WonderTale AI / Ertakcha — 1.0 delivery checklist

Working branch: `fix/private-book-access`. Do not merge to main or deploy Production without a separate release decision.

## Implemented in the working branch

- [x] Mobile reader illustration stage shared by PNG and GIF, without clipping.
- [x] Fullscreen illustration viewer for PNG, GIF and private account photos.
- [x] iPhone pinch, drag, double-tap and keyboard zoom support.
- [x] Four original animated-character GIFs on story-specific pages.
- [x] User-selectable illustration motion and reduced-motion support.
- [x] Compact mobile reading toolbar, controls, title and safe bottom padding (reader-mobile-v1.css).
- [x] Optional original, synthesized forest/wind/magic ambience (no playback before a tap).
- [x] Opt-in offline illustration download for red-hood, cinderella and three-pigs only.
- [x] PWA offline illustration cache persists independently from app-shell updates.
- [x] Reader navigation, saved progress, favorites and classic book modes already exist.

## Not yet fully complete or verified

- [ ] Netlify build branch, logs, production settings and current live assets verified with Netlify access.
- [ ] Real iPhone Safari/PWA smoke test, including page gestures, media failures and offline relaunch.
- [ ] Full TypeScript build and automated tests passing (Vercel build-rate-limit currently blocks validation).
- [ ] Additional per-page character animations for every story; only four real GIFs are installed.
- [ ] Professionally recorded narration with character-specific voices and per-word highlighting.
- [x] Four optional story-aware interaction choices below illustrated pages, separate from image zoom.\n- [ ] Image-coordinate character hotspots and on-character reactions; this requires per-image scene layers and accessibility review.
- [ ] Comprehensive parental controls and age-based content audits.
- [ ] Complete offline packs (narration, all story images, optional sounds, media storage quota UX).
- [x] Existing library achievements and optional story-ending branch confirmed in audit.\n- [ ] Child-friendly rewards UX audit, positive feedback and progression review.
- [ ] Final accessibility, privacy, security, performance and release-readiness review.

## Release gates

1. Verify Netlify deploy source branch and publish a separate preview or obtain explicit release permission.
2. Run `cd frontend && npm ci && npm test && npm run build && npm run check:images:release`.
3. Test on real iPhone: PNG/GIF consistency, fullscreen gestures, sound toggle, and airplane-mode reopening.
4. Audit private-account media boundaries and storage before releasing.
5. Merge/deploy only after the preview passes and release permission is granted.

## Notes

The soundscape is synthesized atmosphere, not recorded character dialogue.
Offline image downloads cover only the three classics with eight confirmed bundled PNGs each, plus optional GIFs.
Those changes are not proof that `ertakcha.netlify.app` is running the branch.

## Latest scene-interaction implementation

- StorySceneInteraction uses a fixed allowlist: three-pigs pages 4/7, cinderella page 5, red-hood page 1.
- Two clear actions are localized in RU/UZ/EN on each supported page.
- Choices are local and optional. They never rewrite the book, request child data or overlap picture zoom.
- Hide scene actions during focus/bedtime/night reading.
- Per-character image-coordinate animation hotspots are not implemented yet; do not describe these choices as tap-to-animate on characters.
