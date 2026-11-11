export const STORAGE_KEY = "side-quest-studio.notebook.v1";
export const DRAFT_KEY = "side-quest-studio.draft.v1";
export class StorageProblem extends Error {}
export class Conflict extends Error {}
const validDate = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const notebookConfig = {
  key: STORAGE_KEY,
  collection: "passages",
  noun: "notebook",
  item: "passage",
  fields: ["title", "text"],
  required: "text",
  empty: "Add a few words before saving.",
};
export const LOG_STORAGE_KEY = "side-quest-studio.logbook.v1";
export const LOG_DRAFT_KEY = "side-quest-studio.log-draft.v1";
const logConfig = {
  key: LOG_STORAGE_KEY,
  collection: "entries",
  noun: "logbook",
  item: "entry",
  fields: ["project", "text", "next"],
  required: "text",
  empty: "Add what you worked on before saving.",
};
function parseCollection(raw, config) {
  if (raw === null) return { version: 1, [config.collection]: [] };
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data[config.collection]))
      throw new Error();
    const ids = new Set();
    for (const p of data[config.collection]) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id ||
        ids.has(p.id) ||
        config.fields.some((field) => typeof p[field] !== "string") ||
        !p[config.required].trim() ||
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
      `Your saved ${config.noun} could not be read. It has not been changed. Download the stored data for recovery before changing browser storage.`,
    );
  }
}
function readCollection(storage, config) {
  let raw;
  try {
    raw = storage.getItem(config.key);
  } catch {
    throw new StorageProblem(
      "Browser storage is unavailable. Keep this page open and download your draft to keep your words.",
    );
  }
  return parseCollection(raw, config);
}
// Caller holds the browser-wide Web Lock during the entire read/modify/write.
function saveRecord(storage, draft, config, now) {
  if (typeof draft.id !== "string" || !draft.id)
    throw new Error(
      `This draft has an invalid identifier. Download its text before starting a new ${config.item}.`,
    );
  if (config.fields.some((field) => typeof draft[field] !== "string"))
    throw new Error(
      "This draft has invalid fields. Download it before starting again.",
    );
  if (!draft[config.required].trim()) throw new Error(config.empty);
  const data = readCollection(storage, config);
  const existing = data[config.collection].find((p) => p.id === draft.id);
  if ((existing?.revision ?? null) !== draft.baseRevision)
    throw new Conflict(
      `This ${config.item} changed in another tab. Your draft is still here. Save it as a new ${config.item} to keep both versions.`,
    );
  if (
    existing &&
    config.fields.every((field) => existing[field] === draft[field])
  )
    return { passage: existing, data, first: false };
  const passage = {
    id: draft.id,
    ...Object.fromEntries(config.fields.map((field) => [field, draft[field]])),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revision: (existing?.revision ?? 0) + 1,
  };
  const first = data[config.collection].length === 0;
  data[config.collection] = existing
    ? data[config.collection].map((p) => (p.id === passage.id ? passage : p))
    : [...data[config.collection], passage];
  try {
    storage.setItem(config.key, JSON.stringify(data));
  } catch {
    throw new StorageProblem(
      "Could not save: browser storage is full or unavailable. Your draft is still here. Download it now, or free space and try again.",
    );
  }
  return { passage, data, first };
}
export const parseNotebook = (raw) => parseCollection(raw, notebookConfig);
export const readNotebook = (storage) =>
  readCollection(storage, notebookConfig);
export const savePassage = (storage, draft, now = new Date().toISOString()) =>
  saveRecord(storage, draft, notebookConfig, now);
export const parseLogbook = (raw) => parseCollection(raw, logConfig);
export const readLogbook = (storage) => readCollection(storage, logConfig);
export function saveLogEntry(storage, draft, now = new Date().toISOString()) {
  const { passage: entry, ...result } = saveRecord(
    storage,
    draft,
    logConfig,
    now,
  );
  return { entry, ...result };
}
// Indented verbatim blocks preserve arbitrary Markdown/HTML as writing.
export const quote = (value) =>
  value
    .split(/\r\n|\r|\n/)
    .map((line) => `    ${line}`)
    .join("\n");
export function logToMarkdown(entries) {
  return (
    "# Side Quest Studio — Your logbook\n\n" +
    entries
      .map(
        (p) =>
          `## Entry\n\n${quote(p.project || "Untitled project")}\n\nCreated: ${p.createdAt}\nUpdated: ${p.updatedAt}\n\n### What I worked on\n\n${quote(p.text)}\n\n### Next step\n\n${quote(p.next)}\n`,
      )
      .join("\n---\n\n")
  );
}
export function toMarkdown(passages) {
  return (
    "# Side Quest Studio — Your notebook\n\n" +
    passages
      .map((p) => {
        return `## Passage\n\n${quote(p.title || "Untitled passage")}\n\nCreated: ${p.createdAt}\nUpdated: ${p.updatedAt}\n\n${quote(p.text)}\n`;
      })
      .join("\n---\n\n")
  );
}
