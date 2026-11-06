import "@fontsource/spectral/300.css";
import "@fontsource/spectral/300-italic.css";
import "@fontsource/spectral/400.css";
import "@fontsource/archivo-narrow/500.css";
import "@fontsource/archivo-narrow/600.css";
import "./style.css";
import {
  STORAGE_KEY,
  DRAFT_KEY,
  readNotebook,
  savePassage,
  toMarkdown,
  Conflict,
} from "./storage.js";
import { resolvePhase, PHASE_LABELS } from "./phase.js";

const $ = (id) => document.getElementById(id);
let notebook = { version: 1, passages: [] };
let draft = null;
let baseline = "";
let saving = false;
let walking = false;
let searchTimer;
let draftStorageWarning = "";
const snapshot = () =>
  JSON.stringify({ title: $("title").value, text: $("passage").value });
const dirty = () => draft !== null && snapshot() !== baseline;
const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
function announce(message) {
  $("status").textContent = message;
}
function download(content, filename, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function refresh() {
  clearTimeout(searchTimer);
  try {
    notebook = readNotebook(storage);
    renderNotebook();
    return true;
  } catch (error) {
    // Remove stale interactive entries even if the notebook is already open.
    const errorItem = document.createElement("li");
    errorItem.className = "error";
    errorItem.setAttribute("role", "alert");
    errorItem.textContent = error.message;
    $("passage-list").replaceChildren(errorItem);
    $("search-status").textContent = "";
    announce(error.message);
    $("backup").textContent = "Download stored data";
    return false;
  }
}
function renderNotebook() {
  const unlocked = notebook.passages.length > 0;
  $("notebook").hidden = !unlocked;
  $("collection").hidden = !unlocked;
  $("backup").textContent = "Download writing";
  $("start").textContent = unlocked ? "Back to the desk" : "Sit at the desk";
  $("quest-title").textContent = unlocked
    ? "Pick up where you left off."
    : "Put something on the page.";
  $("reward").hidden = unlocked;
  const list = $("passage-list");
  list.replaceChildren();
  const query = $("passage-search").value.trim().toLowerCase();
  const matches = [...notebook.passages]
    .reverse()
    .filter(
      (passage) =>
        passage.title.toLowerCase().includes(query) ||
        passage.text.toLowerCase().includes(query),
    );
  $("search-status").textContent =
    `${matches.length} ${matches.length === 1 ? "passage" : "passages"} found.`;
  for (const passage of matches) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "passage-item";
    const title = document.createElement("strong");
    title.textContent = passage.title || "Untitled passage";
    const excerpt = document.createElement("span");
    excerpt.textContent = passage.text.slice(0, 140);
    const date = document.createElement("small");
    date.textContent = `Updated ${new Date(passage.updatedAt).toLocaleString()}`;
    button.append(title, excerpt, date);
    item.append(button);
    list.append(item);
    button.addEventListener("click", () => {
      $("library").close();
      openEditor(passage);
    });
  }
  if (!matches.length) {
    const item = document.createElement("li");
    item.textContent = query
      ? "No passages found. Try another search."
      : "Your first passage will live here.";
    list.append(item);
  }
}
function cacheDraft() {
  if (!draft) return;
  draft.title = $("title").value;
  draft.text = $("passage").value;
  try {
    if (dirty()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
    draftStorageWarning = "";
  } catch {
    draftStorageWarning =
      " Draft recovery is unavailable; download a copy before leaving.";
  }
  if (dirty()) $("save").textContent = "Save passage";
  $("draft-state").textContent =
    (dirty()
      ? "Unsaved changes. Save when you’re ready."
      : draft.baseRevision
        ? "Saved in this browser."
        : "Not saved yet.") + draftStorageWarning;
}
function openEditor(passage = null, recovered = null) {
  draft = recovered ?? {
    id: passage?.id ?? crypto.randomUUID(),
    baseRevision: passage?.revision ?? null,
    title: passage?.title ?? "",
    text: passage?.text ?? "",
  };
  $("title").value = draft.title;
  $("passage").value = draft.text;
  baseline = recovered ? JSON.stringify({ title: "", text: "" }) : snapshot();
  $("editor-heading").textContent = passage
    ? "Back at the desk."
    : "Put something on the page.";
  $("editor-error").textContent = "";
  $("save-copy").hidden = true;
  $("save").textContent = "Save passage";
  // A failed cache write may leave an older copy behind. Never promise that
  // recovery includes the latest edits, even when storage works again now.
  $("recovery-note").hidden = !recovered;
  $("editor").showModal();
  cacheDraft();
  $("passage").focus();
}
function closeEditor() {
  if (saving) return;
  if (
    dirty() &&
    !window.confirm(
      "Discard these unsaved changes? Cancel to keep writing or download your draft.",
    )
  )
    return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* In-memory draft remains until explicitly discarded. */
  }
  draft = null;
  $("editor").close();
}
async function goWrite() {
  if (walking || $("editor").open) return;
  walking = true;
  $("desk").disabled = true;
  $("start").disabled = true;
  $("room-caption").textContent = "Walking to the desk…";
  const player = $("player");
  if (
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !player.classList.contains("at-desk")
  ) {
    // Two relaxed strides, eight whole-body poses per stride.
    const strideDuration = 800;
    player.classList.add("is-walking");
    const motion = player.animate(
      [
        { left: "53%", top: "79%" },
        { left: "39%", top: "66%" },
      ],
      { duration: strideDuration * 2, easing: "linear", fill: "forwards" },
    );
    const poses = player.querySelector(".walk-sheet").animate(
      Array.from({ length: 8 }, (_, frame) => ({
        backgroundPosition: `${(frame % 4) * (100 / 3)}% ${frame < 4 ? 0 : 100}%`,
        // The first column's head is 32 atlas pixels farther right.
        transform: `translateX(${frame % 4 === 0 ? 0 : 100 / 12}%)`,
        offset: frame / 8,
        easing: "steps(1, end)",
      })),
      {
        duration: strideDuration,
        iterations: 2,
        fill: "forwards",
      },
    );
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const finishEarly = () => {
      if (reducedMotion.matches) motion.finish();
    };
    reducedMotion.addEventListener("change", finishEarly);
    try {
      await motion.finished;
    } catch {
      // If interrupted, settle at the destination and keep the desk usable.
    } finally {
      reducedMotion.removeEventListener("change", finishEarly);
      player.classList.add("at-desk");
      player.classList.remove("is-walking");
      motion.cancel();
      poses.cancel();
    }
  }
  player.classList.add("at-desk");
  walking = false;
  $("desk").disabled = false;
  $("start").disabled = false;
  $("room-caption").textContent = "Fresh page.";
  openEditor();
}
$("desk").addEventListener("click", goWrite);
$("start").addEventListener("click", goWrite);
$("close-editor").addEventListener("click", closeEditor);
$("editor").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeEditor();
});
$("title").addEventListener("input", cacheDraft);
$("passage").addEventListener("input", cacheDraft);
$("writing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving || !draft || (!dirty() && draft.baseRevision !== null)) return;
  $("editor-error").textContent = "";
  if (!$("passage").value.trim()) {
    $("editor-error").textContent = "Add a few words before saving.";
    $("passage").focus();
    return;
  }
  cacheDraft();
  saving = true;
  $("save").disabled = true;
  $("save-copy").disabled = true;
  $("title").readOnly = true;
  $("passage").readOnly = true;
  try {
    if (!navigator.locks)
      throw new Error(
        "Safe saving needs a browser with Web Locks on HTTPS or localhost. Your draft is still here; download it to keep a copy.",
      );
    const result = await navigator.locks.request(STORAGE_KEY, () =>
      savePassage(storage, draft),
    );
    draft.baseRevision = result.passage.revision;
    baseline = snapshot();
    $("recovery-note").hidden = true;
    notebook = result.data;
    renderNotebook();
    cacheDraft();
    $("save-copy").hidden = true;
    $("save").textContent = "Saved ✓";
    $("draft-state").textContent =
      (result.first
        ? "First quest done. Your notebook is on the desk now."
        : "Saved.") + draftStorageWarning;
    announce(
      result.first
        ? "First quest done. You unlocked your notebook."
        : "Passage saved in your notebook.",
    );
  } catch (error) {
    $("editor-error").textContent = error.message;
    $("save-copy").hidden = !(error instanceof Conflict);
  } finally {
    saving = false;
    $("save").disabled = false;
    $("save-copy").disabled = false;
    $("title").readOnly = false;
    $("passage").readOnly = false;
  }
});
$("save-copy").addEventListener("click", () => {
  draft.id = crypto.randomUUID();
  draft.baseRevision = null;
  cacheDraft();
  $("writing-form").requestSubmit();
});
$("download-draft").addEventListener("click", () => {
  const now = new Date().toISOString();
  download(
    toMarkdown([
      {
        title: $("title").value,
        text: $("passage").value,
        createdAt: now,
        updatedAt: now,
      },
    ]),
    "side-quest-draft.md",
  );
});
function resetSearch() {
  $("passage-search").value = "";
  refresh();
}
function openLibrary() {
  resetSearch();
  $("library").showModal();
}
// Coalesce typing bursts, then re-read so failed reads cannot revive stale entries.
$("passage-search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 150);
});
$("notebook").addEventListener("click", openLibrary);
$("clear-search").addEventListener("click", () => {
  resetSearch();
  $("passage-search").focus();
});
$("collection").addEventListener("click", openLibrary);
$("close-library").addEventListener("click", () => $("library").close());
$("new-passage").addEventListener("click", () => {
  $("library").close();
  openEditor();
});
$("backup").addEventListener("click", () => {
  if (refresh()) {
    if (!notebook.passages.length) {
      announce(
        "Your notebook is waiting for its first passage. Use Download draft in the writing panel to keep unsaved words.",
      );
      return;
    }
    download(toMarkdown(notebook.passages), "side-quest-notebook.md");
  } else {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null)
        download(raw, "side-quest-recovery.json", "application/json");
    } catch {
      announce(
        "Browser storage cannot be accessed. Any open draft can still be downloaded from the writing panel.",
      );
    }
  }
});
window.addEventListener("beforeunload", (event) => {
  if (dirty() || saving) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    if (refresh())
      announce(
        "Browser storage changed in another tab. Open drafts are preserved; saves check for conflicts.",
      );
  }
});
refresh();
try {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (raw) {
    const recovered = JSON.parse(raw);
    if (
      typeof recovered.id !== "string" ||
      !recovered.id ||
      typeof recovered.title !== "string" ||
      typeof recovered.text !== "string" ||
      !(
        recovered.baseRevision === null ||
        (Number.isInteger(recovered.baseRevision) && recovered.baseRevision > 0)
      )
    )
      throw new Error();
    openEditor(null, recovered);
  }
} catch {
  announce(
    "Draft recovery is unavailable. Saved passages are separate; download new drafts before leaving.",
  );
}

const darkScheme = matchMedia("(prefers-color-scheme: dark)");
const phaseOverride = new URLSearchParams(location.search).get("phase");
function updatePhase() {
  const date = new Date();
  const phase = resolvePhase({
    date,
    prefersDark: darkScheme.matches,
    override: phaseOverride,
  });
  document.documentElement.dataset.phase = phase;
  $("clock-time").textContent = date
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  $("clock-phase").textContent = PHASE_LABELS[phase];
}
updatePhase();
darkScheme.addEventListener("change", updatePhase);
setInterval(updatePhase, 30_000);
