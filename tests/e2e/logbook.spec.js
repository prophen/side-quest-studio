import { test, expect } from "@playwright/test";
const key = "side-quest-studio.logbook.v1";
const draftKey = "side-quest-studio.log-draft.v1";
const notebookKey = "side-quest-studio.notebook.v1";
async function open(page) {
  await page.locator("#workbench").click();
  await expect(page.locator("#log-editor")).toBeVisible();
}
async function save(page) {
  await page.locator("#log-save").click();
  await expect(page.locator("#log-save")).toHaveText("Saved ✓");
}
async function downloadText(page, button, filename) {
  const pending = page.waitForEvent("download");
  await page.locator(button).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe(filename);
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});
test("keyboard workbench, validation, unlock once, reload, edit and literal export", async ({
  page,
}) => {
  await page.locator("#workbench").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("What I worked on")).toBeFocused();
  await page.getByLabel("What I worked on").fill("  \n ");
  await page.locator("#log-save").click();
  await expect(page.locator("#log-error")).toContainText("Add what");
  await page
    .getByLabel("What I worked on")
    .fill("<script>window.pwned=true</script>");
  await page.getByLabel("Next step (optional)").fill("# Try tomorrow");
  await save(page);
  await page.locator("#log-save").dblclick();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).entries.length,
      key,
    ),
  ).toBe(1);
  expect(
    await page.evaluate((k) => localStorage.getItem(k), notebookKey),
  ).toBeNull();
  await page.locator("#log-close").click();
  await page.reload();
  await expect(page.locator("#logbook")).toBeVisible();
  await page.locator("#logbook").click();
  await expect(page.locator("#log-list")).toContainText("Created");
  await expect(page.locator("#log-list script")).toHaveCount(0);
  await page.locator("#log-list button").click();
  await expect(page.getByLabel("Next step (optional)")).toHaveValue(
    "# Try tomorrow",
  );
  await page.getByLabel("Project name (optional)").fill("<img src=x>");
  await save(page);
  await page.locator("#log-close").click();
  await page.locator("#logbook").click();
  const md = await downloadText(page, "#log-backup", "side-quest-logbook.md");
  expect(md).toContain("    <img src=x>");
  expect(md).toContain("    <script>window.pwned=true</script>");
  expect(md).toContain("    # Try tomorrow");
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});
test("log draft recovers into its own panel with warning until saved", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("What I worked on").fill("Version A");
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === k) throw new Error("Full");
      return set.call(this, key, value);
    };
  }, draftKey);
  await page.getByLabel("What I worked on").fill("Version B");
  await expect(page.locator("#log-state")).toContainText(
    "recovery is unavailable",
  );
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.locator("#editor")).toBeHidden();
  await expect(page.getByLabel("What I worked on")).toHaveValue("Version A");
  await expect(page.locator("#log-recovery")).toBeVisible();
  await page.getByLabel("What I worked on").fill("Recovered");
  await expect(page.locator("#log-recovery")).toBeVisible();
  await save(page);
  await expect(page.locator("#log-recovery")).toBeHidden();
});
for (const failure of ["corrupt", "unavailable"]) {
  test(`logbook replaces loaded entries after ${failure} reads`, async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel("What I worked on").fill("Saved progress");
    await save(page);
    await page.locator("#log-close").click();
    await page.locator("#logbook").click();
    await expect(page.locator("#log-list button")).toHaveCount(1);
    await page.evaluate(
      ({ key, failure }) => {
        if (failure === "corrupt") localStorage.setItem(key, "{bad");
        else
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new Error("Denied");
            },
          });
        dispatchEvent(new StorageEvent("storage", { key }));
      },
      { key, failure },
    );
    await expect(page.locator("#log-list button")).toHaveCount(0);
    await expect(page.locator("#log-list [role=alert]")).toContainText(
      failure === "corrupt" ? "could not be read" : "unavailable",
    );
    if (failure === "corrupt")
      expect(
        await downloadText(page, "#log-backup", "side-quest-log-recovery.json"),
      ).toBe("{bad");
    await page.locator("#log-new").click();
    await page.getByLabel("What I worked on").fill("Keep me");
    await page.locator("#log-save").click();
    await expect(page.getByLabel("What I worked on")).toHaveValue("Keep me");
    await expect(page.locator("#log-error")).toContainText(
      failure === "corrupt" ? "has not been changed" : "unavailable",
    );
    expect(
      await downloadText(page, "#log-draft", "side-quest-log-draft.md"),
    ).toContain("    Keep me");
  });
}
test("quota failures and absent Web Locks retain downloadable drafts", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("What I worked on").fill("Keep this progress");
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === k) throw new Error("Full");
      return set.call(this, key, value);
    };
  }, key);
  await page.locator("#log-save").click();
  await expect(page.locator("#log-error")).toContainText("full or unavailable");
  expect(
    await downloadText(page, "#log-draft", "side-quest-log-draft.md"),
  ).toContain("Keep this progress");
  page.once("dialog", (d) => d.accept());
  await page.locator("#log-close").click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "locks", { value: undefined }),
  );
  await open(page);
  await expect(page.locator("#log-save")).toBeDisabled();
  await expect(page.locator("#log-error")).toContainText("Web Locks");
  await page.getByLabel("What I worked on").fill("Download without locks");
  expect(
    await downloadText(page, "#log-draft", "side-quest-log-draft.md"),
  ).toContain("Download without locks");
});
test("simultaneous log saves merge and stale edits can keep both versions", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await other.goto("/");
  for (const [tab, text] of [
    [page, "First"],
    [other, "Second"],
  ]) {
    await open(tab);
    await tab.getByLabel("What I worked on").fill(text);
  }
  await Promise.all([save(page), save(other)]);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).entries.length,
      key,
    ),
  ).toBe(2);
  for (const tab of [page, other]) {
    await tab.locator("#log-close").click();
    await tab.locator("#logbook").click();
    await tab.locator("#log-list button").filter({ hasText: "First" }).click();
  }
  await page.getByLabel("What I worked on").fill("Changed first");
  await save(page);
  await other.getByLabel("What I worked on").fill("Changed second");
  await other.locator("#log-save").click();
  await expect(other.locator("#log-error")).toContainText(
    "changed in another tab",
  );
  await other.locator("#log-copy").click();
  await expect(other.locator("#log-save")).toHaveText("Saved ✓");
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).entries.map((e) => e.text),
      key,
    ),
  ).toEqual(
    expect.arrayContaining(["Changed first", "Changed second", "Second"]),
  );
});
test("walks right from desk and left back from workbench", async ({ page }) => {
  await page.locator("#desk").click();
  await page.locator("#close-editor").click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("#workbench").click();
  await expect(page.locator("#player")).toHaveClass(/facing-right/);
  await expect(page.locator("#log-editor")).toBeVisible();
  await expect(page.locator("#player")).toHaveClass("player at-workbench");
  await page.locator("#log-close").click();
  await page.locator("#desk").click();
  await expect(page.locator("#player")).not.toHaveClass(/facing-right/);
  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#player")).toHaveClass("player at-desk");
});
for (const [width, height] of [
  [390, 320],
  [800, 380],
  [1440, 1000],
]) {
  test(`log save and room controls fit ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    expect(
      await page
        .locator("#player")
        .evaluate((p) => p.getAnimations({ subtree: true }).length),
    ).toBe(0);
    await page.getByLabel("What I worked on").fill("Progress\n".repeat(40));
    for (const id of ["#log-save", "#log-draft"]) {
      const box = await page.locator(id).boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await save(page);
    await page.locator("#log-close").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const collisions = await page.evaluate(() =>
      [...document.querySelectorAll(".quest")].flatMap((q) =>
        ["#desk", "#notebook", "#workbench", "#logbook", ".board"].filter(
          (sel) => {
            const a = q.getBoundingClientRect(),
              b = document.querySelector(sel).getBoundingClientRect();
            return !(
              b.right <= a.left ||
              b.left >= a.right ||
              b.bottom <= a.top ||
              b.top >= a.bottom
            );
          },
        ),
      ),
    );
    expect(collisions).toEqual([]);
    await page.screenshot({
      path: `test-results/logbook-${width}.png`,
      fullPage: true,
    });
  });
}

test("corrupt logs on first load still offer raw recovery", async ({
  page,
}) => {
  await page.evaluate((k) => localStorage.setItem(k, "{broken"), key);
  await page.reload();
  await page.locator("#log-collection").click();
  await expect(page.locator("#log-list button")).toHaveCount(0);
  expect(
    await downloadText(page, "#log-backup", "side-quest-log-recovery.json"),
  ).toBe("{broken");
});

test("independent draft caches recover in their respective panels", async ({
  page,
}) => {
  await page.evaluate(
    ({ draftKey }) => {
      sessionStorage.setItem(
        "side-quest-studio.draft.v1",
        JSON.stringify({
          id: "writing-draft",
          title: "",
          text: "Writing cache",
          baseRevision: null,
        }),
      );
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          id: "log-draft",
          project: "",
          text: "Log cache",
          next: "",
          baseRevision: null,
        }),
      );
    },
    { draftKey },
  );
  await page.reload();
  await expect(page.getByLabel("Your passage")).toHaveValue("Writing cache");
  await expect(page.locator("#log-editor")).toBeHidden();
  await page.locator("#save").click();
  await expect(page.locator("#save")).toHaveText("Saved ✓");
  await page.locator("#close-editor").click();
  await expect(page.getByLabel("What I worked on")).toHaveValue("Log cache");
  await expect(page.locator("#log-recovery")).toBeVisible();
});

test("saved entries show newest updates first and saves use the logbook lock", async ({
  page,
}) => {
  await page.evaluate((k) => {
    const entry = (id, updatedAt) => ({
      id,
      project: id,
      text: id,
      next: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt,
      revision: 1,
    });
    localStorage.setItem(
      k,
      JSON.stringify({
        version: 1,
        entries: [
          entry("Older", "2026-01-01T00:00:00Z"),
          entry("Newer", "2026-01-02T00:00:00Z"),
        ],
      }),
    );
  }, key);
  await page.locator("#log-collection").click();
  await expect(page.locator("#log-list strong")).toHaveText(["Newer", "Older"]);
  await page.locator("#log-list button").filter({ hasText: "Older" }).click();
  await page.getByLabel("What I worked on").fill("Edited older entry");
  await page.evaluate((k) => {
    window.lockTrace = [];
    const request = navigator.locks.request.bind(navigator.locks);
    const get = Storage.prototype.getItem,
      set = Storage.prototype.setItem;
    let active = false;
    navigator.locks.request = (name, callback) =>
      request(name, async (lock) => {
        window.lockTrace.push(name);
        active = true;
        try {
          return await callback(lock);
        } finally {
          active = false;
          window.lockTrace.push("released");
        }
      });
    Storage.prototype.getItem = function (key) {
      if (key === k && active) window.lockTrace.push("read");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === k) window.lockTrace.push(active ? "write" : "unlocked-write");
      return set.call(this, key, value);
    };
  }, key);
  await save(page);
  expect(await page.evaluate(() => window.lockTrace)).toEqual([
    key,
    "read",
    "write",
    "released",
  ]);
  await page.locator("#log-close").click();
  await page.locator("#log-collection").click();
  await expect(page.locator("#log-list strong")).toHaveText(["Older", "Newer"]);
});
