import { test } from "node:test";
import assert from "node:assert/strict";

import { Post } from "../src/models.js";
import { Cluster } from "../src/clustering.js";
import { scoreCluster } from "../src/scoring.js";

function makePost(
  id: string,
  author: string,
  opts: Partial<Post> = {},
): Post {
  return {
    id,
    title: `title ${id}`,
    selftext: "I manually do this every week, so frustrating, expensive tools, I'd pay for a fix.",
    subreddit: "sub1",
    author,
    score: 10,
    num_comments: 5,
    created_utc: 1,
    url: `https://reddit.com/${id}`,
    ...opts,
  };
}

test("more independent authors scores higher", () => {
  const low = new Cluster([makePost("1", "a"), makePost("2", "a")]);
  const high = new Cluster([makePost("3", "a"), makePost("4", "b")]);
  assert.ok(scoreCluster(high).totalScore > scoreCluster(low).totalScore);
});

test("more subreddits scores higher", () => {
  const oneSub = new Cluster([
    makePost("1", "a", { subreddit: "s1" }),
    makePost("2", "b", { subreddit: "s1" }),
  ]);
  const twoSubs = new Cluster([
    makePost("3", "a", { subreddit: "s1" }),
    makePost("4", "b", { subreddit: "s2" }),
  ]);
  assert.ok(scoreCluster(twoSubs).totalScore > scoreCluster(oneSub).totalScore);
});

test("higher engagement scores higher", () => {
  const low = new Cluster([makePost("1", "a", { score: 1, num_comments: 0 })]);
  const high = new Cluster([makePost("2", "a", { score: 500, num_comments: 200 })]);
  assert.ok(scoreCluster(high).totalScore > scoreCluster(low).totalScore);
});

test("negative engagement values cannot make the score non-finite", () => {
  const cluster = new Cluster([
    makePost("1", "a", { score: -100, num_comments: 5 }),
    makePost("2", "b", { score: 2, num_comments: -50 }),
  ]);

  const result = scoreCluster(cluster);

  assert.ok(Number.isFinite(result.totalScore));
  assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
  assert.ok(result.reasons.includes("Engagement cumulé (score + commentaires) : 7."));
});

test("score result has explainable reasons", () => {
  const cluster = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const result = scoreCluster(cluster);
  assert.ok(Array.isArray(result.reasons));
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.every((r) => typeof r === "string"));
});

test("score is bounded 0..100", () => {
  const posts = Array.from({ length: 20 }, (_, i) =>
    makePost(String(i), `author${i}`, { score: 99999, num_comments: 99999 }),
  );
  const result = scoreCluster(new Cluster(posts));
  assert.ok(result.totalScore <= 100.0);
  assert.ok(result.totalScore >= 0.0);
});

test("market evidence state is reported", () => {
  const cluster = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const result = scoreCluster(cluster);
  assert.ok(["faible", "modérée", "forte"].includes(result.marketEvidenceState));
});
