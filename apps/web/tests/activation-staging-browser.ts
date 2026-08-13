import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const verifyExisting = process.env.VERIFY_EXISTING === "1";
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const appManifest = JSON.parse(await readFile(path.join(repositoryRoot, "apps/invited-publisher-extension/apppass.json"), "utf8")) as {
  app_id: string; name: string; publisher_name: string; distributions: Array<{ runtime_id: string }>;
};
const runtimeId = appManifest.distributions[0]?.runtime_id;
assert.ok(runtimeId);
const storageKey = (item: "pending" | "session") => `app-pass:${new URL(appOrigin).origin}:${appManifest.app_id}:${item}`;
const state = JSON.parse(await readFile(path.join(repositoryRoot, ".extension-dev-browser/state.json"), "utf8")) as {
  status: string; cdpUrl: string; extensions: Array<{ id: string; pageUrl: string }>;
};
assert.equal(state.status, "ready");
const extension = state.extensions.find((candidate) => candidate.id === runtimeId);
assert.ok(extension);

type ExtensionChrome = {
  storage: { local: {
    clear(): Promise<void>;
    get(key: string): Promise<Record<string, unknown>>;
  } };
};

function remoteSql(sql: string) {
  return execFileSync("pnpm", ["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-staging", "--env", "staging", "--remote", "--command", sql], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

const browser = await chromium.connectOverCDP(state.cdpUrl);
const context = browser.contexts()[0];
assert.ok(context);
let popup = context.pages().find((candidate) => candidate.url().startsWith(extension.pageUrl));
if (!popup) popup = await context.newPage();
await popup.goto(`${extension.pageUrl}?authority=${encodeURIComponent(appOrigin)}`);

if (!verifyExisting) {
  await context.clearCookies();
  await popup.evaluate(async () => void await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.clear());
  await popup.reload();
  await popup.getByText("Approved by Apps Pass").waitFor();

  const subscriberPage = await context.newPage();
  await subscriberPage.goto(`${appOrigin}/account`);
  await subscriberPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await subscriberPage.getByLabel("Name").fill("Staging Activation Subscriber");
  await subscriberPage.getByLabel("Email").fill(`staging-activation-${Date.now()}@example.test`);
  await subscriberPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await subscriberPage.getByRole("button", { name: "Create account" }).click();
  await subscriberPage.getByText("Human session active").waitFor();

  const activationPromise = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
  const activation = await activationPromise;
  await activation.waitForURL(`${appOrigin}/activate/**`);
  await activation.getByRole("heading", { name: appManifest.name }).waitFor();
  assert.equal(await activation.getByText(`Published by ${appManifest.publisher_name}`).isVisible(), true);
  await activation.getByRole("button", { name: "Approve this extension" }).click();
  await activation.getByText("Approved. Return to the extension and choose Finish linking.").waitFor();
  const pending = await popup.evaluate(async (pendingKey) => {
    const values = await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(pendingKey);
    return JSON.parse(String(values[pendingKey])) as { requestId: string; proofKey: string };
  }, storageKey("pending"));
  await popup.reload();
  await popup.getByRole("button", { name: "Finish linking after approval" }).click();
  await popup.getByText("Linked. Apps Pass access can now be checked.").waitFor();
  const replayStatus = await popup.evaluate(async ({ appOrigin, pending }) => (await fetch(
    `${appOrigin}/api/app-pass/link-requests/${pending.requestId}/exchange`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proofKey: pending.proofKey }) },
  )).status, { appOrigin, pending });
  assert.equal(replayStatus, 409);
}

await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("inactive", { exact: true }).waitFor();
await popup.getByText("does not currently have paid-through Apps Pass access").waitFor();
const sessionKey = storageKey("session");
const stored = await popup.evaluate(async (key) => await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(key), sessionKey);
const token = stored[sessionKey];
if (typeof token !== "string") throw new Error("Staging extension App-session token is missing");
const tokenHash = createHash("sha256").update(token).digest("hex");
const sessionState = remoteSql(`SELECT session.id, session.token_hash, link.app_id FROM app_session session JOIN app_link link ON link.id = session.app_link_id WHERE session.token_hash = '${tokenHash}'`);
assert.equal(sessionState.includes(token), false);
assert.equal(sessionState.includes(tokenHash), true);
assert.equal(sessionState.includes(appManifest.app_id), true);
const crossAppStatus = await popup.evaluate(async ({ appOrigin, runtimeId, token }) => (await fetch(`${appOrigin}/api/app-pass/entitlements/check`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "x-app-id": "app_wrong_private_pilot", "x-runtime-id": runtimeId },
})).status, { appOrigin, runtimeId, token });
assert.equal(crossAppStatus, 401);
assert.equal((await fetch(`${appOrigin}/api/health`)).status, 200);

process.stdout.write(verifyExisting
  ? "PASS staging App session and inactive paid-through decision survive Worker redeployment\n"
  : "PASS real extension creates a persistent, hash-only staging App session and truthfully remains inactive without Stripe\n");
setTimeout(() => process.exit(0), 0);
