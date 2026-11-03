import { test } from "node:test";
import assert from "node:assert/strict";
import { phaseForHour, resolvePhase } from "../src/phase.js";

test("hours map to day, dusk and night", () => {
  assert.equal(phaseForHour(3), "night");
  assert.equal(phaseForHour(6), "dusk");
  assert.equal(phaseForHour(8), "day");
  assert.equal(phaseForHour(16), "day");
  assert.equal(phaseForHour(17), "dusk");
  assert.equal(phaseForHour(20), "night");
  assert.equal(phaseForHour(23), "night");
});

test("dark color scheme keeps the studio at night", () => {
  const noon = new Date(2026, 0, 1, 12);
  assert.equal(resolvePhase({ date: noon, prefersDark: true }), "night");
  assert.equal(resolvePhase({ date: noon, prefersDark: false }), "day");
});

test("a valid override wins; an unknown one is ignored", () => {
  const noon = new Date(2026, 0, 1, 12);
  const opts = { date: noon, prefersDark: true };
  assert.equal(resolvePhase({ ...opts, override: "dusk" }), "dusk");
  assert.equal(resolvePhase({ ...opts, override: "noon" }), "night");
});
