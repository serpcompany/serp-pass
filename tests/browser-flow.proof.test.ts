// Executable evidence for the disposable Chromium browser proof.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createSyntheticSubmission } from "./helpers/synthetic-submission";

function runPnpm(args: string[]) {
  return spawnSync("pnpm", args, { cwd: process.cwd(), encoding: "utf8", env: process.env });
}

test("every discovered unpacked extension links and receives active in Chromium", () => {
  const result = spawnSync("pnpm", ["proof:browser"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const line = result.stdout.trim().split("\n").at(-1);
  assert.ok(line);
  const evidence = JSON.parse(line) as {
    extensions: Array<{ appId: string; runtimeId: string; entitlement: { status: string } }>;
    subscriptionId: string;
  };
  assert.ok(evidence.extensions.length >= 2);
  assert.ok(evidence.extensions.every((extension) => extension.entitlement.status === "active"));
  assert.equal(new Set(evidence.extensions.map((extension) => extension.appId)).size, evidence.extensions.length);
  assert.equal(new Set(evidence.extensions.map((extension) => extension.runtimeId)).size, evidence.extensions.length);
  assert.equal(evidence.subscriptionId, "subscription_local");
});

test("browser harness exercises a synthetic third discovered submission", () => {
  const baselineCount = readdirSync("examples", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join("examples", entry.name, "apppass.json")))
    .length;
  const synthetic = createSyntheticSubmission();
  try {
    assert.equal(runPnpm(["dev:browser:stop"]).status, 0);
    assert.equal(runPnpm(["dev:browser"]).status, 0);
    const result = runPnpm(["proof:browser"]);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const line = result.stdout.trim().split("\n").at(-1);
    assert.ok(line);
    const evidence = JSON.parse(line) as {
      extensions: Array<{ appId: string; runtimeId: string; entitlement: { status: string } }>;
    };
    assert.equal(evidence.extensions.length, baselineCount + 1);
    assert.equal(new Set(evidence.extensions.map((entry) => entry.appId)).size, evidence.extensions.length);
    assert.equal(new Set(evidence.extensions.map((entry) => entry.runtimeId)).size, evidence.extensions.length);
    assert.ok(evidence.extensions.every((entry) => entry.entitlement.status === "active"));
    assert.ok(evidence.extensions.some((entry) =>
      entry.appId === synthetic.appId && entry.runtimeId === synthetic.runtimeId && entry.entitlement.status === "active"));
  } finally {
    synthetic.remove();
    runPnpm(["dev:browser:stop"]);
    runPnpm(["dev:browser"]);
  }
});
