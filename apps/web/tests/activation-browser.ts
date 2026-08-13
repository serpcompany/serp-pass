import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
if (!appOrigin.includes("localhost")) throw new Error("The activation browser test currently requires the account-free local billing fixture.");
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const appManifest = JSON.parse(await readFile(path.join(repositoryRoot, "apps/invited-publisher-extension/apppass.json"), "utf8")) as {
  publisher_id: string; publisher_name: string; app_id: string; name: string; distributions: Array<{ runtime_id: string }>;
};
const runtimeId = appManifest.distributions[0]?.runtime_id;
assert.ok(runtimeId);
const extensionOrigin = `chrome-extension://${runtimeId}`;
const state = JSON.parse(await readFile(path.join(repositoryRoot, ".extension-dev-browser/state.json"), "utf8")) as {
  status: string; cdpUrl: string; extensions: Array<{ id: string; pageUrl: string; path: string }>;
};
assert.equal(state.status, "ready");
const extension = state.extensions.find((candidate) => candidate.id === runtimeId);
assert.ok(extension, "The repo-owned browser must load the independently built Publisher extension");

const devVarsPath = path.join(repositoryRoot, "apps/web/.dev.vars");
const fixtureSecret = process.env.TEST_BILLING_WEBHOOK_SECRET ?? (existsSync(devVarsPath)
  ? /^TEST_BILLING_WEBHOOK_SECRET=(.+)$/mu.exec(readFileSync(devVarsPath, "utf8"))?.[1]?.trim()
  : undefined);
if (!fixtureSecret) throw new Error("Local signed billing fixture secret is required");
const billingFixtureSecret = fixtureSecret;

type ExtensionChrome = {
  storage: { local: {
    clear(): Promise<void>;
    get(key: string): Promise<Record<string, unknown>>;
    remove(key: string): Promise<void>;
  } };
};

function runPnpm(args: string[]) {
  return execFileSync("pnpm", args, { cwd: repositoryRoot, encoding: "utf8" });
}

function localSql(sql: string) {
  return runPnpm(["--filter", "@serp-apps-pass/web", "exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--persist-to", "../../.wrangler/mvp-state", "--command", sql]);
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
}

async function ensureRealApp(browserContext: BrowserContext) {
  const identityUrl = `${appOrigin}/api/app-pass/apps/${appManifest.app_id}/distributions/${runtimeId}`;
  if ((await fetch(identityUrl)).ok) return;
  const suffix = Date.now();
  const operatorEmail = `activation-operator-${suffix}@example.test`;
  const publisherEmail = `activation-publisher-${suffix}@example.test`;
  const operatorContext = await browserContext.browser()!.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.70" } });
  const publisherContext = await browserContext.browser()!.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.71" } });
  try {
    const operatorPage = await operatorContext.newPage();
    await signUp(operatorPage, "Activation Operator", operatorEmail);
    runPnpm(["mvp:operator:bootstrap", "--", "--local", operatorEmail]);
    await operatorPage.goto(`${appOrigin}/operator`);
    await operatorPage.getByLabel("Publisher email").fill(publisherEmail);
    await operatorPage.getByLabel("Publisher public ID").fill(appManifest.publisher_id);
    await operatorPage.getByLabel("Publisher name").fill(appManifest.publisher_name);
    await operatorPage.getByLabel("First App public ID").fill(appManifest.app_id);
    await operatorPage.getByRole("button", { name: "Create Publisher invitation" }).click();
    const invitationCode = await operatorPage.getByTestId("invitation-code").innerText();

    const publisherPage = await publisherContext.newPage();
    await signUp(publisherPage, "Activation Publisher", publisherEmail);
    await publisherPage.goto(`${appOrigin}/publisher/invitation`);
    await publisherPage.getByLabel("Invitation code").fill(invitationCode);
    await publisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
    await publisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
    await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(appManifest, null, 2));
    await publisherPage.getByLabel("Ownership evidence").fill("Independently built Publisher extension source and stable Chromium runtime reviewed for the activation slice.");
    await publisherPage.getByRole("button", { name: "Submit App for review" }).click();
    await publisherPage.getByText(`${appManifest.app_id} · pending`).waitFor();

    await operatorPage.reload();
    const review = operatorPage.locator("form").filter({ hasText: `${appManifest.app_id} · pending` });
    await review.getByLabel("Review reason").fill("Independent extension source, manifest, ownership evidence, and runtime identity reviewed.");
    await review.getByRole("button", { name: "Approve Submission" }).click();
    await operatorPage.getByText(`${appManifest.app_id} · pending`).waitFor({ state: "detached" });
  } finally {
    await operatorContext.close();
    await publisherContext.close();
  }
  const response = await fetch(identityUrl);
  assert.equal(response.status, 200, await response.text());
}

async function grantPaidThrough(subscriberUserId: string) {
  const suffix = Date.now();
  const body = JSON.stringify({
    id: `evt_activation_paid_${suffix}`,
    type: "invoice.paid",
    createdAt: 1_900_000_000,
    mode: "test",
    data: {
      subscriberUserId,
      customerId: `cus_activation_${suffix}`,
      subscriptionId: `sub_activation_${suffix}`,
      invoiceId: `in_activation_${suffix}`,
      amountPaid: 1000,
      currency: "usd",
      periodStart: 4_070_908_800,
      periodEnd: 4_102_444_800,
    },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", billingFixtureSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${appOrigin}/api/billing/test-events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-apps-pass-test-signature": `t=${timestamp},v1=${signature}` },
    body,
  });
  assert.equal(response.status, 202, await response.text());
}

const browser = await chromium.connectOverCDP(state.cdpUrl);
const persistentContext = browser.contexts()[0];
assert.ok(persistentContext);
await ensureRealApp(persistentContext);
await persistentContext.clearCookies();

let popup = persistentContext.pages().find((candidate) => candidate.url() === extension.pageUrl);
if (!popup) {
  popup = await persistentContext.newPage();
}
await popup.goto(`${extension.pageUrl}?authority=${encodeURIComponent(appOrigin)}`);
await popup.evaluate(async () => void await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.clear());

const subscriberPage = await persistentContext.newPage();
const subscriberEmail = `activation-subscriber-${Date.now()}@example.test`;
await signUp(subscriberPage, "Activation Subscriber", subscriberEmail);
const subscriberUserId = await subscriberPage.evaluate(async () => {
  const response = await fetch("/api/auth/get-session");
  const body = await response.json() as { user: { id: string } };
  return body.user.id;
});

await popup.reload();
await popup.getByText("Approved by Apps Pass").waitFor();
const activationPagePromise = persistentContext.waitForEvent("page");
await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
const activationPage = await activationPagePromise;
await activationPage.waitForURL(`${appOrigin}/activate/**`);
await activationPage.getByRole("heading", { name: appManifest.name }).waitFor();
assert.equal(await activationPage.getByText(`Published by ${appManifest.publisher_name}`).isVisible(), true);
await activationPage.getByRole("button", { name: "Approve this extension" }).click();
await activationPage.getByText("Approved. Return to the extension and choose Finish linking.").waitFor();

const pending = await popup.evaluate(async (appId) => {
  const values = await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(`app-pass:${appId}:pending`);
  return JSON.parse(String(values[`app-pass:${appId}:pending`])) as { requestId: string; proofKey: string };
}, appManifest.app_id);
await popup.reload();
await popup.getByRole("button", { name: "Finish linking after approval" }).click();
await popup.getByText("Linked. Apps Pass access can now be checked.").waitFor();
await activationPage.reload();
await activationPage.getByText("This request has already created an App session.").waitFor();

await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("inactive", { exact: true }).waitFor();
await popup.getByText("does not currently have paid-through Apps Pass access").waitFor();

await grantPaidThrough(subscriberUserId);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("active", { exact: true }).waitFor();
await popup.getByText("Premium feature access is active.").waitFor();

const stored = await popup.evaluate(async (appId) => await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(`app-pass:${appId}:session`), appManifest.app_id);
const token = stored[`app-pass:${appManifest.app_id}:session`];
if (typeof token !== "string") throw new Error("The extension did not store an App-session token");
const crossAppStatus = await popup.evaluate(async ({ appOrigin, runtimeId, token }) => {
  return (await fetch(`${appOrigin}/api/app-pass/entitlements/check`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-app-id": "app_wrong_private_pilot", "x-runtime-id": runtimeId },
  })).status;
}, { appOrigin, runtimeId, token });
assert.equal(crossAppStatus, 401);
const replayStatus = await popup.evaluate(async ({ appOrigin, pending }) => {
  return (await fetch(`${appOrigin}/api/app-pass/link-requests/${pending.requestId}/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proofKey: pending.proofKey }),
  })).status;
}, { appOrigin, pending });
assert.equal(replayStatus, 409);

const stateOutput = runPnpm(["mvp:operator:entitlement-state", "--", "--local"]);
assert.equal(stateOutput.includes(token), false, "Operator state must never expose the App-session token");
const tokenHash = createHash("sha256").update(token).digest("hex");
assert.equal(stateOutput.includes(tokenHash), true, "Operator state should expose only the token hash");
const sessionQuery = localSql(`SELECT id FROM app_session WHERE token_hash = '${tokenHash}'`);
const sessionId = sessionQuery.match(/appsession_[A-Za-z0-9_-]{24}/)?.[0];
assert.ok(sessionId);
runPnpm(["mvp:operator:revoke-session", "--", "--local", sessionId, "Private-pilot scoped revocation browser check"]);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("revoked", { exact: true }).waitFor();
await popup.getByRole("button", { name: "Relink Apps Pass" }).click();
const secondActivationPromise = persistentContext.waitForEvent("page");
await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
const secondActivation = await secondActivationPromise;
await secondActivation.waitForURL(`${appOrigin}/activate/**`);
await secondActivation.getByRole("button", { name: "Approve this extension" }).click();
await popup.reload();
await popup.getByRole("button", { name: "Finish linking after approval" }).click();
await popup.getByText("Linked. Apps Pass access can now be checked.").waitFor();
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("active", { exact: true }).waitFor();

runPnpm(["mvp:operator:set-app-status", "--", "--local", appManifest.app_id, "suspended", "Private-pilot App suspension browser check"]);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("revoked", { exact: true }).waitFor();
runPnpm(["mvp:operator:set-app-status", "--", "--local", appManifest.app_id, "approved", "Restore App after private-pilot suspension check"]);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("active", { exact: true }).waitFor();

await persistentContext.setOffline(true);
try {
  await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
  await popup.getByText("temporarily_unavailable", { exact: true }).waitFor();
} finally {
  await persistentContext.setOffline(false);
}

await popup.evaluate(async (appId) => void await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.remove(`app-pass:${appId}:session`), appManifest.app_id);
await popup.reload();
const deniedActivationPromise = persistentContext.waitForEvent("page");
await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
const deniedActivation = await deniedActivationPromise;
await deniedActivation.waitForURL(`${appOrigin}/activate/**`);
await deniedActivation.getByRole("button", { name: "Deny" }).click();
await deniedActivation.getByText("This activation request was denied.").waitFor();
await popup.reload();
await popup.getByRole("button", { name: "Finish linking after approval" }).click();
await popup.getByText("Link request was denied.").waitFor();
await popup.getByRole("button", { name: "Start activation again" }).click();

const expiredActivationPromise = persistentContext.waitForEvent("page");
await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
const expiredActivation = await expiredActivationPromise;
await expiredActivation.waitForURL(`${appOrigin}/activate/**`);
await expiredActivation.getByRole("button", { name: "Approve this extension" }).click();
const expiringPending = await popup.evaluate(async (appId) => {
  const values = await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(`app-pass:${appId}:pending`);
  return JSON.parse(String(values[`app-pass:${appId}:pending`])) as { requestId: string };
}, appManifest.app_id);
localSql(`UPDATE app_link_request SET expires_at = 0 WHERE id = '${expiringPending.requestId}'`);
await expiredActivation.reload();
await expiredActivation.getByText("This activation request expired. Start again from the extension.").waitFor();
await popup.reload();
await popup.getByRole("button", { name: "Finish linking after approval" }).click();
await popup.getByText("Link request expired.").waitFor();

assert.equal((await fetch(`${appOrigin}/api/health`)).status, 200);
process.stdout.write("PASS real extension activates through a human Subscriber, paid-through authority, hashed App session, scoped revocation, suspension, and truthful outage state\n");
// connectOverCDP intentionally leaves the repo-owned browser alive. Exiting the
// attaching test process releases its transport without calling browser.close().
setTimeout(() => process.exit(0), 0);
