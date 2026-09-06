import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CliUsageError, parseArgs } from "../src/cli.js";

const CLI_PATH = join(process.cwd(), "dist", "src", "cli.js");

function run(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (exc) {
    const err = exc as { status: number | null; stdout: string; stderr: string };
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

test("CLI fixture mode writes JSON and HTML reports", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-"));
  try {
    const outJson = join(dir, "out.json");
    const outHtml = join(dir, "out.html");
    const result = run([
      "--fixture",
      "fixtures/sample_posts.json",
      "--out-json",
      outJson,
      "--out-html",
      outHtml,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(outJson));
    assert.ok(existsSync(outHtml));
    const data = JSON.parse(readFileSync(outJson, "utf-8"));
    assert.ok(data.opportunities.length >= 2);
    const html = readFileSync(outHtml, "utf-8");
    assert.ok(html.includes("Opportunités"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI reports a missing fixture without crashing", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-"));
  try {
    const outJson = join(dir, "out.json");
    const outHtml = join(dir, "out.html");
    const result = run([
      "--fixture",
      "fixtures/does_not_exist.json",
      "--out-json",
      outJson,
      "--out-html",
      outHtml,
    ]);
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes("at Object.<anonymous>"));
    assert.ok(!existsSync(outJson));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI live mode without credentials fails explicitly, mentioning the required env vars", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-"));
  try {
    const outJson = join(dir, "out.json");
    const outHtml = join(dir, "out.html");
    const result = run([
      "--live",
      "smallbusiness",
      "--out-json",
      outJson,
      "--out-html",
      outHtml,
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /REDDIT_CLIENT_ID/);
    assert.ok(!existsSync(outJson));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs rejects output paths that resolve to the same file", () => {
  assert.throws(
    () => parseArgs(["--out-json", "reports/same-output", "--out-html", "reports/./nested/../same-output"]),
    CliUsageError,
  );
});

test("parseArgs rejects a fixture path used as an output in fixture mode", () => {
  assert.throws(
    () => parseArgs(["--fixture", "fixtures/input.json", "--out-json", "fixtures/./input.json"]),
    CliUsageError,
  );
  assert.throws(
    () => parseArgs(["--fixture", "fixtures/input.json", "--out-html", "fixtures/./input.json"]),
    CliUsageError,
  );
});

test("parseArgs rejects output symlinks that target the same file", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const target = join(dir, "target");
    const outJson = join(dir, "json-link");
    const outHtml = join(dir, "html-link");
    writeFileSync(target, "untouched", "utf-8");
    symlinkSync(target, outJson);
    symlinkSync(target, outHtml);

    assert.throws(() => parseArgs(["--out-json", outJson, "--out-html", outHtml]), CliUsageError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs rejects dangling output symlinks with the same prospective target", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const target = join(dir, "future-report");
    const outJson = join(dir, "json-link");
    const outHtml = join(dir, "html-link");
    symlinkSync(target, outJson);
    symlinkSync(target, outHtml);

    assert.throws(() => parseArgs(["--out-json", outJson, "--out-html", outHtml]), CliUsageError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs rejects output paths that are hard links to the same file", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const outJson = join(dir, "report.json");
    const outHtml = join(dir, "report.html");
    writeFileSync(outJson, "untouched", "utf-8");
    linkSync(outJson, outHtml);

    assert.throws(() => parseArgs(["--out-json", outJson, "--out-html", outHtml]), CliUsageError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs resolves symlinked parents for nonexistent output leaves", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const realParent = join(dir, "real-parent");
    const linkedParent = join(dir, "linked-parent");
    mkdirSync(realParent);
    symlinkSync(realParent, linkedParent, "dir");

    assert.throws(
      () =>
        parseArgs([
          "--out-json",
          join(realParent, "future-report"),
          "--out-html",
          join(linkedParent, "future-report"),
        ]),
      CliUsageError,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI rejects output aliases through a symlinked directory and dot-dot without writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const left = join(dir, "left");
    const targetParent = join(dir, "target-parent");
    const targetSubdirectory = join(targetParent, "sub");
    const linkedDirectory = join(left, "link");
    mkdirSync(left);
    mkdirSync(targetSubdirectory, { recursive: true });
    symlinkSync(targetSubdirectory, linkedDirectory, "dir");

    const output = join(targetParent, "future-report");
    const alias = `${linkedDirectory}/../future-report`;
    const result = run([
      "--fixture",
      "fixtures/sample_posts.json",
      "--out-json",
      output,
      "--out-html",
      alias,
    ]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /same filesystem path/i);
    assert.ok(!existsSync(output));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI rejects a fixture/output alias through a symlinked directory and dot-dot without overwriting", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const left = join(dir, "left");
    const targetParent = join(dir, "target-parent");
    const targetSubdirectory = join(targetParent, "sub");
    const linkedDirectory = join(left, "link");
    mkdirSync(left);
    mkdirSync(targetSubdirectory, { recursive: true });
    symlinkSync(targetSubdirectory, linkedDirectory, "dir");

    const fixture = join(targetParent, "fixture.json");
    const fixtureContents = readFileSync("fixtures/sample_posts.json", "utf-8");
    const fixtureAlias = `${linkedDirectory}/../fixture.json`;
    const outHtml = join(dir, "report.html");
    writeFileSync(fixture, fixtureContents, "utf-8");

    const result = run(["--fixture", fixture, "--out-json", fixtureAlias, "--out-html", outHtml]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Fixture and output paths/i);
    assert.equal(readFileSync(fixture, "utf-8"), fixtureContents);
    assert.ok(!existsSync(outHtml));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs ignores fixture/output aliasing in live mode", () => {
  assert.doesNotThrow(() =>
    parseArgs([
      "--live",
      "smallbusiness",
      "--fixture",
      "reports/live.json",
      "--out-json",
      "reports/live.json",
      "--out-html",
      "reports/live.html",
    ]),
  );
});

test("CLI rejects a fixture/output alias without modifying the fixture", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-alias-"));
  try {
    const fixture = join(dir, "fixture.json");
    const outHtml = join(dir, "report.html");
    const fixtureContents = readFileSync("fixtures/sample_posts.json", "utf-8");
    writeFileSync(fixture, fixtureContents, "utf-8");

    const result = run(["--fixture", fixture, "--out-json", fixture, "--out-html", outHtml]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Fixture and output paths/i);
    assert.equal(readFileSync(fixture, "utf-8"), fixtureContents);
    assert.ok(!existsSync(outHtml));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI rejects identical resolved output paths before reading input", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-"));
  try {
    const output = join(dir, "same-output");
    const result = run([
      "--fixture",
      "fixtures/does_not_exist.json",
      "--out-json",
      output,
      "--out-html",
      join(dir, ".", "same-output"),
    ]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /same filesystem path/i);
    assert.ok(!existsSync(output));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseArgs rejects invalid max-items values with CliUsageError", () => {
  for (const value of ["NaN", "Infinity", "1.5", "0", "-1"]) {
    assert.throws(() => parseArgs(["--max-items", value]), CliUsageError, value);
  }
});

test("parseArgs rejects invalid timeout values with CliUsageError", () => {
  for (const value of ["NaN", "Infinity", "0", "-1"]) {
    assert.throws(() => parseArgs(["--timeout", value]), CliUsageError, value);
  }
});

test("parseArgs rejects invalid delay values with CliUsageError", () => {
  for (const value of ["NaN", "Infinity", "-1"]) {
    assert.throws(() => parseArgs(["--delay", value]), CliUsageError, value);
  }
});

test("parseArgs rejects timer delays above the Node maximum", () => {
  for (const argument of ["--timeout", "--delay"]) {
    assert.throws(() => parseArgs([argument, "2147483648"]), CliUsageError, argument);
    assert.doesNotThrow(() => parseArgs([argument, "2147483647"]), argument);
  }
});

test("parseArgs rejects an empty live subreddit list with CliUsageError", () => {
  for (const value of ["", "   ", ",", " , , "]) {
    assert.throws(() => parseArgs(["--live", value]), CliUsageError, JSON.stringify(value));
  }
});

test("CLI rejects invalid live options before credentials or output", () => {
  const dir = mkdtempSync(join(tmpdir(), "painradar-cli-"));
  try {
    const outJson = join(dir, "out.json");
    const outHtml = join(dir, "out.html");
    const result = run([
      "--live",
      " , , ",
      "--out-json",
      outJson,
      "--out-html",
      outHtml,
    ]);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.ok(!result.stderr.includes("REDDIT_CLIENT_ID"));
    assert.ok(!existsSync(outJson));
    assert.ok(!existsSync(outHtml));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
