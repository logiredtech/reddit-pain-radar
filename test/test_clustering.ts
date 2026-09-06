import { test } from "node:test";
import assert from "node:assert/strict";

import { Post } from "../src/models.js";
import { jaccardSimilarity, clusterPosts } from "../src/clustering.js";

function makePost(
  id: string,
  title: string,
  selftext: string,
  opts: Partial<Post> = {},
): Post {
  return {
    id,
    title,
    selftext,
    subreddit: "test",
    author: "a",
    score: 1,
    num_comments: 1,
    created_utc: 1,
    url: `https://reddit.com/${id}`,
    ...opts,
  };
}

test("identical sets have similarity one", () => {
  assert.equal(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"])), 1.0);
});

test("disjoint sets have similarity zero", () => {
  assert.equal(jaccardSimilarity(new Set(["a"]), new Set(["b"])), 0.0);
});

test("partial overlap", () => {
  assert.ok(Math.abs(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"])) - 1 / 3) < 1e-9);
});

test("both empty is zero", () => {
  assert.equal(jaccardSimilarity(new Set(), new Set()), 0.0);
});

test("similar posts land in the same cluster", () => {
  const posts = [
    makePost("1", "Manually copying invoice data every week", "so tedious, manual invoice copying"),
    makePost("2", "Manually copying invoice line items weekly", "manual invoice copying is tedious"),
    makePost("3", "Best mechanical keyboard switches", "tactile vs linear switches discussion"),
  ];
  const clusters = clusterPosts(posts);
  assert.equal(clusters.length, 2);
  const sizes = clusters.map((c) => c.posts.length).sort();
  assert.deepEqual(sizes, [1, 2]);
});

test("clustering is deterministic", () => {
  const posts = [
    makePost("1", "Manually copying invoice data every week", "manual invoice copying tedious"),
    makePost("2", "Manually copying invoice line items weekly", "manual invoice copying tedious"),
    makePost("3", "Expensive CRM tools for solo founders", "crm tools way too expensive solo"),
    makePost("4", "Expensive CRM software for indie founders", "crm software too expensive indie"),
  ];
  const idsA = clusterPosts(posts).map((c) => c.posts.map((p) => p.id));
  const idsB = clusterPosts(posts).map((c) => c.posts.map((p) => p.id));
  assert.deepEqual(idsA, idsB);
});

test("cluster has a label", () => {
  const posts = [
    makePost("1", "Manually copying invoice data every week", "manual invoice copying tedious"),
    makePost("2", "Manually copying invoice line items weekly", "manual invoice copying tedious"),
  ];
  const clusters = clusterPosts(posts);
  assert.ok(clusters[0]!.label);
});
