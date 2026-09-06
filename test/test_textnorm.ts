import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeText, tokenize } from "../src/textnorm.js";

test("normalizeText lowercases and collapses whitespace", () => {
  assert.equal(normalizeText("  Hello   WORLD\n\n"), "hello world");
});

test("normalizeText strips URLs", () => {
  assert.equal(normalizeText("check this https://example.com/foo out"), "check this out");
});

test("tokenize drops stopwords and short tokens", () => {
  const tokens = tokenize("The quick fox and I manually copy data");
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("and"));
  assert.ok(tokens.includes("manually"));
  assert.ok(tokens.includes("copy"));
});
