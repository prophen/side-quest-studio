import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNotebook,
  savePassage,
  readNotebook,
  toMarkdown,
  Conflict,
  StorageProblem,
} from "../src/storage.js";
const memory = () => {
  let raw = null;
  return {
    getItem: () => raw,
    setItem: (_, v) => {
      raw = v;
    },
  };
};
const draft = (id = "a") => ({
  id,
  title: "A beginning",
  text: "Some words.\nAnother line.",
  baseRevision: null,
});
test("rejects empty writing without a write", () => {
  const s = memory();
  assert.throws(
    () => savePassage(s, { ...draft(), text: " \n\t" }),
    /few words/,
  );
  assert.equal(s.getItem(), null);
});
test("save, reload, edit, timestamps, and idempotent repeat", () => {
  const s = memory();
  const first = savePassage(s, draft(), "2026-01-01T00:00:00Z");
  assert.equal(first.first, true);
  assert.equal(readNotebook(s).passages[0].text, draft().text);
  const edit = { ...draft(), baseRevision: 1, text: "Changed" };
  const second = savePassage(s, edit, "2026-01-02T00:00:00Z");
  assert.equal(second.first, false);
  assert.equal(second.passage.createdAt, first.passage.createdAt);
  assert.equal(second.passage.updatedAt, "2026-01-02T00:00:00Z");
  const repeat = savePassage(s, { ...edit, baseRevision: 2 });
  assert.equal(repeat.passage.revision, 2);
  assert.equal(readNotebook(s).passages.length, 1);
  assert.throws(() => savePassage(s, draft()), Conflict);
});
test("merges independent passages but rejects stale edits", () => {
  const s = memory();
  savePassage(s, draft());
  savePassage(s, draft("b"));
  savePassage(s, { ...draft(), baseRevision: 1, text: "Other tab" });
  assert.throws(
    () => savePassage(s, { ...draft(), baseRevision: 1 }),
    Conflict,
  );
  assert.equal(readNotebook(s).passages.length, 2);
});
test("corruption and future schemas are never overwritten", () => {
  for (const raw of [
    "{broken",
    '{"version":2,"passages":[]}',
    '{"version":1,"passages":[{}]}',
  ]) {
    let writes = 0;
    const s = { getItem: () => raw, setItem: () => writes++ };
    assert.throws(() => savePassage(s, draft()), StorageProblem);
    assert.equal(writes, 0);
  }
  assert.throws(
    () => parseNotebook(JSON.stringify({ version: 1, passages: [null] })),
    StorageProblem,
  );
});
test("read failures and quota failures keep caller draft intact", () => {
  const d = draft();
  const before = structuredClone(d);
  assert.throws(
    () =>
      savePassage(
        {
          getItem: () => {
            throw new Error();
          },
        },
        d,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      savePassage(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error();
          },
        },
        d,
      ),
    /full or unavailable/,
  );
  assert.deepEqual(d, before);
});
test("Markdown keeps titles, dates, multiline text and HTML as literal writing", () => {
  const s = memory();
  const { data } = savePassage(s, {
    ...draft(),
    title: "<script>hi</script>",
    text: "# title\n```\n<script>text</script>",
  });
  const md = toMarkdown(data.passages);
  assert.match(md, /    <script>hi<\/script>/);
  assert.match(md, /    # title\n    ```\n    <script>text<\/script>/);
  assert.match(md, /Created:/);
});

test("invalid draft IDs cannot corrupt an existing collection", () => {
  const s = memory();
  savePassage(s, draft());
  const before = s.getItem();
  for (const id of ["", null, undefined, 42]) {
    assert.throws(
      () => savePassage(s, { ...draft(), id }),
      /invalid identifier/,
    );
    assert.equal(s.getItem(), before);
  }
  assert.equal(readNotebook(s).passages.length, 1);
});
