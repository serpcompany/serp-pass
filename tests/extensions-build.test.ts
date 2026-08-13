import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createSyntheticSubmission } from "./helpers/synthetic-submission";

test("generic discovery builds every submitted App as an unpacked extension", () => {
  const result = spawnSync("pnpm", ["extensions:build"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const line = result.stdout.trim().split("\n").at(-1);
  assert.ok(line);
  const built = (JSON.parse(line) as {
    built: Array<{ directory: string; appId: string; runtimeId: string }>;
  }).built;

  const submitted = readdirSync("examples", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join("examples", entry.name, "apppass.json")))
    .map((entry) => entry.name)
    .sort();
  assert.ok(submitted.length >= 2);
  assert.deepEqual(built.map((entry) => entry.directory), submitted);
  assert.equal(new Set(built.map((entry) => entry.appId)).size, built.length);
  assert.equal(new Set(built.map((entry) => entry.runtimeId)).size, built.length);
  for (const directory of submitted) {
    const output = path.join("examples", directory, "dist");
    const appManifest = JSON.parse(readFileSync(path.join("examples", directory, "apppass.json"), "utf8"));
    const chromiumManifest = JSON.parse(readFileSync(path.join(output, "manifest.json"), "utf8"));
    assert.equal(chromiumManifest.manifest_version, 3);
    assert.equal(chromiumManifest.action.default_popup, "popup.html");
    assert.ok(readFileSync(path.join(output, "popup.js"), "utf8").includes(appManifest.app_id));
  }
});

test("generic discovery builds a synthetic third submission without a fixture list", () => {
  const baselineCount = readdirSync("examples", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join("examples", entry.name, "apppass.json")))
    .length;
  const synthetic = createSyntheticSubmission();
  try {
    const result = spawnSync("pnpm", ["extensions:build"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const line = result.stdout.trim().split("\n").at(-1);
    assert.ok(line);
    const built = (JSON.parse(line) as { built: Array<{ appId: string }> }).built;
    assert.equal(built.length, baselineCount + 1);
    assert.ok(built.some((entry) => entry.appId === synthetic.appId));
  } finally {
    synthetic.remove();
  }
});
