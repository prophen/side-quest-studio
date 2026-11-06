# Side Quest Studio

A cozy pixel-art studio for small creative beginnings. Day 1 is a working writing quest: walk to the desk, put something on the page, and unlock a notebook that keeps your passages together. No streak penalties or word-count targets.

## Run locally

Use Node.js 22.12+ (or a newer supported release) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. T3's project scripts include **Run studio**, **Verify app**, **Build**, and **Install dependencies**.

```sh
npx playwright install chromium  # once per machine
npm test                        # storage unit tests
npm run test:e2e                 # full browser flows in Chromium
npm run check                   # format, tests, and production build
npm run build                   # static output in dist/
npm run preview                 # serve the production build locally
```

The Playwright suite manages its own Vite server on port 4173. On Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`.

## Day 1

- An independent character follows a short preset path to the writing desk. An eight-frame sprite walk cycle uses complete poses with bent knees and opposing arm swings, playing two relaxed strides during the journey. Reduced-motion mode skips movement.
- Write or paste a passage, with an optional title. Only non-whitespace content is required.
- The first successful save unlocks one notebook. Later passages go inside it; reopen and edit any passage.
- Search your notebook by title or full passage text. Search ignores capitalization, resets when the notebook opens, and leaves full-collection backups unchanged. Use Clear search to immediately return to the full notebook and focus the search field.
- Download the whole collection as readable Markdown. The editor also downloads unsaved drafts.
- The app workbench and content board are marked coming soon. Free movement, furniture placement, backend/accounts, AI features, deployment, and later milestone decorations are outside Day 1.
- The studio follows the device clock: daylight (8am–5pm), dusk (5–8pm and 6–8am), and lamplight at night. The same room art is dimmed with CSS filters and a lamp glow, with no extra images. A dark system color scheme keeps it at night. Add `?phase=day`, `?phase=dusk` or `?phase=night` to the URL to preview a phase. The writing page and notebook stay lamp-lit at every hour. Fonts (Spectral, Archivo Narrow) are self-hosted, so no font requests leave the browser.
- Native keyboard-accessible dialogs, visible focus, labeled controls, status/error announcements, responsive layout, and reduced-motion support.

## Your writing and storage

Passages (title, original text, creation/update timestamps, and revision) are stored in `localStorage` under `side-quest-studio.notebook.v1`. Having at least one passage unlocks the notebook across reloads. Data stays in this browser profile and origin; it does not sync across devices. Clearing browser data, private browsing cleanup, or changing origins can remove access. **Download regular Markdown backups.** The app has no import feature yet.

Unsaved edits are recovered from per-tab `sessionStorage` on reload when available. Closing a dirty editor asks before discarding; navigating away requests the browser's unsaved-changes warning. Browsers may suppress that warning, especially on mobile, and session storage is not a durable backup. Download a draft before leaving if storage is unavailable.

Saves use browser-wide Web Locks, reload the latest collection inside the lock, and check passage revisions. Independent tab saves merge; stale edits are blocked and can be saved as a new passage to preserve both versions. Web Locks require a compatible browser and a secure context (HTTPS or localhost). Without them, saving is disabled with an explanation and draft download remains available.

Unavailable/full storage leaves the editor's text intact. Corrupt or unsupported saved data is never overwritten; **Download stored data** exports the original JSON for recovery. This recovery file can include your private writing: keep it private. Rendering uses text nodes rather than interpreting user text as HTML. Markdown exports use indented literal blocks to preserve arbitrary markup as writing.

## Sharing and icons

The favicon is a 16×16 pixel-art desk lamp (`public/favicon.svg`, also `assets/icon.svg`). `npm run images` renders `public/og-image.jpg` (1200×630 link preview) and `public/apple-touch-icon.png` from the favicon, room art and self-hosted fonts. Rerun it after changing any of those.

Open Graph tags need the public site address. Build with `VITE_SITE_URL=https://your.domain npm run build` (no trailing slash). Without it the tags use relative paths, which some link previews (Facebook, LinkedIn) ignore.

## Verification and review

The automated suite covers empty input, persistence/restoration, edits and timestamps, repeated saves, export, quota/access failures, corruption, draft reload recovery, simultaneous tabs and stale edits, literal HTML rendering, keyboard dialogs, mobile overflow, and reduced motion. GitHub Actions runs the same check command. Visual checks use local Playwright screenshots; no deployment is configured.

Qodo completed its review of PR #1 at `d4c071a`, identifying two recommended fixes: stale notebook entries after storage errors and potentially outdated draft recovery. The follow-up replaces stale entries with an error state and labels recovered drafts as cached copies that may lack recent edits. Three browser regression tests cover these cases. See [docs/REVIEW-LESSONS.md](docs/REVIEW-LESSONS.md). Review of the follow-up commit must be verified separately; local test success does not establish a clean Qodo review.

## Artwork

Generated room/character assets and approved concepts are preserved in `public/art/` and `docs/art/`; prompts are in [docs/art/PROMPTS.md](docs/art/PROMPTS.md). The standing character's alpha was inspected and its compositing checked in the rendered studio. The private reference photo is not included. See [docs/DAY-1-HANDOFF.md](docs/DAY-1-HANDOFF.md) for the original agreed scope.
