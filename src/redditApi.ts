/**
 * Reddit OAuth Data API adapter (application-only client_credentials grant).
 *
 * Native `fetch` only — there is no official standalone Reddit JS SDK, so this
 * module talks to Reddit's HTTP API directly. Transport is injectable (the
 * `fetchImpl` parameter) so tests never touch the network. Credentials are read
 * only from REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USER_AGENT and are
 * never logged or persisted — only the resulting bearer token is kept in memory
 * for the lifetime of a single collection run.
 */
import { Post } from "./models.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export class RedditAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedditAuthError";
  }
}

export interface RateLimitInfo {
  used: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

const EMPTY_RATE_LIMIT: RateLimitInfo = { used: null, remaining: null, resetSeconds: null };

export interface AccessToken {
  token: string;
  obtainedAtMs: number;
  expiresInSeconds: number;
}

export interface SubredditFetchResult {
  ok: boolean;
  posts: Post[];
  error: string;
  rateLimit: RateLimitInfo;
}

export interface RedditCollectionResult {
  posts: Post[];
  errors: Record<string, string>;
}

export interface CollectOptions {
  maxItemsPerSubreddit: number;
  delayMs: number;
}

/** Reddit subreddit names are alphanumeric/underscore, 3-21 chars; enforced strictly
 * so a crafted "subreddit" can never redirect the request to another host/path. */
const SUBREDDIT_NAME_RE = /^[A-Za-z0-9_]{1,21}$/;

const REQUIRED_ENV_VARS = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadCredentialsFromEnv(
  env: Record<string, string | undefined> = process.env,
): RedditCredentials {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new RedditAuthError(`Missing required Reddit credentials: ${missing.join(", ")}`);
  }
  return {
    clientId: env["REDDIT_CLIENT_ID"]!,
    clientSecret: env["REDDIT_CLIENT_SECRET"]!,
    userAgent: env["REDDIT_USER_AGENT"]!,
  };
}

export async function fetchAccessToken(
  fetchImpl: FetchLike,
  creds: RedditCredentials,
): Promise<AccessToken> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  let response: Response;
  try {
    response = await fetchImpl("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": creds.userAgent,
      },
      body: "grant_type=client_credentials",
    });
  } catch (exc) {
    throw new RedditAuthError("Network error while obtaining Reddit OAuth token");
  }

  if (!response.ok) {
    throw new RedditAuthError(`Failed to obtain Reddit OAuth token: HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (exc) {
    throw new RedditAuthError("Reddit OAuth token response was not valid JSON");
  }

  if (!isObject(data) || typeof data["access_token"] !== "string" || data["access_token"].length === 0) {
    throw new RedditAuthError("Reddit OAuth token response did not contain a valid access_token");
  }
  const expiresIn = data["expires_in"];
  if (expiresIn !== undefined && (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0)) {
    throw new RedditAuthError("Reddit OAuth token response contained an invalid expires_in");
  }

  return {
    token: data["access_token"],
    obtainedAtMs: Date.now(),
    expiresInSeconds: expiresIn ?? 3600,
  };
}

function parseFiniteHeader(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  return {
    used: parseFiniteHeader(headers.get("x-ratelimit-used")),
    remaining: parseFiniteHeader(headers.get("x-ratelimit-remaining")),
    resetSeconds: parseFiniteHeader(headers.get("x-ratelimit-reset")),
  };
}

interface RedditListingChildData {
  id: string;
  title: string;
  selftext?: string | null;
  subreddit: string;
  author: string | null;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink?: string | null;
  url?: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRedditListingChildData(value: unknown): value is RedditListingChildData {
  if (!isObject(value)) {
    return false;
  }
  const selftext = value["selftext"];
  const author = value["author"];
  const permalink = value["permalink"];
  const url = value["url"];
  return (
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["title"]) &&
    isNonEmptyString(value["subreddit"]) &&
    (author === null || isNonEmptyString(author)) &&
    (selftext === undefined || selftext === null || typeof selftext === "string") &&
    typeof value["score"] === "number" &&
    Number.isSafeInteger(value["score"]) &&
    typeof value["num_comments"] === "number" &&
    Number.isSafeInteger(value["num_comments"]) &&
    value["num_comments"] >= 0 &&
    typeof value["created_utc"] === "number" &&
    Number.isFinite(value["created_utc"]) &&
    value["created_utc"] >= 0 &&
    (permalink === undefined || permalink === null || typeof permalink === "string") &&
    (url === undefined || url === null || typeof url === "string") &&
    (isNonEmptyString(permalink) || isNonEmptyString(url))
  );
}

function childToPost(data: RedditListingChildData): Post {
  const permalink = data.permalink ?? "";
  const url = permalink ? `https://www.reddit.com${permalink}` : data.url ?? "";
  return {
    id: data.id,
    title: data.title,
    selftext: data.selftext ?? "",
    subreddit: data.subreddit,
    author: data.author ?? "[deleted]",
    score: data.score,
    num_comments: data.num_comments,
    created_utc: data.created_utc,
    url,
  };
}

/** Fetch one subreddit's newest listing via the OAuth Data API. Never throws:
 * every failure mode (invalid name, 401/403/429, other HTTP errors, network
 * errors, malformed JSON) is reported through the returned result. */
export async function fetchSubredditListing(
  fetchImpl: FetchLike,
  accessToken: string,
  userAgent: string,
  subreddit: string,
  maxItems: number,
): Promise<SubredditFetchResult> {
  if (!SUBREDDIT_NAME_RE.test(subreddit)) {
    return {
      ok: false,
      posts: [],
      error: `Invalid subreddit name (rejected to prevent URL injection): ${JSON.stringify(subreddit)}`,
      rateLimit: EMPTY_RATE_LIMIT,
    };
  }

  const boundedLimit = Math.max(0, Math.min(maxItems, 100));
  const url = new URL(`https://oauth.reddit.com/r/${subreddit}/new`);
  url.searchParams.set("limit", String(boundedLimit || 1));
  url.searchParams.set("raw_json", "1");

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": userAgent,
      },
    });
  } catch (exc) {
    return {
      ok: false,
      posts: [],
      error: `Network error fetching r/${subreddit}.`,
      rateLimit: EMPTY_RATE_LIMIT,
    };
  }

  const rateLimit = parseRateLimitHeaders(response.headers);

  if (response.status === 401) {
    return { ok: false, posts: [], error: `HTTP 401 Unauthorized for r/${subreddit} (invalid or expired token).`, rateLimit };
  }
  if (response.status === 403) {
    return { ok: false, posts: [], error: `HTTP 403 Forbidden for r/${subreddit}.`, rateLimit };
  }
  if (response.status === 429) {
    return {
      ok: false,
      posts: [],
      error: `HTTP 429 Too Many Requests for r/${subreddit}; not retrying, respect the rate limit.`,
      rateLimit,
    };
  }
  if (!response.ok) {
    return { ok: false, posts: [], error: `HTTP ${response.status} for r/${subreddit}.`, rateLimit };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (exc) {
    return { ok: false, posts: [], error: `Invalid JSON listing for r/${subreddit}.`, rateLimit };
  }

  if (!isObject(data) || !isObject(data["data"]) || !Array.isArray(data["data"]["children"])) {
    return { ok: false, posts: [], error: `Invalid Reddit listing for r/${subreddit}.`, rateLimit };
  }
  const children = data["data"]["children"];
  if (
    !children.every(
      (child) => isObject(child) && isRedditListingChildData(child["data"]),
    )
  ) {
    return { ok: false, posts: [], error: `Invalid Reddit listing for r/${subreddit}.`, rateLimit };
  }
  const posts = children
    .slice(0, boundedLimit)
    .map((child) => childToPost(child["data"] as RedditListingChildData));

  return { ok: true, posts, error: "", rateLimit };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bounded, polite collection across several subreddits using one application-only
 * OAuth token. Keeps going (and reports the failure) even if one subreddit fails. */
export async function collectRedditPosts(
  fetchImpl: FetchLike,
  creds: RedditCredentials,
  subreddits: string[],
  options: CollectOptions,
): Promise<RedditCollectionResult> {
  const result: RedditCollectionResult = { posts: [], errors: {} };
  const accessToken = await fetchAccessToken(fetchImpl, creds);

  for (let index = 0; index < subreddits.length; index += 1) {
    if (index > 0 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
    const subreddit = subreddits[index]!;
    const feedResult = await fetchSubredditListing(
      fetchImpl,
      accessToken.token,
      creds.userAgent,
      subreddit,
      options.maxItemsPerSubreddit,
    );
    if (feedResult.ok) {
      result.posts.push(...feedResult.posts);
    } else {
      result.errors[subreddit] = feedResult.error;
    }
  }

  return result;
}
