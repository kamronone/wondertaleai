# WonderTale AI: Netlify preview and release from iPhone

The work-in-progress frontend is on GitHub in `fix/private-book-access`.
The GitHub `main` branch is deliberately not merged or changed here.

## Site configuration

This repository contains a root-level `netlify.toml` with:

- Base directory: `frontend`
- Build: `npm install --no-audit --no-fund && npm test && npm run build && npm run check:images:release`
- Publish directory relative to base: `dist` (`frontend/dist` from repository root)
- Node.js: `22`
- SPA fallback: `/*` to `/index.html` (status 200)
- Backend: excluded. Never publish or configure backend secrets in frontend environment variables.

There is currently no `frontend/package-lock.json`, so `npm ci` is intentionally not used.

## Check existing site connection first

1. Open https://app.netlify.com on an iPhone and choose the **ertakcha** project.
2. Open **Project configuration → Developer settings → Continuous deployment**.
3. Verify that its Git repository is **kamronone/wondertaleai**, not a different fork or a manually uploaded static site.
4. Check **Branches and deploy contexts**. Keep the current Production branch untouched until a preview is built and verified.
5. Enable **branch deploys** for `fix/private-book-access` if your Netlify plan and site support them.
6. Use **Deploys** to watch a build from that branch. Verify that the deploy commit matches the latest GitHub branch commit and the build includes successful `npm test`, `npm run build`, and `npm run check:images:release`.
7. Open the resulting branch-preview URL on iPhone. Do **not** assume `ertakcha.netlify.app` changed: branch deploys do not replace the production URL.

## Required iPhone checks before Production

- Open **Three Little Pigs**, page 4, then page 5. Artwork frames have consistent heights; portrait art isn't oversized or cropped.
- Tap any PNG/GIF outside a character interaction point: it **does not** open a fullscreen image viewer.
- On page 4, the animation control appears **below** the illustration, not over the picture.
- On supported pages, the small character reaction hotspot works without triggering page turns.
- Test Prev/Next and reading progress, and confirm the text doesn't extend beneath the fixed bottom menu.
- Test Russian / Uzbek / English switching and offline mode on a classic already saved on the device.
- Check that `VITE_API_BASE`, if configured, points only to an explicitly authorized and protected backend; public frontend demo can work without it.
- Check Safari refresh and PWA launch separately, because service-worker caches may show old assets before an update takes control.

## Production release

Only after the preview passes, use the Netlify site’s verified Production branch / deploy settings to publish intentionally.
Changing the Netlify Production branch is a separate action and should not be done just to create a preview.
Rolling back a failed production deploy should use Netlify's deploy history.

## Current blocker

The assistant can update the connected GitHub branch but does not have direct Netlify project-management access in this chat.
No claim of a completed Netlify deployment, successful build, or live iPhone smoke test is made without evidence from Netlify.
