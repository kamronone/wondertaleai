# WonderTale AI: mobile UI audit and release checklist

Scope: **frontend only** on `fix/private-book-access`. The production site, `main`, and Backend are not changed.

## Audited from source and user-provided iPhone screenshots

| Screen | Observed issue | Current mitigation | Remaining verification |
| --- | --- | --- | --- |
| Reader | Long illustration/text overflow one phone viewport; page turning scrolled to heading | Bounded illustration height; natural text scroll; removed conflicting header scroll effect | Safari swipe/tap, 320/375/390/430px, landscape |
| Reader header | Giant control rows, duplicated end-of-story cards | Paired mode controls, compact bedtime row, one activity at a time | Open/close settings and finish a story |
| Library | Large empty-state gaps and achievements pushing books down | Removed duplicate bottom padding; achievements collapsed; resume-reading shortcut | Empty and populated accounts, search/favorites |
| Creator | Large action buttons, optional character builder pushed fields below fold | Equal-size actions; optional character builder disclosure | Every wizard step, validation, keyboard open |
| Profile | Server warning and advice dominated page, plans added long scroll | Compact demo status and collapsed tips/plans | Signed-out/offline/signed-in states |
| All tabs | Fixed bottom navigation plus duplicated content spacers | One shell-safe-area reservation; screen-specific overrides; width guards | Safe area, dynamic Safari bars, small screens |

## Required device acceptance matrix (not yet executed)

- Portrait widths: 320, 375, 390, 430 CSS px; also iPad tablet and desktop.
- iOS Safari with toolbar collapsed/expanded and PWA standalone display.
- Verify no horizontal overflow; every visible text button fits its content; inputs do not zoom viewport; text contrast remains readable.
- Verify bottom bar remains tappable and does not overlap the last control or error message.
- Reader: open a resumed book, turn forward/back, swipe, toggle settings, night mode, and end-of-story activity. Expect next page image/text, never a jump back to site header.
- Library: no books, one book, multiple books, search zero results, filter and favorite; a continue-reading shortcut must remain scoped to current visible books.
- Creator: all three steps, long RU/UZ names, no child photo, optional extra hero, invalid form messages, keyboard covering buttons.
- Profile: API offline/retry, sign in/out, registration disabled, family profiles, collapsed tips, plans; no cross-account data leaks.
- Verify PWA offline public shell while private books and authenticated requests never enter the shared service-worker cache.

## Deployment limitation

No Netlify deployment connector is available in this chat session. No Netlify Preview was created and the production `ertakcha.netlify.app` was not touched. GitHub Actions validates source tests, TypeScript, Uzbek orthography and Vite build, **not** visual Safari behavior.

## Release gate

Do not merge or deploy until a separate Preview can be created and inspected on a real iPhone. Ensure owner-scoped data remains isolated. The Backend CI failure belongs to separate permitted work and must not be silently dismissed as passing.
