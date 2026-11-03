# Side Quest Studio — Day 1 handoff

## Authorization and current state

The user asked to start building the agreed Day 1 plan, create a public GitHub repository, and create a T3 project. They then explicitly requested handing the work to a new thread in that project. Continue implementation there without asking to start again.

- Public repository created: https://github.com/prophen/side-quest-studio
- T3 project: Side Quest Studio, ID `210d74b1-c54a-4d16-9166-a279ecca15c2`
- Local checkout: `/Users/nikema/.t3/projects/side-quest-studio`
- Branch already checked out: `feat/day-one-writing-quest`
- Remote main contains only T3's initial README/icon commit. No app code, dependencies, PR, or tests yet.
- Artwork and this handoff are currently uncommitted on the feature branch. Preserve them.
- GitHub CLI is authenticated as `prophen` and can create/push repositories.
- No subagents requested. Do the build in the new top-level thread.

## Product and approved design

A cozy creative game for writing a book, creating content, and building apps. A retro 16-bit pixel-art isometric dollhouse studio, warm cream walls, wood, moss green, muted plum, warm light, a cat, ample open space. The user approved the studio and character concepts in `docs/art/`.

The player resembles the user: a 43-year-old Black woman with brown skin and very short natural hair, sage-gray tee, jeans, cream sneakers. Preserve the approved likeness. The original reference photo is private and must not be copied into the public repository. Only generated art is included.

Actions do not each add furniture: first writing unlocks ONE notebook, later passages go inside it. Long-term: milestones unlock curated decorations; saved creative artifacts remain accessible and exportable even if the user stops playing. No streak penalties.

## Day 1 implementation

Build a lightweight browser app (Vite + vanilla JavaScript was the initial implementation choice, not a user requirement). No backend, account, AI feature, deployment, or paid service needed.

1. Show the dollhouse room and independently movable player. Writing desk is active; app workbench and content board say coming soon.
2. Click writing desk, character follows a short preset path with simple walking feedback, then writing panel opens. Free movement/pathfinding/furniture placement are out of scope. Avoid claiming a static bob is a full walk-cycle animation.
3. First quest: "Put something on the page." Optional title plus passage field. Allow typing or pasting, require non-whitespace content only, no arbitrary word-count goal.
4. Save passage; small celebration; unlock notebook on desk. Notebook opens collection, supports new passages and reopening/editing existing ones.
5. Persist titles, passage text, creation/update timestamps and notebook unlock locally across reloads. Clearly explain local browser storage, no cross-device sync, and that clearing browser data can remove writing.
6. Download writing collection as readable Markdown backup.
7. Protect unsaved text, handle unavailable/quota/corrupt storage without silently losing or overwriting writing, avoid duplicate entries/rewards on repeated clicks. Use safe DOM text rendering, not user-text HTML injection. Consider multi-tab lost updates.
8. Responsive UI, keyboard access, visible focus, labeled inputs, reduced motion. Keep UI inviting and simple.

## Artwork

`docs/art/studio-concept.png` and `docs/art/character-concept.png`: user-approved reference concepts.

`public/art/studio-room.png`: newly generated room asset with notebook and writing chair removed, to allow player and notebook overlays.

`public/art/character-standing.png`: newly generated single standing character, requested transparent background. Inspect actual alpha/transparency and sizing before use; tool display looked dark around the character, so verify usability instead of assuming clean cutout. This is a single pose, not a sprite animation sheet. Use imagegen for needed image edits per skill. Both new assets were generated just before handoff and have not been user-approved separately or tested in the app.

All art generated with built-in image_gen; do not publish the original user photo. Asset prompts are in `docs/art/PROMPTS.md`.

## Verification and delivery

Use meaningful automated tests for persistence, empty-content rejection, edits, duplicate prevention, refresh restoration, export, and storage failures retaining unsaved input. Verify full interaction flow with suitable tests. Follow current tool rules: do not use T3 preview_* unasked just to inspect an edit. The user has requested build, not explicitly browser work.

Create a focused PR titled "Add the first writing quest and persistent notebook". Link it immediately using T3 link_pull_request after creation. Do not merge it. The hackathon requires a Qodo review; determine what is configured and honestly report any user sign-in/installation required. Do not claim a Qodo review ran unless verified. No need to post to the hackathon discussion on behalf of the user.

Update README with install/run/build/test instructions, data-storage limitations, scope, and Day 1 status. Add useful T3 project run/test/build scripts once commands exist. Record actual review lesson only after review. Final status should make clear what works, tests run, PR link, and outstanding Qodo setup.

Definition of done: walk to desk, save real passage, refresh, reopen from notebook, download it; focused PR ready for Qodo review.
