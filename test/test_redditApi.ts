import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fetchAccessToken,
  fetchSubredditListing,
  collectRedditPosts,
  loadCredentialsFromEnv,
  RedditAuthError,
  RedditCredentials,
  FetchLike,
} from "../src/redditApi.js";

const CREDS: RedditCredentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  userAgent: "painradar-test/1.0 (contact: test@example.com)",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function listingPayload(children: Array<Record<string, unknown>>): unknown {
  return {
    kind: "Listing",
    data: {
      children: children.map((data) => ({ kind: "t3", data })),
    },
  };
}

function samplePost(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: "Manually copying invoice data every week is exhausting",
    selftext: "I manually copy invoice data every week, no solution exists, I'd pay for a fix.",
    subreddit: "testsub",
    author: "atomuser",
    score: 12,
    num_comments: 4,
    created_utc: 1700000000,
    permalink: `/r/testsub/comments/${id}/post/`,
    ...overrides,
  };
}

test("fetchAccessToken performs client_credentials grant and returns a token", async () => {
  const captured: { request?: { url: string; init: RequestInit } } = {};
  const fetchImpl: FetchLike = (async (url: string, init?: RequestInit) => {
    captured.request = { url, init: init ?? {} };
    return jsonResponse({ access_token: "tok_abc", token_type: "bearer", expires_in: 3600 });
  }) as FetchLike;

  const token = await fetchAccessToken(fetchImpl, CREDS);
  assert.equal(token.token, "tok_abc");
  assert.ok(captured.request);
  const request = captured.request!;
  assert.equal(request.url, "https://www.reddit.com/api/v1/access_token");
  const headers = new Headers(request.init.headers as HeadersInit);
  assert.ok(headers.get("authorization")?.startsWith("Basic "));
  assert.equal(headers.get("user-agent"), CREDS.userAgent);
  assert.equal(request.init.body, "grant_type=client_credentials");
});

test("fetchAccessToken raises RedditAuthError on non-2xx response, without leaking secrets", async () => {
  const fetchImpl: FetchLike = (async () => new Response("nope", { status: 401 })) as FetchLike;
  await assert.rejects(
    () => fetchAccessToken(fetchImpl, CREDS),
    (error: unknown) => {
      assert.ok(error instanceof RedditAuthError);
      assert.ok(!error.message.includes(CREDS.clientId));
      assert.ok(!error.message.includes(CREDS.clientSecret));
      return true;
    },
  );
});

test("fetchAccessToken rejects null and malformed successful response bodies", async () => {
  const malformedBodies: unknown[] = [
    null,
    [],
    {},
    { access_token: "" },
    { access_token: 123 },
    { access_token: "token", expires_in: 0 },
    { access_token: "token", expires_in: -1 },
    { access_token: "token", expires_in: Number.POSITIVE_INFINITY },
    { access_token: "token", expires_in: "3600" },
  ];

  for (const body of malformedBodies) {
    const fetchImpl: FetchLike = (async () => jsonResponse(body)) as FetchLike;
    await assert.rejects(() => fetchAccessToken(fetchImpl, CREDS), RedditAuthError);
  }
});

test("fetchAccessToken sanitizes credential text from network errors", async () => {
  const fetchImpl: FetchLike = (async () => {
    throw new Error(`request failed for ${CREDS.clientId}:${CREDS.clientSecret}`);
  }) as FetchLike;

  await assert.rejects(
    () => fetchAccessToken(fetchImpl, CREDS),
    (error: unknown) => {
      assert.ok(error instanceof RedditAuthError);
      assert.ok(!error.message.includes(CREDS.clientId));
      assert.ok(!error.message.includes(CREDS.clientSecret));
      return true;
    },
  );
});

test("loadCredentialsFromEnv reads the three approved env vars only", () => {
  const env = {
    REDDIT_CLIENT_ID: "id1",
    REDDIT_CLIENT_SECRET: "secret1",
    REDDIT_USER_AGENT: "ua/1.0",
  };
  const creds = loadCredentialsFromEnv(env);
  assert.deepEqual(creds, { clientId: "id1", clientSecret: "secret1", userAgent: "ua/1.0" });
});

test("loadCredentialsFromEnv throws RedditAuthError when a var is missing", () => {
  assert.throws(() => loadCredentialsFromEnv({}), RedditAuthError);
});

test("fetchSubredditListing rejects subreddit names that could inject URL segments", async () => {
  const fetchImpl: FetchLike = (async () => {
    throw new Error("fetch should not be called for an invalid subreddit name");
  }) as FetchLike;
  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "../evil.com", 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /invalid subreddit/i);
});

test("fetchSubredditListing parses a listing into Post objects and bounds by maxItems", async () => {
  const children = [
    samplePost("a1", {
      author: null,
      selftext: null,
      score: -5,
      created_utc: 1700000000.5,
    }),
    samplePost("a2", { score: 3_000_000_000 }),
    samplePost("a3"),
  ];
  const fetchImpl: FetchLike = (async (url: string) => {
    assert.ok(url.startsWith("https://oauth.reddit.com/r/testsub/new"));
    return jsonResponse(listingPayload(children), {
      headers: {
        "content-type": "application/json",
        "x-ratelimit-used": "5",
        "x-ratelimit-remaining": "595",
        "x-ratelimit-reset": "300",
      },
    });
  }) as FetchLike;

  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 2);
  assert.equal(result.ok, true);
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[0]!.subreddit, "testsub");
  assert.equal(result.posts[0]!.author, "[deleted]");
  assert.equal(result.posts[0]!.selftext, "");
  assert.equal(result.posts[0]!.score, -5);
  assert.equal(result.posts[0]!.created_utc, 1700000000.5);
  assert.equal(result.posts[1]!.score, 3_000_000_000);
  assert.equal(result.posts[0]!.url, "https://www.reddit.com/r/testsub/comments/a1/post/");
  assert.deepEqual(result.rateLimit, { used: 5, remaining: 595, resetSeconds: 300 });
});

test("fetchSubredditListing parses malformed rate-limit headers as null", async () => {
  const fetchImpl: FetchLike = (async () =>
    jsonResponse(listingPayload([samplePost("a1")]), {
      headers: {
        "x-ratelimit-used": "not-a-number",
        "x-ratelimit-remaining": "Infinity",
        "x-ratelimit-reset": "-1",
      },
    })) as FetchLike;

  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 1);

  assert.deepEqual(result.rateLimit, { used: null, remaining: null, resetSeconds: null });
});

test("fetchSubredditListing reports 401 explicitly", async () => {
  const fetchImpl: FetchLike = (async () => new Response("", { status: 401 })) as FetchLike;
  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /401/);
});

test("fetchSubredditListing reports 403 explicitly", async () => {
  const fetchImpl: FetchLike = (async () => new Response("", { status: 403 })) as FetchLike;
  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /403/);
});

test("fetchSubredditListing reports 429 explicitly with rate-limit info, no retry", async () => {
  let callCount = 0;
  const fetchImpl: FetchLike = (async () => {
    callCount += 1;
    return new Response("", {
      status: 429,
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "60" },
    });
  }) as FetchLike;
  const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /429/);
  assert.equal(result.rateLimit.remaining, 0);
  assert.equal(callCount, 1);
});

test("fetchSubredditListing reports network errors without throwing", async () => {
  const accessToken = "secret-access-token";
  const fetchImpl: FetchLike = (async () => {
    throw new Error(`connection refused with ${accessToken}`);
  }) as FetchLike;
  const result = await fetchSubredditListing(fetchImpl, accessToken, CREDS.userAgent, "testsub", 10);
  assert.equal(result.ok, false);
  assert.match(result.error, /network error/i);
  assert.ok(!result.error.includes(accessToken));
});

test("fetchSubredditListing returns failures for null and malformed successful listings", async () => {
  const malformedListings: unknown[] = [null, [], {}, { data: null }, { data: {} }, { data: { children: null } }];

  for (const body of malformedListings) {
    const fetchImpl: FetchLike = (async () => jsonResponse(body)) as FetchLike;
    const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
    assert.equal(result.ok, false, `expected malformed body to fail: ${JSON.stringify(body)}`);
    assert.deepEqual(result.posts, []);
    assert.match(result.error, /invalid.*listing/i);
  }
});

test("fetchSubredditListing rejects malformed Post fields without coercion", async () => {
  const malformedPosts: Array<Record<string, unknown>> = [
    samplePost("bad", { id: 7 }),
    samplePost("bad", { title: null }),
    samplePost("bad", { subreddit: "" }),
    samplePost("bad", { author: 42 }),
    samplePost("bad", { selftext: 42 }),
    samplePost("bad", { score: 1.5 }),
    samplePost("bad", { score: Number.MAX_SAFE_INTEGER + 1 }),
    samplePost("bad", { num_comments: -1 }),
    samplePost("bad", { num_comments: 1.5 }),
    samplePost("bad", { created_utc: -1 }),
    samplePost("bad", { created_utc: "1700000000" }),
    samplePost("bad", { permalink: null, url: null }),
  ];

  for (const post of malformedPosts) {
    const fetchImpl: FetchLike = (async () => jsonResponse(listingPayload([post]))) as FetchLike;
    const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
    assert.equal(result.ok, false, `expected malformed post to fail: ${JSON.stringify(post)}`);
    assert.deepEqual(result.posts, []);
  }
});

test("fetchSubredditListing returns a failure for malformed child and child data entries", async () => {
  const malformedChildren: unknown[] = [null, 42, "child", [], {}, { data: null }, { data: 42 }, { data: [] }];

  for (const child of malformedChildren) {
    const fetchImpl: FetchLike = (async () => jsonResponse({ data: { children: [child] } })) as FetchLike;
    const result = await fetchSubredditListing(fetchImpl, "tok", CREDS.userAgent, "testsub", 10);
    assert.equal(result.ok, false, `expected malformed child to fail: ${JSON.stringify(child)}`);
    assert.deepEqual(result.posts, []);
  }
});

test("collectRedditPosts collects across subreddits and keeps partial results on failure", async () => {
  let tokenCalls = 0;
  const fetchImpl: FetchLike = (async (url: string) => {
    if (url === "https://www.reddit.com/api/v1/access_token") {
      tokenCalls += 1;
      return jsonResponse({ access_token: "tok_xyz", expires_in: 3600 });
    }
    if (url.startsWith("https://oauth.reddit.com/r/goodsub/")) {
      return jsonResponse(listingPayload([samplePost("g1", { subreddit: "goodsub" })]));
    }
    if (url.startsWith("https://oauth.reddit.com/r/blocked/")) {
      return new Response("", { status: 403 });
    }
    throw new Error(`unexpected url ${url}`);
  }) as FetchLike;

  const result = await collectRedditPosts(fetchImpl, CREDS, ["goodsub", "blocked"], {
    maxItemsPerSubreddit: 10,
    delayMs: 0,
  });

  assert.equal(tokenCalls, 1);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0]!.subreddit, "goodsub");
  assert.ok("blocked" in result.errors);
});

test("collectRedditPosts continues after a listing with a malformed child", async () => {
  const fetchImpl: FetchLike = (async (url: string) => {
    if (url === "https://www.reddit.com/api/v1/access_token") {
      return jsonResponse({ access_token: "tok_xyz", expires_in: 3600 });
    }
    if (url.startsWith("https://oauth.reddit.com/r/malformed/")) {
      return jsonResponse(listingPayload([samplePost("bad", { num_comments: -1 })]));
    }
    if (url.startsWith("https://oauth.reddit.com/r/goodsub/")) {
      return jsonResponse(listingPayload([samplePost("g1", { subreddit: "goodsub" })]));
    }
    throw new Error(`unexpected url ${url}`);
  }) as FetchLike;

  const result = await collectRedditPosts(fetchImpl, CREDS, ["malformed", "goodsub"], {
    maxItemsPerSubreddit: 10,
    delayMs: 0,
  });

  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0]!.subreddit, "goodsub");
  assert.match(result.errors["malformed"] ?? "", /invalid.*listing/i);
});
