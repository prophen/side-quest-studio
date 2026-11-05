import { test, expect } from "@playwright/test";

const key = "side-quest-studio.notebook.v1";
const passages = [
  { title: "Moon Garden", text: "A quiet beginning." },
  {
    title: "Far away",
    text: `${"A long synthetic passage. ".repeat(12)}Hidden MOON [star].`,
  },
  { title: "", text: "Untitled moon <b>glow</b>." },
].map((passage, i) => ({
  ...passage,
  id: `search-fixture-${i}`,
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}));

async function openNotebook(page) {
  await page.goto("/");
  await page.evaluate(
    ({ key, passages }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, passages }));
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    { key, passages },
  );
  await page.getByRole("button", { name: "Open your notebook" }).click();
}

const titles = (page) => page.locator("#passage-list strong");

test("search matches literal titles and full text, clears in order, and opens the right passage", async ({
  page,
}) => {
  await openNotebook(page);
  const search = page.getByRole("searchbox", { name: "Search passages" });
  await expect(page.locator('label[for="passage-search"]')).toBeVisible();
  await expect(titles(page)).toHaveText([
    "Untitled passage",
    "Far away",
    "Moon Garden",
  ]);
  await search.fill("  mOoN  ");
  await expect(titles(page)).toHaveCount(3);
  await expect(page.locator("#search-status")).toHaveText("3 passages found.");
  await search.fill("garden");
  await expect(titles(page)).toHaveText(["Moon Garden"]);
  await search.fill("[star]");
  await expect(titles(page)).toHaveText(["Far away"]);
  await expect(page.locator("#passage-list")).not.toContainText("Hidden MOON");
  await search.fill("<b>glow</b>");
  await expect(titles(page)).toHaveText(["Untitled passage"]);
  await expect(page.locator("#passage-list b")).toHaveCount(0);
  await search.fill(".*");
  await expect(titles(page)).toHaveCount(0);
  await expect(page.locator("#passage-list")).toHaveText(
    "No passages found. Try another search.",
  );
  await expect(search).toBeVisible();
  await expect(page.locator("#search-status")).toHaveText("0 passages found.");
  for (const query of ["", "   "]) {
    await search.fill(query);
    await expect(titles(page)).toHaveText([
      "Untitled passage",
      "Far away",
      "Moon Garden",
    ]);
  }
  await search.fill("[star]");
  await page.locator("#passage-list button").click();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("Far away");
  await expect(page.getByLabel("Your passage")).toHaveValue(passages[1].text);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open notebook", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(titles(page)).toHaveCount(3);
});

test("search supports keyboard focus, live counts and narrow layouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openNotebook(page);
  await expect(
    page.getByRole("button", { name: "Close notebook" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const search = page.getByRole("searchbox", { name: "Search passages" });
  await expect(search).toBeFocused();
  expect(
    await search.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        el.matches(":focus-visible") &&
        style.outlineStyle !== "none" &&
        parseFloat(style.outlineWidth) > 0
      );
    }),
  ).toBe(true);
  await page.keyboard.type("garden");
  await expect(page.locator("#search-status")).toHaveAttribute(
    "role",
    "status",
  );
  await expect(page.locator("#search-status")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect(page.locator("#search-status")).toHaveText("1 passage found.");
  expect(
    await page
      .locator("#library")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await search.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Tab");
  await expect(page.locator("#passage-list button")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your passage")).toHaveValue(passages[0].text);
});

test("search leaves stored writing and full Markdown backups intact", async ({
  page,
}) => {
  await openNotebook(page);
  const original = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.getByLabel("Search passages").fill("garden");
  await expect(titles(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Close notebook" }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download writing", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("side-quest-notebook.md");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const content = Buffer.concat(chunks).toString();
  for (const passage of passages) expect(content).toContain(passage.text);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    original,
  );
});

for (const failure of ["corrupt", "unavailable"]) {
  test(`search cannot restore stale results after storage becomes ${failure}`, async ({
    page,
  }) => {
    await openNotebook(page);
    const search = page.getByLabel("Search passages");
    await search.fill("garden");
    await expect(titles(page)).toHaveText(["Moon Garden"]);
    await page.evaluate(
      ({ key, failure }) => {
        if (failure === "corrupt") localStorage.setItem(key, "{bad");
        else
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Denied", "SecurityError");
            },
          });
        window.dispatchEvent(new StorageEvent("storage", { key }));
      },
      { key, failure },
    );
    for (const query of ["moon", "", "garden"]) {
      await search.fill(query);
      await expect(titles(page)).toHaveCount(0);
      await expect(page.locator("#passage-list [role=alert]")).toContainText(
        failure === "corrupt" ? "could not be read" : "unavailable",
      );
      await expect(page.locator("#search-status")).toBeEmpty();
    }
    if (failure === "corrupt") {
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        "{bad",
      );
      await page.evaluate(
        ({ key, passages }) => {
          localStorage.setItem(key, JSON.stringify({ version: 1, passages }));
          window.dispatchEvent(new StorageEvent("storage", { key }));
        },
        { key, passages },
      );
      await expect(titles(page)).toHaveText(["Moon Garden"]);
    }
  });
}
