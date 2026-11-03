import { test, expect } from "@playwright/test";
const key = "side-quest-studio.notebook.v1";
async function write(page, text = "A small beginning.\nA second line.") {
  await page.getByRole("button", { name: /Let’s write/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Put something on the page." }),
  ).toBeVisible();
  await page.getByLabel("Title (optional)").fill("My first page");
  await page.getByLabel("Your passage").fill(text);
}
async function save(page) {
  await page.getByRole("button", { name: "Save passage", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
}
test("desk journey, save once, reload, edit, new passage and readable backup", async ({
  page,
}) => {
  await page.goto("/");
  await write(page);
  await expect(page.locator("#player")).toHaveClass(/at-desk/);
  await save(page);
  await page.getByRole("button", { name: "Saved ✓" }).dblclick();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).passages.length,
      key,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open notebook", exact: true })
    .click();
  await page.getByRole("button", { name: /My first page/ }).click();
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "A small beginning.\nA second line.",
  );
  await page.getByLabel("Your passage").fill("A revised beginning.");
  await save(page);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  await page.getByRole("button", { name: "Open your notebook" }).click();
  await page.getByRole("button", { name: "Write a new passage" }).click();
  await page.getByLabel("Your passage").fill("Another little idea.");
  await save(page);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download writing" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("side-quest-notebook.md");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const content = Buffer.concat(chunks).toString();
  expect(content).toContain("My first page");
  expect(content).toContain("A revised beginning.");
  expect(content).toContain("Another little idea.");
});
test("whitespace rejected and unsaved draft survives reload and cancelled close", async ({
  page,
}) => {
  await page.goto("/");
  await write(page, "  \n  ");
  await page.getByRole("button", { name: "Save passage" }).click();
  await expect(page.getByRole("alert")).toContainText("Add a few words");
  await page.getByLabel("Your passage").fill("Keep these unsaved words");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Close writing panel" }).click();
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "Keep these unsaved words",
  );
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "Keep these unsaved words",
  );
  await save(page);
});
test("quota failure retains draft and offers a working draft download", async ({
  page,
}) => {
  await page.goto("/");
  await write(page);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.includes("notebook"))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await page.getByRole("button", { name: "Save passage" }).click();
  await expect(page.getByRole("alert")).toContainText("full or unavailable");
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "A small beginning.\nA second line.",
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download draft" }).click();
  expect((await pending).suggestedFilename()).toBe("side-quest-draft.md");
});
test("corrupt storage stays intact and can be downloaded", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => localStorage.setItem(k, "{bad"), key);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("could not be read");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download stored data" }).click();
  expect((await pending).suggestedFilename()).toBe("side-quest-recovery.json");
  await write(page);
  await page.getByRole("button", { name: "Save passage" }).click();
  await expect(page.getByRole("alert")).toContainText("has not been changed");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe("{bad");
});
test("storage unavailable keeps writing usable without claiming a save", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("unavailable");
  await write(page);
  await page.getByRole("button", { name: "Save passage" }).click();
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "A small beginning.\nA second line.",
  );
});
test("simultaneous tabs merge new passages and preserve conflicting edits", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await write(page, "First tab");
  await write(other, "Second tab");
  await Promise.all([save(page), save(other)]);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).passages.length,
      key,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  await other.getByRole("button", { name: "Close writing panel" }).click();
  for (const tab of [page, other]) {
    await tab.getByRole("button", { name: "Open your notebook" }).click();
    await tab.getByRole("button", { name: /My first page First tab/ }).click();
  }
  await page.getByLabel("Your passage").fill("Changed by first tab");
  await save(page);
  await other.getByLabel("Your passage").fill("Changed by second tab");
  await other
    .getByRole("button", { name: "Save passage", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  await other.getByRole("button", { name: "Save as a new passage" }).click();
  await expect(other.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  const texts = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).passages.map((p) => p.text),
    key,
  );
  expect(texts).toEqual(
    expect.arrayContaining([
      "Changed by first tab",
      "Changed by second tab",
      "Second tab",
    ]),
  );
});
test("safe text rendering, keyboard dialog, reduced motion, mobile layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#desk").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your passage")).toBeFocused();
  await page
    .getByLabel("Title (optional)")
    .fill("<img src=x onerror=alert(1)>");
  await page
    .getByLabel("Your passage")
    .fill("<script>window.pwned=true</script>");
  await save(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open your notebook" }).click();
  await expect(page.locator("#passage-list img")).toHaveCount(0);
  await expect(page.locator("#passage-list")).toContainText("<img src=x");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-studio.png",
    fullPage: true,
  });
});
test("desktop studio visual and no missing assets", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.locator(".room-art")).toBeVisible();
  expect(
    await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.every((i) => i.complete && i.naturalWidth > 0),
      ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/desktop-studio.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("missing safe-save support retains the draft", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "locks", { value: undefined }),
  );
  await page.goto("/");
  await write(page, "Keep a copy of this.");
  await page.getByRole("button", { name: "Save passage" }).click();
  await expect(page.getByRole("alert")).toContainText("Web Locks");
  await expect(page.getByLabel("Your passage")).toHaveValue(
    "Keep a copy of this.",
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

test("unavailable draft cache warns without blocking durable saves", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await write(page);
  await expect(page.locator("#draft-state")).toContainText(
    "Draft recovery is unavailable",
  );
  await save(page);
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).passages.length,
      key,
    ),
  ).toBe(1);
});
