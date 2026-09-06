import { lstatSync, mkdirSync, readlinkSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";

import { IngestError, loadPostsFromFixture } from "./ingest.js";
import { Post } from "./models.js";
import { runPipeline } from "./pipeline.js";
import { RedditAuthError, collectRedditPosts, loadCredentialsFromEnv } from "./redditApi.js";

interface CliOptions {
  fixture: string;
  live: string | null;
  maxItems: number;
  timeoutMs: number;
  delayMs: number;
  outJson: string;
  outHtml: string;
}

const DEFAULTS: CliOptions = {
  fixture: "fixtures/sample_posts.json",
  live: null,
  maxItems: 15,
  timeoutMs: 8000,
  delayMs: 2000,
  outJson: "reports/report.json",
  outHtml: "reports/report.html",
};

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export class CliUsageError extends Error {}

function canonicalProspectivePath(path: string): string {
  let existingPath = path;
  const missingSegments: string[] = [];
  const visitedSymlinks = new Set<string>();

  const appendSegments = (base: string, segments: string[]): string =>
    segments.reduce((current, segment) => `${current}${current.endsWith(sep) ? "" : sep}${segment}`, base);

  while (true) {
    try {
      return resolve(realpathSync.native(existingPath), ...missingSegments);
    } catch {
      try {
        if (lstatSync(existingPath).isSymbolicLink()) {
          if (visitedSymlinks.has(existingPath)) {
            return resolve(path);
          }
          visitedSymlinks.add(existingPath);
          const target = readlinkSync(existingPath);
          const targetPath = isAbsolute(target) ? target : appendSegments(dirname(existingPath), [target]);
          existingPath = appendSegments(targetPath, missingSegments);
          missingSegments.length = 0;
          continue;
        }
      } catch {
        // Walk upward until an existing ancestor can be resolved.
      }

      const parent = dirname(existingPath);
      if (parent === existingPath) {
        return resolve(path);
      }
      missingSegments.unshift(basename(existingPath));
      existingPath = parent;
    }
  }
}

interface PathIdentity {
  canonicalPath: string;
  fileId: string | null;
}

function identifyPath(path: string): PathIdentity {
  let fileId: string | null = null;
  try {
    const stats = statSync(path, { bigint: true });
    fileId = `${stats.dev}:${stats.ino}`;
  } catch {
    // A prospective output need not exist yet; its canonical path is still comparable.
  }
  return { canonicalPath: canonicalProspectivePath(path), fileId };
}

function pathsAlias(left: PathIdentity, right: PathIdentity): boolean {
  return left.canonicalPath === right.canonicalPath || (left.fileId !== null && left.fileId === right.fileId);
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = (): string => {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        throw new CliUsageError(`Missing value for argument ${arg}`);
      }
      return value;
    };
    switch (arg) {
      case "--fixture":
        options.fixture = next();
        break;
      case "--live":
        options.live = next();
        break;
      case "--max-items":
        options.maxItems = Number(next());
        break;
      case "--timeout":
        options.timeoutMs = Number(next());
        break;
      case "--delay":
        options.delayMs = Number(next());
        break;
      case "--out-json":
        options.outJson = next();
        break;
      case "--out-html":
        options.outHtml = next();
        break;
      default:
        throw new CliUsageError(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.maxItems) || !Number.isInteger(options.maxItems) || options.maxItems <= 0) {
    throw new CliUsageError("--max-items must be a positive integer");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > MAX_TIMER_DELAY_MS) {
    throw new CliUsageError(`--timeout must be a finite positive number no greater than ${MAX_TIMER_DELAY_MS}`);
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0 || options.delayMs > MAX_TIMER_DELAY_MS) {
    throw new CliUsageError(`--delay must be a finite non-negative number no greater than ${MAX_TIMER_DELAY_MS}`);
  }
  const outJsonPath = identifyPath(options.outJson);
  const outHtmlPath = identifyPath(options.outHtml);
  if (pathsAlias(outJsonPath, outHtmlPath)) {
    throw new CliUsageError("--out-json and --out-html must not resolve to the same filesystem path");
  }
  if (options.live === null) {
    const fixturePath = identifyPath(options.fixture);
    if (pathsAlias(fixturePath, outJsonPath) || pathsAlias(fixturePath, outHtmlPath)) {
      throw new CliUsageError("Fixture and output paths must not resolve to the same filesystem path");
    }
  }
  if (
    options.live !== null &&
    options.live
      .split(",")
      .map((subreddit) => subreddit.trim())
      .every((subreddit) => subreddit.length === 0)
  ) {
    throw new CliUsageError("--live must contain at least one subreddit");
  }
  return options;
}

function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

async function loadLivePosts(options: CliOptions): Promise<Post[]> {
  const subreddits = options.live!
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const creds = loadCredentialsFromEnv();
  const fetchImpl = fetchWithTimeout(options.timeoutMs);
  const result = await collectRedditPosts(fetchImpl, creds, subreddits, {
    maxItemsPerSubreddit: options.maxItems,
    delayMs: options.delayMs,
  });

  for (const [subreddit, error] of Object.entries(result.errors)) {
    process.stderr.write(`[avertissement] r/${subreddit} : ${error}\n`);
  }
  return result.posts;
}

function writeOutputs(reportDict: Record<string, unknown>, html: string, outJson: string, outHtml: string): void {
  for (const path of [outJson, outHtml]) {
    const dir = dirname(path);
    if (dir) {
      mkdirSync(dir, { recursive: true });
    }
  }
  writeFileSync(outJson, JSON.stringify(reportDict, null, 2), "utf-8");
  writeFileSync(outHtml, html, "utf-8");
}

export async function main(argv: string[]): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (exc) {
    process.stderr.write(`Erreur : ${(exc as Error).message}\n`);
    return 2;
  }

  let posts: Post[];
  let sourceDescription: string;
  try {
    if (options.live) {
      posts = await loadLivePosts(options);
      sourceDescription = `Reddit OAuth API: ${options.live}`;
    } else {
      posts = loadPostsFromFixture(options.fixture);
      sourceDescription = `fixture: ${options.fixture}`;
    }
  } catch (exc) {
    if (exc instanceof IngestError || exc instanceof RedditAuthError) {
      process.stderr.write(`Erreur : ${exc.message}\n`);
      return 1;
    }
    throw exc;
  }

  const { reportDict, html } = runPipeline(posts, sourceDescription);
  writeOutputs(reportDict, html, options.outJson, options.outHtml);

  const opportunities = reportDict["opportunities"] as unknown[];
  process.stdout.write(`${posts.length} posts analysés, ${opportunities.length} opportunité(s) détectée(s).\n`);
  process.stdout.write(`Rapport JSON : ${options.outJson}\n`);
  process.stdout.write(`Rapport HTML : ${options.outHtml}\n`);
  return 0;
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((exc) => {
      process.stderr.write(`Erreur inattendue : ${(exc as Error).message}\n`);
      process.exitCode = 1;
    });
}
