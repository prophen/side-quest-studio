export const STORAGE_KEY = "side-quest-studio.notebook.v1";
export const DRAFT_KEY = "side-quest-studio.draft.v1";
export class StorageProblem extends Error {}
export class Conflict extends Error {}
const validDate = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
export function parseNotebook(raw) {
  if (raw === null) return { version: 1, passages: [] };
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.passages)) throw new Error();
    const ids = new Set();
    for (const p of data.passages) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id ||
        ids.has(p.id) ||
        typeof p.title !== "string" ||
        typeof p.text !== "string" ||
        !p.text.trim() ||
        !validDate(p.createdAt) ||
        !validDate(p.updatedAt) ||
        !Number.isInteger(p.revision) ||
        p.revision < 1
      )
        throw new Error();
      ids.add(p.id);
    }
    return data;
  } catch {
    throw new StorageProblem(
      "Your saved notebook could not be read. It has not been changed. Download the stored data for recovery before changing browser storage.",
    );
  }
}
export function readNotebook(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    throw new StorageProblem(
      "Browser storage is unavailable. Keep this page open and download your draft to keep your words.",
    );
  }
  return parseNotebook(raw);
}
// Caller holds the browser-wide Web Lock during the entire read/modify/write.
export function savePassage(storage, draft, now = new Date().toISOString()) {
  if (!draft.text.trim()) throw new Error("Add a few words before saving.");
  const data = readNotebook(storage);
  const existing = data.passages.find((p) => p.id === draft.id);
  if ((existing?.revision ?? null) !== draft.baseRevision)
    throw new Conflict(
      "This passage changed in another tab. Your draft is still here. Save it as a new passage to keep both versions.",
    );
  if (
    existing &&
    existing.title === draft.title &&
    existing.text === draft.text
  )
    return { passage: existing, data, first: false };
  const passage = {
    id: draft.id,
    title: draft.title,
    text: draft.text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revision: (existing?.revision ?? 0) + 1,
  };
  const first = data.passages.length === 0;
  data.passages = existing
    ? data.passages.map((p) => (p.id === passage.id ? passage : p))
    : [...data.passages, passage];
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new StorageProblem(
      "Could not save: browser storage is full or unavailable. Your draft is still here. Download it now, or free space and try again.",
    );
  }
  return { passage, data, first };
}
export function toMarkdown(passages) {
  return (
    "# Side Quest Studio — Your notebook\n\n" +
    passages
      .map((p) => {
        // Indented verbatim blocks preserve arbitrary Markdown/HTML as writing, not markup.
        const quote = (value) =>
          value
            .split(/\r?\n/)
            .map((line) => `    ${line}`)
            .join("\n");
        return `## Passage\n\n${quote(p.title || "Untitled passage")}\n\nCreated: ${p.createdAt}\nUpdated: ${p.updatedAt}\n\n${quote(p.text)}\n`;
      })
      .join("\n---\n\n")
  );
}
