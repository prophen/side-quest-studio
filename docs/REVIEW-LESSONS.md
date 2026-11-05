# Day 1 review lessons

Qodo completed the review of [PR #1](https://github.com/prophen/side-quest-studio/pull/1) at `d4c071a8ad98d956a529e4cb50bb89a0787f438e`. Both findings were open, remediation-recommended issues confirmed against the implementation.

- **Failure states must replace misleading UI, not just announce an error.** When storage became corrupt or inaccessible, the library retained editable entries from an earlier successful read. The fix removes those entries and displays the storage error in the library, including when it is already open. Valid storage reads restore the normal list. Finding: `2173adfd-7737-4033-a1a4-fbb5f54bf81c`.
- **A recovered cache is not proof that the latest edit was saved.** A failed session-storage write can leave an older draft behind. Preserve that potentially valuable copy, but explicitly label recovery as a cached draft that may lack recent edits. Keep this warning separate from live save status until a successful save. Finding: `ac17f90f-e821-4f8f-b41a-f9e876fe0832`.

Verification: the regression tests load a notebook before injecting corruption/access failure, and cache version A before failing the write of version B and reloading. All 6 storage tests and 13 Chromium tests pass, along with formatting and the production build.

These are implemented fixes, not a claim that Qodo has reviewed the follow-up commit. No finding was manually dismissed or marked implemented.

Follow-up: Qodo automatically attributed both original findings as `implemented` at `313710b`. Its local review also found that an empty recovered draft ID could be written into the notebook, making later reads reject the collection. Recovery now rejects empty IDs and the storage write boundary independently refuses invalid IDs; regression tests preserve the pre-existing collection byte for byte. The local review's missing-artwork finding is unsupported: both PNGs are committed under `public/art/`, and the browser asset-loading test and CI pass. Binary files were excluded from that local review, which explicitly reported incomplete coverage. No manual dismissal was recorded.

## Day 3: search work per keystroke

Qodo's completed review of [PR #6](https://github.com/prophen/side-quest-studio/pull/6)
at `6694e99a5794ce01fc2b7ba341e4a3d9f82acead` identified repeated synchronous notebook
reads, parsing, filtering, and DOM rebuilding on every keystroke. Finding
`ea8669e2-bc34-421e-a870-0d0c9bdf100f` is a performance recommendation supported by
the input handler, although no slow-device latency benchmark was recorded.

Search now coalesces rapid input with a 150 ms delay. Each completed search still
reads storage, and explicit refreshes (including storage events) cancel pending
search work and run immediately. This preserves the rule that an error must
replace stale editable entries. A controlled-clock browser regression checks one
read for a typing burst, immediate corruption handling, cancellation of pending
work, and no stale results after further typing.

The lesson is to check how often a safe operation runs, as well as whether it is
correct. Existing data-preservation rules still apply; this change does not need
a new broad project rule or a reusable skill. Future search reviews should include
rapid input and storage failure together. Debouncing reduces repeated work; it is
not a measured guarantee of responsiveness at browser storage limits.
