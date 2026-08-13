import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validatedManifest } from "@serp-apps-pass/contracts";

const appRoot = path.resolve(import.meta.dirname, "..");
const stagingOrigin = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const expectedRuntimeId = "bpjnchabpcjomgncmbgphbdggkgkobdb";

const sourceManifest = JSON.parse(await readFile(path.join(appRoot, "src/manifest.json"), "utf8")) as { key?: string };
const submission = validatedManifest(JSON.parse(await readFile(path.join(appRoot, "apppass.json"), "utf8")));
assert.ok(sourceManifest.key, "The extension manifest needs its stable public key");
const digest = createHash("sha256").update(Buffer.from(sourceManifest.key, "base64")).digest().subarray(0, 16);
const runtimeId = [...digest].flatMap((byte) => [byte >> 4, byte & 15]).map((nibble) => String.fromCharCode(97 + nibble)).join("");
assert.equal(runtimeId, expectedRuntimeId, "The public key no longer derives the documented runtime ID");
assert.equal(submission.distributions[0]?.runtime_id, expectedRuntimeId, "apppass.json does not describe this extension build");
assert.equal(submission.app_id, "app_john_doe_focus_timer");

const health = await fetch(`${stagingOrigin}/api/health`);
assert.equal(health.ok, true, `Staging health failed with ${health.status}`);
const identity = await fetch(`${stagingOrigin}/api/app-pass/apps/${submission.app_id}/distributions/${runtimeId}`);
assert.ok(identity.status === 200 || identity.status === 404, `Unexpected identity response ${identity.status}`);

process.stdout.write(JSON.stringify({
  result: "PASS",
  staging: "healthy",
  publisherId: submission.publisher_id,
  appId: submission.app_id,
  runtimeId,
  submissionState: identity.status === 404 ? "unused_ready_for_walkthrough" : "already_registered_review_existing_run",
}, null, 2) + "\n");
