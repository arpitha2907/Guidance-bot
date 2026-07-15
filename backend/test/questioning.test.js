// questioning.test.js
// Covers the pure/deterministic parts of the questioning engine (the LLM
// call itself is not unit-tested here — that would need a live/mocked LLM
// client — but the cap and query-building logic are pure and easily verified).

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_QUESTIONS, buildGuidanceQuery, nextStep } from "../src/questioning.js";

test("MAX_QUESTIONS matches the PRD-mandated cap of 10", () => {
  assert.equal(MAX_QUESTIONS, 10);
});

test("nextStep short-circuits to 'ready' once the cap is reached, without calling the LLM", async () => {
  const history = Array.from({ length: MAX_QUESTIONS }, (_, i) => ({
    question: `Q${i}`,
    answer: `A${i}`,
  }));
  const result = await nextStep({ concern: "test concern", history, domain: "health" });
  assert.deepEqual(result, { action: "ready" });
});

test("buildGuidanceQuery concatenates the concern with all Q/A pairs", () => {
  const query = buildGuidanceQuery({
    concern: "I have a headache",
    history: [
      { question: "How long has it lasted?", answer: "Since this morning" },
      { question: "Any other symptoms?", answer: "No" },
    ],
  });
  assert.ok(query.includes("I have a headache"));
  assert.ok(query.includes("How long has it lasted?"));
  assert.ok(query.includes("Since this morning"));
});

test("buildGuidanceQuery handles an empty history", () => {
  const query = buildGuidanceQuery({ concern: "Just a concern", history: [] });
  assert.equal(query, "Just a concern");
});
