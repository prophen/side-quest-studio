import { test, expect } from "@playwright/test";

for (const [width, height] of [
  [1440, 1000],
  [390, 320],
]) {
  for (const station of ["desk", "workbench"]) {
    test(`${station} focus outlines leave labels clear at ${width}×${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.locator(`#${station}`).click();
      const ids =
        station === "desk"
          ? ["title"]
          : ["log-project", "log-text", "log-next"];
      for (const id of ids) {
        const field = page.locator(`#${id}`);
        await field.focus();
        await expect(field).toBeFocused();
        const geometry = await field.evaluate((input) => {
          const label = document.querySelector(`label[for="${input.id}"]`);
          const style = getComputedStyle(input);
          const outline = parseFloat(style.outlineWidth);
          const offset = parseFloat(style.outlineOffset);
          return {
            outline,
            style: style.outlineStyle,
            top: input.getBoundingClientRect().top - offset - outline,
            labelBottom: label.getBoundingClientRect().bottom,
          };
        });
        expect(geometry.outline).toBeGreaterThan(0);
        expect(geometry.style).not.toBe("none");
        expect(geometry.top).toBeGreaterThanOrEqual(geometry.labelBottom + 2);
      }
      if (width === 1440)
        await page.screenshot({ path: `test-results/${station}-focus.png` });
    });
  }
}
