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

test("detects expanded self-harm phrasing variants", () => {
  const phrases = [
    "I don't want to be alive anymore",
    "I feel like there's no point in living",
    "I've been thinking about suicide a lot lately",
    "I can't take this anymore, I want it to be over",
  ];
  for (const phrase of phrases) {
    const result = screenForCrisis(phrase);
    assert.ok(result, `expected a crisis match for: "${phrase}"`);
    assert.equal(result.type, "self_harm");
  }
});

test("detects expanded abuse/violence phrasing variants", () => {
  const phrases = [
    "my husband hits me whenever he's angry",
    "he won't let me see my family anymore",
    "I think my child is being groomed online",
  ];
  for (const phrase of phrases) {
    const result = screenForCrisis(phrase);
    assert.ok(result, `expected a crisis match for: "${phrase}"`);
    assert.equal(result.type, "abuse_violence");
  }
});

test("detects expanded medical emergency phrasing variants (stroke FAST signs)", () => {
  const phrases = [
    "my dad suddenly has slurred speech and face drooping",
    "I can't feel my legs all of a sudden",
    "she is unresponsive and not waking up",
  ];
  for (const phrase of phrases) {
    const result = screenForCrisis(phrase);
    assert.ok(result, `expected a crisis match for: "${phrase}"`);
    assert.equal(result.type, "medical_emergency");
  }
});

test("exports the three documented categories", () => {
  assert.deepEqual(
    [...SAFETY_CATEGORIES].sort(),
    ["abuse_violence", "medical_emergency", "self_harm"].sort()
  );
});
