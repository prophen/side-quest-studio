import { test, expect } from "@playwright/test";
const key = "side-quest-studio.notebook.v1";
async function write(page, text = "A small beginning.\nA second line.") {
  await page.getByRole("button", { name: "Sit at the desk" }).click();
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

for (const failure of ["corrupt", "unavailable"]) {
  test(`loaded notebook removes stale entries when storage becomes ${failure}`, async ({
    page,
  }) => {
    await page.goto("/");
    await write(page);
    await save(page);
    await page.getByRole("button", { name: "Close writing panel" }).click();
    await page.getByRole("button", { name: "Open your notebook" }).click();
    await expect(page.locator("#passage-list button")).toHaveCount(1);
    // Simulate a storage event while the library is already open.
    const original = await page.evaluate((k) => localStorage.getItem(k), key);
    await page.evaluate(
      ({ k, failure }) => {
        if (failure === "corrupt") localStorage.setItem(k, "{bad");
        else
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
              throw new DOMException("Denied", "SecurityError");
            },
          });
        window.dispatchEvent(new StorageEvent("storage", { key: k }));
      },
      { k: key, failure },
    );
    await expect(page.locator("#passage-list button")).toHaveCount(0);
    await expect(page.locator("#passage-list [role=alert]")).toContainText(
      failure === "corrupt" ? "could not be read" : "unavailable",
    );
    await page.getByRole("button", { name: "Close notebook" }).click();
    // Opening it again must show the error, not the old editable list.
    await page.getByRole("button", { name: "Open your notebook" }).click();
    await expect(page.locator("#passage-list button")).toHaveCount(0);
    if (failure === "corrupt") {
      await page.evaluate(
        ({ k, original }) => {
          localStorage.setItem(k, original);
          window.dispatchEvent(new StorageEvent("storage", { key: k }));
        },
        { k: key, original },
      );
      await expect(page.locator("#passage-list button")).toHaveCount(1);
      await expect(page.locator("#passage-list [role=alert]")).toHaveCount(0);
    }
  });
}

test("failed draft update restores older copy with a persistent warning", async ({
  page,
}) => {
  const draftKey = "side-quest-studio.draft.v1";
  await page.goto("/");
  await write(page, "Version A");
  await page.evaluate((draftKey) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === draftKey) throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, k, v);
    };
  }, draftKey);
  await page.getByLabel("Your passage").fill("Version B");
  await expect(page.locator("#draft-state")).toContainText(
    "Draft recovery is unavailable",
  );
  await expect(page.getByLabel("Your passage")).toHaveValue("Version B");
  expect(
    await page.evaluate(
      (k) => JSON.parse(sessionStorage.getItem(k)).text,
      draftKey,
    ),
  ).toBe("Version A");
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.getByLabel("Your passage")).toHaveValue("Version A");
  await expect(page.locator("#recovery-note")).toBeVisible();
  await expect(page.locator("#recovery-note")).toContainText(
    "may not include your latest edits",
  );
  await page.getByLabel("Your passage").fill("Checked and recovered words");
  await expect(page.locator("#recovery-note")).toBeVisible();
  await save(page);
  await expect(page.locator("#recovery-note")).toBeHidden();
});

test("malformed cached draft cannot enter the editor or damage saved passages", async ({
  page,
}) => {
  await page.goto("/");
  await write(page);
  await save(page);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "side-quest-studio.draft.v1",
      JSON.stringify({
        id: "",
        title: "Bad draft",
        text: "Keep saved work safe",
        baseRevision: null,
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Draft recovery is unavailable",
  );
  await expect(page.locator("#editor")).not.toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  await page.getByRole("button", { name: "Open your notebook" }).click();
  await expect(page.locator("#passage-list")).toContainText("My first page");
});

test("quest never covers the room's hotspots or notebook", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await write(page);
  await save(page);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  const sizes = [
    [920, 600],
    [1024, 640],
    [1199, 900],
    [1200, 860],
    [1280, 720],
    [1359, 700],
    [1360, 640],
    [1440, 1000],
    [1920, 1080],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    const covered = await page.evaluate(() => {
      const quest = document.querySelector(".quest").getBoundingClientRect();
      return ["#desk", "#notebook", ".board", ".workbench"].filter((sel) => {
        const box = document.querySelector(sel).getBoundingClientRect();
        return !(
          box.right <= quest.left ||
          box.left >= quest.right ||
          box.bottom <= quest.top ||
          box.top >= quest.bottom
        );
      });
    });
    expect(covered, `${width}×${height}`).toEqual([]);
  }
});

for (const [width, height] of [
  [800, 380],
  [390, 320],
]) {
  test(`save controls stay visible in the editor at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Sit at the desk" }).click();
    await page.getByLabel("Your passage").fill("Line\n".repeat(40));
    for (const name of ["Save passage", "Download draft"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box.y + box.height, name).toBeLessThanOrEqual(height);
    }
  });
}

test("walk cycle advances whole-body poses during travel and settles before writing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.locator("#desk").click();
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#editor")).not.toBeVisible();
  const poses = await page.locator("#player").evaluate((player) => {
    const animations = player
      .getAnimations({ subtree: true })
      .filter((animation) => !(animation instanceof CSSTransition));
    animations.forEach((animation) => animation.pause());
    const sample = (time) => {
      animations.forEach((animation) => (animation.currentTime = time));
      return {
        left: player.getBoundingClientRect().left,
        frame: getComputedStyle(player.querySelector(".walk-sheet"))
          .backgroundPosition,
      };
    };
    const start = sample(0);
    const step = sample(140);
    const frames = Array.from(
      { length: 8 },
      (_, i) => sample(i * 100 + 50).frame,
    );
    const heldFrame = sample(190).frame;
    animations.forEach((animation) => animation.play());
    return { start, step, frames, heldFrame };
  });
  expect(poses.step.left).toBeLessThan(poses.start.left);
  expect(poses.step.frame).not.toBe(poses.start.frame);
  expect(new Set(poses.frames).size).toBe(8);
  expect(poses.heldFrame).toBe(poses.step.frame);
  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#player")).toHaveClass("player at-desk");
  expect(
    await page
      .locator("#player")
      .evaluate(
        (p) =>
          p
            .getAnimations({ subtree: true })
            .filter((animation) => !(animation instanceof CSSTransition))
            .length,
      ),
  ).toBe(0);
  await page.getByRole("button", { name: "Close writing panel" }).click();
  await page.locator("#start").click();
  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#player")).toHaveClass("player at-desk");
});

test("reduced motion skips the walk cycle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#desk").click();
  await expect(page.getByLabel("Your passage")).toBeFocused();
  await expect(page.locator("#player")).toHaveClass("player at-desk");
  expect(
    await page
      .locator("#player")
      .evaluate(
        (p) =>
          p
            .getAnimations({ subtree: true })
            .filter((animation) => !(animation instanceof CSSTransition))
            .length,
      ),
  ).toBe(0);
});
