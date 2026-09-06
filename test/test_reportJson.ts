import { test } from "node:test";
import assert from "node:assert/strict";

import { Post } from "../src/models.js";
import { Cluster } from "../src/clustering.js";
import { buildOpportunities } from "../src/opportunity.js";
import { buildReportDict } from "../src/reportJson.js";

function makePost(id: string, author: string): Post {
  return {
    id,
    title: `Manually doing invoice work ${id}`,
    selftext: "I manually copy invoice data every week, so frustrating, expensive, I'd pay for a fix.",
    subreddit: "freelance",
    author,
    score: 10,
    num_comments: 5,
    created_utc: 1,
    url: `https://reddit.com/${id}`,
  };
}

test("report dict is JSON-serializable and has the expected shape", () => {
  const cluster = new Cluster([makePost("1", "a"), makePost("2", "b")]);
  const opportunities = buildOpportunities([cluster]);
  const report = buildReportDict(opportunities, "fixture: fixtures/sample_posts.json");

  const parsed = JSON.parse(JSON.stringify(report));

  assert.ok("generated_at" in parsed);
  assert.ok("source_description" in parsed);
  assert.ok("disclaimer" in parsed);
  assert.equal(parsed.opportunities.length, 1);
  const opp = parsed.opportunities[0];
  assert.ok("problem_statement" in opp);
  assert.ok("score" in opp);
  assert.ok("total" in opp.score);
  assert.ok("reasons" in opp.score);
  assert.ok("evidence" in opp);
  assert.ok("market_size_hypotheses" in opp);
});
