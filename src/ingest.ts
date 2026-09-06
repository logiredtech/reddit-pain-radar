import { readFileSync } from "node:fs";

import { Post, postFromRecord } from "./models.js";

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

export function loadPostsFromFixture(path: string): Post[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (exc) {
    throw new IngestError(`Fixture file not found: ${path}`);
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(raw);
  } catch (exc) {
    throw new IngestError(`Fixture file is not valid JSON: ${path} (${(exc as Error).message})`);
  }

  if (!Array.isArray(rawItems)) {
    throw new IngestError(`Fixture file must contain a JSON list of posts: ${path}`);
  }

  const posts: Post[] = [];
  rawItems.forEach((item, index) => {
    try {
      posts.push(postFromRecord(item as Record<string, unknown>));
    } catch (exc) {
      throw new IngestError(`Invalid post at index ${index} in ${path}: ${(exc as Error).message}`);
    }
  });
  return posts;
}
