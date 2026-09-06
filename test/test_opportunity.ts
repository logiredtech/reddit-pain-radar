import { test } from "node:test";
import assert from "node:assert/strict";

import { Post } from "../src/models.js";
import { Cluster } from "../src/clustering.js";
import { buildOpportunities } from "../src/opportunity.js";

function makePost(
  id: string,
  author: string,
  opts: Partial<Post> = {},
): Post {
  return {
    id,
    title: `Manually doing invoice work ${id}`,
    selftext: "I manually copy invoice data every week, so frustrating, tools are expensive, I'd pay for a fix.",
    subreddit: "freelance",
    author,
    score: 10,
    num_comments: 5,
    created_utc: 1,
    url: `https://reddit.com/${id}`,
    ...opts,
  };
}

test("builds one opportunity per cluster, sorted by score desc", () => {
  const clusterA = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const clusterB = new Cluster([makePost("3", "c")]);
  const opportunities = buildOpportunities([clusterA, clusterB]);
  assert.equal(opportunities.length, 2);
  assert.ok(opportunities[0]!.score.totalScore >= opportunities[1]!.score.totalScore);
});

test("opportunity has required fields", () => {
  const cluster = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const opp = buildOpportunities([cluster])[0]!;
  assert.ok(opp.problemStatement);
  assert.ok(opp.suggestedIcp);
  assert.ok(opp.mvpIdea);
  assert.ok(opp.validationSteps.length > 0);
  assert.ok(opp.evidence.length > 0);
  assert.ok("confidence" in opp);
});

test("evidence items reference original posts", () => {
  const cluster = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const opp = buildOpportunities([cluster])[0]!;
  const urls = new Set(opp.evidence.map((e) => e.url));
  assert.deepEqual(urls, new Set(["https://reddit.com/1", "https://reddit.com/2"]));
});

test("confidence is bounded to known values", () => {
  const cluster = new Cluster([makePost("1", "a")]);
  const opp = buildOpportunities([cluster])[0]!;
  assert.ok(["faible", "moyenne", "élevée"].includes(opp.confidence));
});
