import { test } from "node:test";
import assert from "node:assert/strict";

import { extractProblemStatement } from "../src/problem.js";

test("prefers a pain-signal sentence over the title", () => {
  const title = "Just a random title";
  const selftext =
    "Here is some context. I manually copy data every week and it's exhausting. " +
    "Anyway, thanks for reading.";
  const statement = extractProblemStatement(title, selftext);
  assert.ok(statement.toLowerCase().includes("manually copy data every week"));
});

test("falls back to the title when no pain sentence matches", () => {
  const title = "Looking for recommendations on keyboards";
  const selftext = "Just curious what people use these days.";
  const statement = extractProblemStatement(title, selftext);
  assert.equal(statement, title);
});

test("truncates a long statement to 220 chars", () => {
  const title = "x";
  const longSentence = "I manually " + "do this thing over and over ".repeat(20) + "and it is expensive.";
  const statement = extractProblemStatement(title, longSentence);
  assert.ok(statement.length <= 220);
});

test("strips whitespace around the title", () => {
  const title = "  Some Title  ";
  const selftext = "";
  const statement = extractProblemStatement(title, selftext);
  assert.equal(statement, "Some Title");
});
