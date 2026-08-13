import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const authorityUrl = "http://127.0.0.1:8787";
let authority: ChildProcess | undefined;
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "apps-pass-import-proof-"));

function runPnpm(args: string[]) {
  return spawnSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
}

function requireSuccess(result: ReturnType<typeof runPnpm>) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function commandJson(output: string): unknown {
  const line = output.trim().split("\n").at(-1);
  assert.ok(line, "Expected command JSON output");
  return JSON.parse(line);
}

function currentState() {
  const result = runPnpm(["operator:state"]);
  requireSuccess(result);
  return commandJson(result.stdout);
}

function fixture(relativePath: string) {
  return JSON.parse(readFileSync(relativePath, "utf8")) as Record<string, unknown>;
}

function writeTestManifest(name: string, contents: string | Record<string, unknown>) {
  const target = path.join(temporaryDirectory, name);
  writeFileSync(target, typeof contents === "string" ? contents : JSON.stringify(contents));
  return target;
}

function requireRejectedWithoutStateChange(manifestPath: string) {
  const beforeState = currentState();
  const result = runPnpm(["operator:import-app", manifestPath]);
  assert.notEqual(result.status, 0, `Import unexpectedly succeeded:\n${result.stdout}`);
  assert.deepEqual(currentState(), beforeState);
}

async function waitForAuthority() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${authorityUrl}/health`);
      if (response.ok) return;
    } catch {
      // The local Worker is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local authority did not start");
}

before(async () => {
  requireSuccess(runPnpm(["db:reset"]));
  requireSuccess(runPnpm(["db:migrate"]));
  authority = spawn("pnpm", ["operator:serve"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
  });
  await waitForAuthority();
});

after(() => {
  authority?.kill("SIGTERM");
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("schema-only migrations leave participating state empty", () => {
  const result = runPnpm(["operator:state"]);
  requireSuccess(result);
  assert.deepEqual(commandJson(result.stdout), {
    publishers: [],
    apps: [],
    distributions: [],
  });
});

test("both fixture Apps enter through operator:import-app", () => {
  const serpImport = runPnpm(["operator:import-app", "examples/serp-reference/apppass.json"]);
  requireSuccess(serpImport);
  const invitedImport = runPnpm(["operator:import-app", "examples/invited-publisher-reference/apppass.json"]);
  requireSuccess(invitedImport);

  const stateResult = runPnpm(["operator:state"]);
  requireSuccess(stateResult);
  assert.deepEqual(commandJson(stateResult.stdout), {
    publishers: [
      { id: "pub_invited_reference", name: "Invited Publisher" },
      { id: "pub_serp_reference", name: "SERP" },
    ],
    apps: [
      {
        id: "app_invited_reference",
        publisherId: "pub_invited_reference",
        name: "Invited Publisher Reference Extension",
        features: ["premium"],
        status: "approved",
      },
      {
        id: "app_serp_reference",
        publisherId: "pub_serp_reference",
        name: "SERP Reference Extension",
        features: ["premium"],
        status: "approved",
      },
    ],
    distributions: [
      {
        appId: "app_invited_reference",
        browserFamily: "chromium",
        channel: "unpacked",
        runtimeId: "deigfiokgenocbkifhkognjkhfljcfgi",
      },
      {
        appId: "app_serp_reference",
        browserFamily: "chromium",
        channel: "unpacked",
        runtimeId: "gnofcoijgmmjbpbkflpnlflkgpmhppkh",
      },
    ],
  });
});

test("exact re-import is a no-op", () => {
  const beforeState = currentState();
  for (const manifestPath of [
    "examples/serp-reference/apppass.json",
    "examples/invited-publisher-reference/apppass.json",
  ]) {
    const result = runPnpm(["operator:import-app", manifestPath]);
    requireSuccess(result);
    assert.equal((commandJson(result.stdout) as { result: string }).result, "unchanged");
  }
  assert.deepEqual(currentState(), beforeState);
});

test("malformed JSON is rejected without writes", () => {
  requireRejectedWithoutStateChange(writeTestManifest("malformed.json", "{not-json"));
});

test("unsupported schema versions are rejected without writes", () => {
  const manifest = fixture("examples/serp-reference/apppass.json");
  manifest.schema_version = 2;
  requireRejectedWithoutStateChange(writeTestManifest("unsupported-version.json", manifest));
});

test("invalid fields and identifiers are rejected without writes", () => {
  const manifest = fixture("examples/serp-reference/apppass.json");
  manifest.app_id = "publisher-controlled-id";
  requireRejectedWithoutStateChange(writeTestManifest("invalid-id.json", manifest));
});

test("conflicting Publisher defining data is rejected without writes", () => {
  const manifest = fixture("examples/serp-reference/apppass.json");
  manifest.publisher_name = "Publisher Redefinition";
  manifest.app_id = "app_publisher_conflict";
  manifest.distributions = [{
    browser_family: "chromium",
    channel: "unpacked",
    runtime_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",
  }];
  requireRejectedWithoutStateChange(writeTestManifest("publisher-conflict.json", manifest));
});

test("conflicting App defining data is rejected without writes", () => {
  const manifest = fixture("examples/serp-reference/apppass.json");
  manifest.name = "App Redefinition";
  requireRejectedWithoutStateChange(writeTestManifest("app-conflict.json", manifest));
});

test("runtime identities owned by another App are rejected atomically", () => {
  const manifest = fixture("examples/serp-reference/apppass.json");
  manifest.publisher_id = "pub_runtime_conflict";
  manifest.publisher_name = "Runtime Conflict Publisher";
  manifest.app_id = "app_runtime_conflict";
  manifest.name = "Runtime Conflict App";
  requireRejectedWithoutStateChange(writeTestManifest("runtime-conflict.json", manifest));
});

test("fixture identities are absent from migrations and authority source", () => {
  const result = spawnSync("rg", [
    "-n",
    "pub_(serp|invited)_reference|app_(serp|invited)_reference|gnofcoijgmmjbpbkflpnlflkgpmhppkh|deigfiokgenocbkifhkognjkhfljcfgi",
    "migrations",
    "src",
    "scripts",
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 1, result.stdout);
});
