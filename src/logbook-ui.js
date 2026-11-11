import {
  LOG_STORAGE_KEY,
  LOG_DRAFT_KEY,
  readLogbook,
  saveLogEntry,
  logToMarkdown,
  Conflict,
} from "./storage.js";

export function setupLogbook({ $, storage, download, announce, goStation }) {
  let data = { version: 1, entries: [] };
  let draft = null;
  let baseline = "";
  let saving = false;
  let cacheWarning = "";
  const fields = {
    project: $("log-project"),
    text: $("log-text"),
    next: $("log-next"),
  };
  const values = () =>
    Object.fromEntries(
      Object.entries(fields).map(([key, input]) => [key, input.value]),
    );
  const snapshot = () => JSON.stringify(values());
  const dirty = () => draft !== null && snapshot() !== baseline;
  function refresh() {
    try {
      data = readLogbook(storage);
      const unlocked = data.entries.length > 0;
      $("logbook").hidden = !unlocked;
      $("log-reward").hidden = unlocked;
      $("log-backup").textContent = "Download logbook";
      const items = [...data.entries]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .map((entry) => {
          const li = document.createElement("li");
          const button = document.createElement("button");
          button.className = "passage-item";
          const title = document.createElement("strong");
          title.textContent = entry.project || "Untitled project";
          const text = document.createElement("span");
          text.textContent = entry.text.slice(0, 140);
          const dates = document.createElement("small");
          dates.textContent = `Created ${new Date(entry.createdAt).toLocaleString()} · Updated ${new Date(entry.updatedAt).toLocaleString()}`;
          button.append(title, text, dates);
          button.addEventListener("click", () => {
            $("log-library").close();
            open(entry);
          });
          li.append(button);
          return li;
        });
      if (!items.length) {
        const li = document.createElement("li");
        li.textContent = "Your first bit of progress will live here.";
        items.push(li);
      }
      $("log-list").replaceChildren(...items);
      return true;
    } catch (error) {
      const li = document.createElement("li");
      li.className = "error";
      li.setAttribute("role", "alert");
      li.textContent = error.message;
      $("log-list").replaceChildren(li);
      $("log-backup").textContent = "Download stored log data";
      announce(error.message);
      return false;
    }
  }
  function cache() {
    if (!draft) return;
    Object.assign(draft, values());
    try {
      if (dirty()) sessionStorage.setItem(LOG_DRAFT_KEY, JSON.stringify(draft));
      else sessionStorage.removeItem(LOG_DRAFT_KEY);
      cacheWarning = "";
    } catch {
      cacheWarning =
        " Draft recovery is unavailable; download a copy before leaving.";
    }
    if (dirty()) $("log-save").textContent = "Save entry";
    $("log-state").textContent =
      (dirty()
        ? "Unsaved changes. Save when you’re ready."
        : draft.baseRevision
          ? "Saved in this browser."
          : "Not saved yet.") + cacheWarning;
  }
  function open(entry = null, recovered = null) {
    draft = recovered ?? {
      id: entry?.id ?? crypto.randomUUID(),
      baseRevision: entry?.revision ?? null,
      project: entry?.project ?? "",
      text: entry?.text ?? "",
      next: entry?.next ?? "",
    };
    for (const [key, input] of Object.entries(fields)) input.value = draft[key];
    baseline = recovered ? "" : snapshot();
    $("log-recovery").hidden = !recovered;
    $("log-error").textContent = navigator.locks
      ? ""
      : "Safe saving needs a browser with Web Locks on HTTPS or localhost. Download your draft to keep a copy.";
    $("log-save").disabled = !navigator.locks;
    $("log-copy").hidden = true;
    $("log-save").textContent = "Save entry";
    $("log-editor").showModal();
    cache();
    fields.text.focus();
  }
  function close() {
    if (saving) return;
    if (
      dirty() &&
      !window.confirm(
        "Discard these unsaved changes? Cancel to keep writing or download your draft.",
      )
    )
      return;
    try {
      sessionStorage.removeItem(LOG_DRAFT_KEY);
    } catch {
      /* Explicit discard only. */
    }
    draft = null;
    $("log-editor").close();
  }
  for (const input of Object.values(fields))
    input.addEventListener("input", cache);
  $("log-close").addEventListener("click", close);
  $("log-editor").addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  const goLog = () => goStation("workbench", () => open());
  $("workbench").addEventListener("click", goLog);
  $("log-start").addEventListener("click", goLog);
  const library = () => {
    refresh();
    $("log-library").showModal();
  };
  $("logbook").addEventListener("click", library);
  $("log-collection").addEventListener("click", library);
  $("log-library-close").addEventListener("click", () =>
    $("log-library").close(),
  );
  $("log-new").addEventListener("click", () => {
    $("log-library").close();
    open();
  });
  $("log-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || !draft || (!dirty() && draft.baseRevision !== null)) return;
    if (!fields.text.value.trim()) {
      $("log-error").textContent = "Add what you worked on before saving.";
      fields.text.focus();
      return;
    }
    cache();
    saving = true;
    $("log-save").disabled = $("log-copy").disabled = true;
    for (const input of Object.values(fields)) input.readOnly = true;
    try {
      if (!navigator.locks)
        throw new Error(
          "Safe saving needs Web Locks on HTTPS or localhost. Download your draft to keep a copy.",
        );
      const result = await navigator.locks.request(LOG_STORAGE_KEY, () =>
        saveLogEntry(storage, draft),
      );
      draft.baseRevision = result.entry.revision;
      baseline = snapshot();
      $("log-recovery").hidden = true;
      $("log-error").textContent = "";
      $("log-copy").hidden = true;
      refresh();
      cache();
      $("log-save").textContent = "Saved ✓";
      $("log-state").textContent =
        (result.first
          ? "First log saved. Your logbook is beside the computer now."
          : "Saved in your logbook.") + cacheWarning;
      announce(
        result.first
          ? "You unlocked your logbook."
          : "Entry saved in your logbook.",
      );
    } catch (error) {
      $("log-error").textContent = error.message;
      $("log-copy").hidden = !(error instanceof Conflict);
    } finally {
      saving = false;
      $("log-save").disabled = !navigator.locks;
      $("log-copy").disabled = false;
      for (const input of Object.values(fields)) input.readOnly = false;
    }
  });
  $("log-copy").addEventListener("click", () => {
    draft.id = crypto.randomUUID();
    draft.baseRevision = null;
    cache();
    $("log-form").requestSubmit();
  });
  $("log-draft").addEventListener("click", () => {
    const now = new Date().toISOString();
    download(
      logToMarkdown([{ ...values(), createdAt: now, updatedAt: now }]),
      "side-quest-log-draft.md",
    );
  });
  $("log-backup").addEventListener("click", () => {
    if (refresh())
      download(logToMarkdown(data.entries), "side-quest-logbook.md");
    else {
      try {
        const raw = storage.getItem(LOG_STORAGE_KEY);
        if (raw !== null)
          download(raw, "side-quest-log-recovery.json", "application/json");
      } catch {
        announce(
          "Browser storage cannot be accessed. Download any open log draft from its panel.",
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
    if (event.key === LOG_STORAGE_KEY || event.key === null) refresh();
  });
  refresh();
  // Defer recovery until the writing editor has restored its own independent cache.
  queueMicrotask(() => {
    try {
      const raw = sessionStorage.getItem(LOG_DRAFT_KEY);
      if (!raw) return;
      const recovered = JSON.parse(raw);
      if (
        typeof recovered.id !== "string" ||
        !recovered.id ||
        Object.keys(fields).some((key) => typeof recovered[key] !== "string") ||
        !(
          recovered.baseRevision === null ||
          (Number.isInteger(recovered.baseRevision) &&
            recovered.baseRevision > 0)
        )
      )
        throw new Error();
      if ($("editor").open)
        $("editor").addEventListener("close", () => open(null, recovered), {
          once: true,
        });
      else open(null, recovered);
    } catch {
      announce(
        "Log draft recovery is unavailable. Saved entries are separate; download new drafts before leaving.",
      );
    }
  });
}
