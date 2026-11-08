# Side Quest Studio agent instructions

These instructions apply throughout this repository, to coding agents and reviewers.

## What we are building

Side Quest Studio is a cozy pixel-art space for small creative beginnings, built
with Vite, vanilla JavaScript, and CSS. The working writing quest lets someone walk
to a desk, save a passage, unlock one notebook, edit their collection, and download
Markdown backups. Writing lives in this browser; there is no backend or account.

The app workbench and content board are coming soon. Free movement, furniture
placement, accounts, cloud sync, AI features, and deployment are outside the current
scope unless the user explicitly requests them. Do not prescribe infrastructure
for these future features as a requirement for the current app.

`src/main.js` owns interactions and draft recovery; `src/storage.js` owns notebook
validation, saves, and export; `src/phase.js` owns lighting selection;
`src/style.css` and `index.html` own presentation. See `README.md` for current
behavior and `docs/REVIEW-LESSONS.md` for verified review lessons. The Day 1 handoff
is historical context, not an up-to-date description of repository state.

## Setup and verification

Use Node.js 22.12+ (or a newer supported release) and npm.

```sh
npm ci
npx playwright install chromium # once per machine
npm run dev                    # local development
npm test                       # storage and lighting unit tests
npm run test:e2e                # Chromium interaction and failure scenarios
npm run check                  # formatting, unit tests, browser tests, build
npm run build                  # static output in dist/
npm run preview                # serve the production build
npx prettier --check AGENTS.md  # instructions are outside the format script
```

Playwright starts its own Vite server on port 4173. On Linux CI, use
`npx playwright install --with-deps chromium`. Run `npm run check` for app changes;
for documentation-only changes, check formatting and verify commands against
`package.json`. Add regression coverage for changed behavior, especially storage
failures and recovery, rather than tests that merely repeat implementation details.
Run `npm run images` when changing the artwork, favicon, or fonts used by the share
images. Report the checks actually run and any gaps; local success does not prove
that CI or Qodo reviewed the same commit.

## Project rules

### 1. Never sacrifice the words

**Applies to:** `src/storage.js`, save/recovery/export flows in `src/main.js`, and
their tests.

Preserve editor text when storage is full, unavailable, corrupt, or unsupported.
Never silently reset or overwrite unreadable stored data; retain raw-data recovery
and draft downloads. Keep the browser-wide Web Lock around the entire notebook
read/modify/write and check revisions before replacing a passage. Without Web
Locks, explain why saving is disabled and keep draft download available. Validate
recovered identifiers at the write boundary and preserve original passage text.

**Why:** The writing is the valuable artifact. A celebration or a successful-looking
save must never cost someone their work, including when two tabs are open.

### 2. No false reassurance

**Applies to:** notebook lists, save status, and recovered-draft messages in
`src/main.js` and `index.html`; browser regression tests.

When a notebook read fails, replace stale editable entries with the error state,
including in an already-open dialog. Label recovered drafts as cached copies that
may lack recent edits, and retain that warning until a successful save. Do not
treat a cached draft or an old successful read as proof of current saved state.

**Why:** Day 1 review caught both misleading stale entries and outdated draft
recovery. Test the transition from success to failure, not only an initial error
screen; the details are in `docs/REVIEW-LESSONS.md`.

### 3. The notebook does not judge you

**Applies to:** quest validation, rewards, product copy, and future progression.

Require only non-whitespace passage content; titles stay optional. Do not add
word-count gates, streak penalties, or loss of access to saved writing after
inactivity. The first successful save unlocks one notebook; subsequent saves add
or edit passages, without duplicate rewards on repeated clicks.

**Why:** This studio makes starting easier. Creative work remains worthwhile and
accessible even when someone stops playing.

### 4. Cozy must still be usable

**Applies to:** `index.html`, `src/style.css`, interaction and animation code, and
UI tests.

Preserve keyboard-accessible dialogs, visible focus, labeled controls, and
announced status/errors. Keep the editor and Save action reachable on narrow and
short screens. Respect reduced motion by skipping the character journey. Reuse
the existing CSS color and typography tokens for UI elements; keep phase-specific
values in the theme definitions so day, dusk, and night remain coherent.

**Why:** Atmosphere should support writing, including for people using keyboards,
small screens, or reduced motion.

### 5. Private writing stays private and literal

**Applies to:** rendering and export, browser storage, network integrations,
`public/`, and `docs/art/`.

Render user writing as text, never as executable HTML; preserve arbitrary markup
as literal writing in Markdown downloads. Keep writing local and fonts self-hosted;
do not add transmission of passages or drafts without an explicitly requested
feature. Explain browser-local storage limits without promising durable backup or
cross-device sync. Never commit the private reference photo or real private
writing in fixtures; use generated artwork and synthetic test passages.

**Why:** People should be able to write freely without their words becoming code,
unexpected network traffic, or public repository content.

### 6. Shared docs describe the workflow, not the workstation

**Applies to:** committed files in `docs/`, `README.md`, `AGENTS.md`, and saved
agent or scheduled-job prompts.

Write absolute local paths, home-directory usernames, and runtime handles such as
schedule, project, thread, or session IDs as placeholders (`PROJECT_ROOT`,
`SCHEDULE_ID`). Keep the real values in uncommitted local configuration. Public
GitHub links, commit SHAs, Qodo finding IDs, and repository-relative paths are
fine. If a value was already committed, replace it in the current files and say
that history still contains it; do not rewrite history unless the user asks.

**Why:** Qodo's PR #8 review (finding `2b938a1c-f539-430e-918d-d51c0ff18a45`)
caught the Day 4 automation notes exposing the workstation path and schedule
handle. The values stay in history after removal, and notes with placeholders
can be reused by anyone running the workflow.
