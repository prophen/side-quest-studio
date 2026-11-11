import test from "node:test";
import assert from "node:assert/strict";
import {
  LOG_STORAGE_KEY,
  STORAGE_KEY,
  savePassage,
  readNotebook,
  saveLogEntry,
  readLogbook,
  parseLogbook,
  logToMarkdown,
  toMarkdown,
  Conflict,
  StorageProblem,
} from "../src/storage.js";
const draft = (id = "a") => ({
  id,
  project: "",
  text: "Original\n<script>literal</script>",
  next: "# next",
  baseRevision: null,
});
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("logbook saves independently, preserves originals, edits revisions and avoids duplicate rewards", () => {
  const storage = memory();
  savePassage(storage, {
    id: "writing",
    title: "",
    text: "My passage",
    baseRevision: null,
  });
  const notebook = storage.getItem(STORAGE_KEY);
  const first = saveLogEntry(storage, draft(), "2026-01-01T00:00:00Z");
  assert.equal(first.first, true);
  assert.equal(first.entry.text, draft().text);
  const edit = { ...draft(), baseRevision: 1, next: "Try again" };
  const second = saveLogEntry(storage, edit, "2026-01-02T00:00:00Z");
  assert.equal(second.entry.createdAt, first.entry.createdAt);
  assert.equal(second.entry.updatedAt, "2026-01-02T00:00:00Z");
  assert.equal(second.first, false);
  assert.equal(
    saveLogEntry(storage, { ...edit, baseRevision: 2 }).entry.revision,
    2,
  );
  assert.equal(readLogbook(storage).entries.length, 1);
  assert.equal(storage.getItem(STORAGE_KEY), notebook);
  assert.equal(readNotebook(storage).passages.length, 1);
  assert.throws(() => saveLogEntry(storage, edit), Conflict);
  saveLogEntry(storage, draft("b"));
  assert.equal(readLogbook(storage).entries.length, 2);
});
test("log writes reject malformed identifiers and fields without changing stored data", () => {
  const storage = memory();
  saveLogEntry(storage, draft());
  const before = storage.getItem(LOG_STORAGE_KEY);
  for (const invalid of [
    { id: "" },
    { id: 42 },
    { text: " \n " },
    { next: null },
    { project: null },
  ]) {
    assert.throws(() => saveLogEntry(storage, { ...draft("b"), ...invalid }));
    assert.equal(storage.getItem(LOG_STORAGE_KEY), before);
  }
});
test("corrupt, unsupported, duplicate and invalid log data cannot be overwritten", () => {
  const storage = memory();
  const { entry } = saveLogEntry(storage, draft());
  for (const raw of [
    "{broken",
    '{"version":2,"entries":[]}',
    JSON.stringify({ version: 1, entries: [entry, entry] }),
    JSON.stringify({ version: 1, entries: [{ ...entry, next: null }] }),
  ]) {
    let writes = 0;
    assert.throws(() => parseLogbook(raw), StorageProblem);
    assert.throws(
      () =>
        saveLogEntry({ getItem: () => raw, setItem: () => writes++ }, draft()),
      StorageProblem,
    );
    assert.equal(writes, 0);
  }
});
test("read and quota failures preserve caller draft; export quotes every free-text field", () => {
  const d = draft();
  const before = structuredClone(d);
  assert.throws(
    () =>
      saveLogEntry(
        {
          getItem() {
            throw new Error();
          },
        },
        d,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      saveLogEntry(
        {
          getItem: () => null,
          setItem() {
            throw new Error();
          },
        },
        d,
      ),
    /full or unavailable/,
  );
  assert.deepEqual(d, before);
  const { entry } = saveLogEntry(memory(), { ...d, project: "<img src=x>" });
  const md = logToMarkdown([entry]);
  assert.match(md, /Your logbook/);
  assert.match(md, /    <img src=x>/);
  assert.match(md, /    <script>literal/);
  assert.match(md, /    # next/);
});

test("all Markdown line endings keep log and notebook content indented without changing stored words", () => {
  const storage = memory();
  const text = "A\r<script>literal</script>\r\n# heading\n![image](x)";
  const { entry } = saveLogEntry(storage, {
    ...draft(),
    project: text,
    text,
    next: text,
  });
  const expected =
    "    A\n    <script>literal</script>\n    # heading\n    ![image](x)";
  const md = logToMarkdown([entry]);
  assert.equal(md.split(expected).length - 1, 3);
  assert.equal(md.includes("\r"), false);
  assert.equal(readLogbook(storage).entries[0].text, text);
  const { passage } = savePassage(storage, {
    id: "literal-writing",
    title: text,
    text,
    baseRevision: null,
  });
  assert.equal(toMarkdown([passage]).split(expected).length - 1, 2);
  assert.equal(readNotebook(storage).passages[0].text, text);
});
