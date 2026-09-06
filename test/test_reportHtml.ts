import { test } from "node:test";
import assert from "node:assert/strict";

import { Post } from "../src/models.js";
import { Cluster } from "../src/clustering.js";
import { buildOpportunities } from "../src/opportunity.js";
import { renderHtmlReport } from "../src/reportHtml.js";

function makePost(id: string, author: string, selftext: string): Post {
  return {
    id,
    title: `Manually doing invoice work ${id}`,
    selftext,
    subreddit: "freelance",
    author,
    score: 10,
    num_comments: 5,
    created_utc: 1,
    url: `https://reddit.com/${id}`,
  };
}

test("escapes malicious post content", () => {
  const malicious = "<script>alert('xss')</script> I manually do this, so frustrating, I'd pay.";
  const cluster = new Cluster([makePost("1", "a", malicious), makePost("2", "b", malicious)]);
  const opportunities = buildOpportunities([cluster]);
  const html = renderHtmlReport(opportunities, "fixture");
  assert.ok(!html.includes("<script>alert('xss')</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("escapes malicious author and subreddit", () => {
  const posts: Post[] = [
    {
      id: "1",
      title: "Manually copying data",
      selftext: "I manually copy this every week, so frustrating, I'd pay for a fix.",
      subreddit: '"><img src=x onerror=alert(1)>',
      author: "<b>hacker</b>",
      score: 5,
      num_comments: 1,
      created_utc: 1,
      url: "https://reddit.com/1",
    },
    makePost("2", "normal_user", "I manually copy this every week, so frustrating, I'd pay for a fix."),
  ];
  const cluster = new Cluster(posts);
  const opportunities = buildOpportunities([cluster]);
  const html = renderHtmlReport(opportunities, "fixture");
  assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
  assert.ok(!html.includes("<b>hacker</b>"));
});

test("report is in French and contains the disclaimer", () => {
  const cluster = new Cluster([makePost("1", "a", "I manually do this, so frustrating, I'd pay.")]);
  const opportunities = buildOpportunities([cluster]);
  const html = renderHtmlReport(opportunities, "fixture");
  assert.ok(html.includes("Opportunités"));
  assert.ok(html.toLowerCase().includes("hypothèse"));
  assert.ok(html.toLowerCase().includes("<html"));
});

test("report includes evidence links", () => {
  const cluster = new Cluster([makePost("1", "a", "I manually do this, so frustrating, I'd pay.")]);
  const opportunities = buildOpportunities([cluster]);
  const html = renderHtmlReport(opportunities, "fixture");
  assert.ok(html.includes("https://reddit.com/1"));
});

test("neutralizes javascript: hrefs", () => {
  const post: Post = {
    id: "1",
    title: "Manually copying data",
    selftext: "I manually copy this every week, so frustrating, I'd pay for a fix.",
    subreddit: "freelance",
    author: "a",
    score: 5,
    num_comments: 1,
    created_utc: 1,
    url: "javascript:alert(1)",
  };
  const cluster = new Cluster([post]);
  const opportunities = buildOpportunities([cluster]);
  const html = renderHtmlReport(opportunities, "fixture");
  assert.ok(!html.includes('href="javascript:alert(1)"'));
});
