import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createAppPass, type AppPassStorage } from "../packages/app-pass-sdk/src/index";

const authorityUrl = "http://127.0.0.1:8787";
let authority: ChildProcess | undefined;
let serpSessionId: string | undefined;
type InspectableStorage = AppPassStorage & { read(key: string): string | undefined };
const activeClients: Array<{
  appId: string;
  runtimeId: string;
  client: ReturnType<typeof createAppPass>;
  storage: InspectableStorage;
}> = [];

function runPnpm(args: string[]) {
  return spawnSync("pnpm", args, { cwd: process.cwd(), encoding: "utf8", env: process.env });
}

function requireSuccess(result: ReturnType<typeof runPnpm>) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function commandJson(output: string): unknown {
  const line = output.trim().split("\n").at(-1);
  assert.ok(line, "Expected command JSON output");
  return JSON.parse(line);
}

function manifest(relativePath: string) {
  return JSON.parse(readFileSync(relativePath, "utf8")) as {
    app_id: string;
    distributions: Array<{ runtime_id: string }>;
  };
}

function memoryStorage(): InspectableStorage {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => void values.set(key, value),
    remove: async (key) => void values.delete(key),
    read: (key) => values.get(key),
  };
}

async function waitForAuthority() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${authorityUrl}/health`)).ok) return;
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
  requireSuccess(runPnpm(["operator:import-app", "examples/serp-reference/apppass.json"]));
  requireSuccess(runPnpm(["operator:import-app", "examples/invited-publisher-reference/apppass.json"]));
  requireSuccess(runPnpm(["operator:activate-local-subscription"]));
});

after(() => {
  authority?.kill("SIGTERM");
});

test("both imported Apps receive active through the shared SDK and Subscription", async () => {
  for (const manifestPath of [
    "examples/serp-reference/apppass.json",
    "examples/invited-publisher-reference/apppass.json",
  ]) {
    const app = manifest(manifestPath);
    const storage = memoryStorage();
    const client = createAppPass({
      appId: app.app_id,
      runtimeId: app.distributions[0]!.runtime_id,
      authorityBaseUrl: authorityUrl,
      storage,
    });
    const link = await client.beginLink();
    requireSuccess(runPnpm(["operator:approve-link", link.requestId]));
    await client.finishLink();
    assert.deepEqual(await client.check(), {
      status: "active",
      features: ["premium"],
    });
    activeClients.push({
      appId: app.app_id,
      runtimeId: app.distributions[0]!.runtime_id,
      client,
      storage,
    });
  }
});

test("link exchange is proof-bound and single-use", async () => {
  const app = manifest("examples/serp-reference/apppass.json");
  const storage = memoryStorage();
  const client = createAppPass({
    appId: app.app_id,
    runtimeId: app.distributions[0]!.runtime_id,
    authorityBaseUrl: authorityUrl,
    storage,
  });
  const link = await client.beginLink();
  requireSuccess(runPnpm(["operator:approve-link", link.requestId]));
  const pending = JSON.parse(storage.read(`app-pass:${app.app_id}:pending`)!) as {
    requestId: string;
    proofKey: string;
  };
  const wrongProof = await fetch(`${authorityUrl}/app-pass/link-requests/${link.requestId}/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proofKey: "wrong-proof-key-that-is-long-enough" }),
  });
  assert.equal(wrongProof.status, 400);
  await client.finishLink();
  const replay = await fetch(`${authorityUrl}/app-pass/link-requests/${link.requestId}/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proofKey: pending.proofKey }),
  });
  assert.equal(replay.status, 400);
});

test("an App-session token cannot be claimed by another App", async () => {
  const [serp, invited] = activeClients;
  assert.ok(serp && invited);
  const token = serp.storage.read(`app-pass:${serp.appId}:session`);
  assert.ok(token);
  const response = await fetch(`${authorityUrl}/app-pass/entitlements/check`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-app-id": invited.appId,
      "x-runtime-id": invited.runtimeId,
    },
  });
  assert.equal(response.status, 401);
});

test("an approved link cannot exchange after expiry", async () => {
  const app = manifest("examples/serp-reference/apppass.json");
  const client = createAppPass({
    appId: app.app_id,
    runtimeId: app.distributions[0]!.runtime_id,
    authorityBaseUrl: authorityUrl,
    storage: memoryStorage(),
  });
  const link = await client.beginLink();
  requireSuccess(runPnpm(["operator:approve-link", link.requestId]));
  requireSuccess(runPnpm(["operator:expire-link", link.requestId]));
  await assert.rejects(client.finishLink(), /expired/u);
});

test("operator state exposes hashes but never App-session tokens", () => {
  const result = runPnpm(["operator:prototype-state"]);
  requireSuccess(result);
  const state = commandJson(result.stdout) as {
    sessions: Array<{ id: string; appId: string; tokenHash: string; revokedAt: number | null }>;
  };
  assert.ok(state.sessions.length >= 2);
  for (const active of activeClients) {
    const session = state.sessions.find((candidate) => candidate.appId === active.appId);
    assert.ok(session);
    const token = active.storage.read(`app-pass:${active.appId}:session`);
    assert.ok(token);
    assert.notEqual(session.tokenHash, token);
    assert.equal(JSON.stringify(state).includes(token), false);
  }
  serpSessionId = state.sessions.find((session) => session.appId === activeClients[0]!.appId)?.id;
  assert.ok(serpSessionId);
});

test("revoking one App session leaves the other App active", async () => {
  assert.ok(serpSessionId);
  requireSuccess(runPnpm(["operator:revoke-session", serpSessionId]));
  assert.deepEqual(await activeClients[0]!.client.check(), {
    status: "revoked",
    reason: "session_revoked",
  });
  assert.deepEqual(await activeClients[1]!.client.check(), {
    status: "active",
    features: ["premium"],
  });
});

test("suspending one App revokes that App without changing another App", async () => {
  const invited = activeClients[1]!;
  requireSuccess(runPnpm(["operator:set-app-status", invited.appId, "suspended"]));
  assert.deepEqual(await invited.client.check(), {
    status: "revoked",
    reason: "app_suspended",
  });
  assert.deepEqual(await activeClients[0]!.client.check(), {
    status: "revoked",
    reason: "session_revoked",
  });
});
