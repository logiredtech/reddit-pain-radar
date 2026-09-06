import { test } from "node:test";
import assert from "node:assert/strict";

import { detectPainSignals, PAIN_CATEGORIES } from "../src/signals.js";

test("detects manual_work and expensive_tools", () => {
  const text = "I manually copy data every week, the existing tools are way too expensive for us.";
  const result = detectPainSignals(text);
  assert.ok(result.matchedCategories.has("manual_work"));
  assert.ok(result.matchedCategories.has("expensive_tools"));
});

test("detects frustration and willingness_to_pay", () => {
  const text = "So frustrating that this doesn't exist, I would pay for a tool that fixes this.";
  const result = detectPainSignals(text);
  assert.ok(result.matchedCategories.has("frustration"));
  assert.ok(result.matchedCategories.has("willingness_to_pay"));
});

test("no signals for unrelated text", () => {
  const text = "I bought a new mechanical keyboard today and it feels great.";
  const result = detectPainSignals(text);
  assert.equal(result.matchedCategories.size, 0);
  assert.equal(result.diversityScore, 0);
});

test("diversity score counts distinct categories", () => {
  const text =
    "I manually enter this data every day, there's no solution for it, " +
    "it's so frustrating, and I'd pay for something that works.";
  const result = detectPainSignals(text);
  assert.equal(result.diversityScore, result.matchedCategories.size);
  assert.ok(result.diversityScore >= 3);
});

test("all categories are registered", () => {
  const expected = new Set([
    "manual_work",
    "expensive_tools",
    "missing_solution",
    "frustration",
    "willingness_to_pay",
  ]);
  assert.deepEqual(new Set(Object.keys(PAIN_CATEGORIES)), expected);
});
