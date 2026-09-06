import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPostsFromFixture } from "../src/ingest.js";
import { Post } from "../src/models.js";
import { runPipeline } from "../src/pipeline.js";

test("fixture to report end-to-end", () => {
  const posts = loadPostsFromFixture("fixtures/sample_posts.json");
  const { reportDict, html } = runPipeline(posts, "fixture: fixtures/sample_posts.json");

  const opportunities = reportDict["opportunities"] as Array<Record<string, any>>;
  assert.ok(opportunities.length >= 2);

  const scores = opportunities.map((o) => o["score"]["total"]);
  const sortedDesc = [...scores].sort((a, b) => b - a);
  assert.deepEqual(scores, sortedDesc);

  assert.ok(html.toLowerCase().includes("<html"));
  assert.ok(html.includes("Opportunités"));

  const problemStatements = opportunities.map((o) => String(o["problem_statement"]).toLowerCase()).join(" ");
  assert.ok(!problemStatements.includes("mechanical keyboard"));
});

test("posts without pain signals are excluded", () => {
  const post: Post = {
    id: "neutral-1",
    title: "Promote Your Business thread",
    selftext: "Share your company and introduce yourself to the community.",
    subreddit: "smallbusiness",
    author: "moderator",
    score: 100,
    num_comments: 50,
    created_utc: 1,
    url: "https://www.reddit.com/r/smallbusiness/comments/neutral-1",
  };

  const { reportDict } = runPipeline([post], "test");
  assert.deepEqual(reportDict["opportunities"], []);
});

test("empty post list produces an empty but valid report", () => {
  const { reportDict, html } = runPipeline([], "empty");
  assert.deepEqual(reportDict["opportunities"], []);
  assert.ok(html.toLowerCase().includes("<html"));
});
