# Day 6 investigation: issue #10 (app workbench project logs)

Draft comment for the qodo-hackathon Day 6 discussion. Everything below was read
from `prophen/side-quest-studio` `main` at `cd4515c` through Qodo's codebase tools
(Qodo CLI 2.1.1, `qodo-codebase-wisdom` skill 1.1.7), unless marked otherwise.

## Original work order

Ticket link and original wording:
[#10 "Open the app workbench with a first project-log quest"](https://github.com/prophen/side-quest-studio/issues/10),
written the same day before any investigation. Summary of the request:

> Make the workbench clickable. The character walks to it, the same way they walk to
> the desk, and a log panel opens. The first quest is "Log a bit of progress." Saving
> my first entry unlocks one **logbook** on the workbench table, beside the computer.

Eleven acceptance criteria cover the walk, entry fields (optional project name,
required "What I worked on", optional "Next step"), a one-time unlock, reload and
editing, Markdown export, storage failures, stale-list errors, literal rendering,
small screens, and an unchanged notebook.

Proposed implementation, if any:

> Store log entries under their own `localStorage` key, separate from the notebook,
> so the workbench can't affect saved writing.

## What I investigated

Questions I asked Codebase Wisdom:

1. Is `src/storage.js` a reusable storage layer, or is it notebook-specific?
2. What in `src/main.js` assumes there is only one editor, one draft and one
   destination?
3. What would a second walk destination change in the character, CSS and tests?
4. Which past changes and review lessons constrain this work?

Useful findings and source references:

- **Storage is notebook-specific, but its pattern is reusable.** `readNotebook` and
  `savePassage` hard-code `STORAGE_KEY` (`src/storage.js:1`, `:40`, `:80`). The
  validation checks `title`/`text` fields (`:19-21`), and the error messages say
  "notebook" and "passage" (`:33`, `:59`). The revision check (`:57`), the
  unchanged-save shortcut (`:61-66`) and the `first` reward flag (`:75`) are the
  parts worth reusing. `toMarkdown` writes the heading
  `# Side Quest Studio — Your notebook` and `## Passage` (`:90`, `:99`). Its
  `quote()` helper, which keeps HTML literal, is an inner function and isn't exported.
- **The Web Lock is named after the storage key** (`src/main.js:258`). A separate
  key gives the logbook its own lock without blocking notebook saves, so the
  ticket's separate-key idea holds up.
- **Draft recovery has a single slot.** There is one `DRAFT_KEY` in sessionStorage
  (`src/storage.js:2`) and one global `draft` (`src/main.js:19`). `dirty()` and
  `snapshot()` read only `#title`/`#passage` (`:25-27`). On load, any recovered
  draft opens the writing editor (`:369-385`). A log draft either needs its own key
  or would reopen in the passage editor. The ticket doesn't mention reload recovery.
- **Cross-tab refresh only watches the notebook key** (`src/main.js:361`).
- **The walk has a single path.** The keyframes go from `53%/79%` to `39%/66%`
  (`src/main.js:184-189`). Position is the `at-desk` class (`src/style.css:193`),
  and the walk is skipped once that class is set (`src/main.js:179`). The sprite
  sheet faces left (`public/art/character-walk.png`), and a test asserts leftward
  movement (`tests/e2e/studio.spec.js:465`). The workbench is to the right
  (`src/style.css:245`), so the walk there needs a mirrored sprite. The pose
  animation already uses `transform` for a head offset (`src/main.js:195`), so the
  mirror must go on another element. Tests expect the exact class
  `player at-desk` (`tests/e2e/studio.spec.js:470`, `:485`, `:493`).
- **The quest panel is the notebook's.** `renderNotebook()` sets `#start`,
  `#quest-title` and `#reward` text (`src/main.js:67-71`). The ticket doesn't say
  where "Log a bit of progress" appears.
- **Unlocks are derived from saved data, not stored as flags.** The notebook is
  unlocked when `passages.length > 0` (`src/main.js:63`). The logbook can follow
  the same rule, which gives "unlock once" without a new flag.
- **The layout test lists every room button** (`tests/e2e/studio.spec.js:401`).
  The logbook needs adding there.
- **History:** `src/storage.js` has changed in only two commits: `d4c071a` (PR #1)
  and `4074712`, which rejects malformed draft IDs at the write boundary. The walk
  came from `70e64d1` (PR #4). `docs/REVIEW-LESSONS.md` records two Qodo findings
  from PR #1: stale entries after a failed read, and cached drafts presented as
  current. Both apply directly to a logbook.

What I checked against the project:

- I read `src/storage.js` and `src/main.js` in full. I also read the player CSS,
  the walk and layout tests, and `docs/REVIEW-LESSONS.md`.
- I confirmed that Qodo's mirror revision (`cd4515c`) matches `origin/main`.
- I looked at the sprite sheet to check which way the character faces.

Assumptions or suggestions I could not verify:

- **Qodo's pull-request tools were unavailable.** `stats`, `similar` and `by-file`
  each returned `MT-UPSTREAM-DOWN: context-retriever unreachable`. I used Qodo's
  codebase tools (`list-prs`, `list-commits`, `read-file`, `grep`) for history
  instead. I could not search past review suggestions semantically.
- I haven't tested whether a mirrored sprite looks right. I also haven't tested
  where the player should stand at the workbench on narrow screens (the media
  query at `src/style.css:666` moves the workbench).

## Resulting decision

Revised ticket or implementation plan:

[#10, revised](https://github.com/prophen/side-quest-studio/issues/10). The
original wording is kept in a collapsed section at the bottom of the issue.

- **Keep the separate key and lock** (`side-quest-studio.logbook.v1`), as proposed.
- **Don't copy `storage.js`.** Extract the revision-checked read/save and the
  literal Markdown quoting into shared helpers that take a key, a field
  validator and messages. Keep `readNotebook`/`savePassage`/`toMarkdown`
  as thin wrappers so the existing storage tests pass unchanged.
- **Add to the acceptance criteria:**
  - A separate log draft key. A recovered log draft reopens the log panel, labeled
    as a cached copy until saved.
  - The storage listener refreshes the logbook too.
  - The player walks between the start, desk and workbench from wherever they are
    standing. Walking right uses the existing walk sheet, mirrored frame by frame
    with CSS on a wrapper around `.walk-sheet`. The head-offset nudge flips with it.
  - Each station has its own quest panel. The desk keeps the current panel, and
    the workbench gets its own panel for "Log a bit of progress."
  - The logbook is added to the layout test.

Mirroring check: I put a mirrored walk frame in the running app (scratch CSS,
not committed). The character faces the workbench naturally, and the outfit and
hair read the same. The standing pose faces the front, so it doesn't need
mirroring. The standing spot at the workbench still needs tuning so the
character doesn't stop in open floor short of the table.

What changed and why, or why I kept the original approach:

The original storage idea was right about isolation, but "the same way they walk
to the desk" hid most of the work. Draft recovery, the walk and the quest panel
are each built for a single desk.

Remaining questions or blockers:

- Decided: a separate quest panel per station.
- Decided: mirror the existing walk sheet rather than add new art.
- How should the two quest panels share the room on narrow screens?
- Rerun the PR-history search once Qodo's pull-request tools respond.
