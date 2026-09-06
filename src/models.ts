export interface Post {
  readonly id: string;
  readonly title: string;
  readonly selftext: string;
  readonly subreddit: string;
  readonly author: string;
  readonly score: number;
  readonly num_comments: number;
  readonly created_utc: number;
  readonly url: string;
}

const REQUIRED_FIELDS = [
  "id",
  "title",
  "selftext",
  "subreddit",
  "author",
  "score",
  "num_comments",
  "created_utc",
  "url",
] as const;

function toIntOrThrow(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Math.trunc(Number(value));
  }
  throw new TypeError(`Field '${field}' cannot be coerced to an integer`);
}

export function postFromRecord(raw: Record<string, unknown>): Post {
  const missing = REQUIRED_FIELDS.filter((field) => !(field in raw));
  if (missing.length > 0) {
    throw new Error(`Post is missing required fields: ${JSON.stringify(missing)}`);
  }
  return {
    id: String(raw["id"]),
    title: String(raw["title"]),
    selftext: String(raw["selftext"]),
    subreddit: String(raw["subreddit"]),
    author: String(raw["author"]),
    score: toIntOrThrow(raw["score"], "score"),
    num_comments: toIntOrThrow(raw["num_comments"], "num_comments"),
    created_utc: toIntOrThrow(raw["created_utc"], "created_utc"),
    url: String(raw["url"]),
  };
}
