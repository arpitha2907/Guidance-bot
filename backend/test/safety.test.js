// safety.test.js
// safety.js is deterministic (no LLM/network calls), so it's fully
// unit-testable in isolation. These tests lock in the crisis-detection
// behavior described in PRD Task 6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { screenForCrisis, SAFETY_CATEGORIES } from "../src/safety.js";

test("returns null for benign messages", () => {
  assert.equal(screenForCrisis("I have a mild headache since this morning"), null);
  assert.equal(screenForCrisis("I've been feeling a bit stressed about work"), null);
});

test("detects self-harm signals", () => {
  const result = screenForCrisis("I just want to kill myself");
  assert.ok(result);
  assert.equal(result.type, "self_harm");
  assert.ok(result.resources.some((r) => r.contact === "112"));
  assert.ok(result.resources.some((r) => r.label.includes("Vandrevala")));
});

test("detects abuse/violence signals", () => {
  const result = screenForCrisis("my partner hits me and I'm afraid of him");
  assert.ok(result);
  assert.equal(result.type, "abuse_violence");
});

test("detects medical emergency signals", () => {
  const result = screenForCrisis("I have severe chest pain and can't breathe");
  assert.ok(result);
  assert.equal(result.type, "medical_emergency");
});

test("is case-insensitive and whitespace-tolerant", () => {
  const result = screenForCrisis("  I WANT TO   Kill Myself   ");
  assert.ok(result);
  assert.equal(result.type, "self_harm");
});

test("checks most acute category first when multiple match", () => {
  // Contains both a self-harm phrase and a medical phrase; self-harm is
  // checked first in CATEGORIES, so it should win.
  const result = screenForCrisis("I want to die, my chest also hurts");
  assert.equal(result.type, "self_harm");
});

test("handles non-string / empty input safely", () => {
  assert.equal(screenForCrisis(""), null);
  assert.equal(screenForCrisis(null), null);
  assert.equal(screenForCrisis(undefined), null);
  assert.equal(screenForCrisis(12345), null);
});

test("exports the three documented categories", () => {
  assert.deepEqual(
    [...SAFETY_CATEGORIES].sort(),
    ["abuse_violence", "medical_emergency", "self_harm"].sort()
  );
});
