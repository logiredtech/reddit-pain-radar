import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Post, postFromRecord } from "../src/models.js";
import { loadPostsFromFixture, IngestError } from "../src/ingest.js";

function tmpFile(contents: string): string {
  const path = join(tmpdir(), `painradar-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, contents, "utf-8");
  return path;
}

test("postFromRecord builds a typed Post", () => {
  const raw = {
    id: "abc123",
    title: "Title",
    selftext: "Body text",
    subreddit: "smallbusiness",
    author: "u1",
    score: 12,
    num_comments: 3,
    created_utc: 1700000000,
    url: "https://reddit.com/r/smallbusiness/abc123",
  };
  const post: Post = postFromRecord(raw);
  assert.equal(post.id, "abc123");
  assert.equal(post.score, 12);
  assert.equal(post.subreddit, "smallbusiness");
});

test("loadPostsFromFixture returns posts from the sample fixture", () => {
  const posts = loadPostsFromFixture("fixtures/sample_posts.json");
  assert.ok(posts.length >= 12);
});

test("loadPostsFromFixture on a missing file raises IngestError", () => {
  assert.throws(() => loadPostsFromFixture("fixtures/does_not_exist.json"), IngestError);
});

test("loadPostsFromFixture rejects a post missing required fields", () => {
  const path = tmpFile(JSON.stringify([{ id: "x", title: "t" }]));
  try {
    assert.throws(() => loadPostsFromFixture(path), IngestError);
  } finally {
    unlinkSync(path);
  }
});

test("loadPostsFromFixture rejects malformed JSON syntax", () => {
  const path = tmpFile("{not valid json,,,");
  try {
    assert.throws(() => loadPostsFromFixture(path), IngestError);
  } finally {
    unlinkSync(path);
  }
});

test("loadPostsFromFixture rejects non-list JSON", () => {
  const path = tmpFile(JSON.stringify({ not: "a list" }));
  try {
    assert.throws(() => loadPostsFromFixture(path), IngestError);
  } finally {
    unlinkSync(path);
  }
});

test("loadPostsFromFixture rejects a wrong-typed field", () => {
  const bad = [
    {
      id: "x",
      title: "t",
      selftext: "s",
      subreddit: "sub",
      author: "a",
      score: { nested: "dict, not coercible to int" },
      num_comments: 1,
      created_utc: 1,
      url: "https://reddit.com/x",
    },
  ];
  const path = tmpFile(JSON.stringify(bad));
  try {
    assert.throws(() => loadPostsFromFixture(path), IngestError);
  } finally {
    unlinkSync(path);
  }
});
