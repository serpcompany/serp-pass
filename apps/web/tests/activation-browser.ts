import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { strToU8, zipSync } from "fflate";
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
const storageKey = (item: "pending" | "session") => `app-pass:${new URL(appOrigin).origin}:${appManifest.app_id}:${item}`;
type BrowserState = {
  status: string; cdpUrl: string; extensions: Array<{ id: string; pageUrl: string; path: string }>;
};
async function readyBrowserState() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const current = JSON.parse(await readFile(path.join(repositoryRoot, ".extension-dev-browser/state.json"), "utf8")) as BrowserState;
    if (current.status === "ready") return current;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The repo-owned extension browser did not become ready");
}
const state = await readyBrowserState();
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
    await operatorPage.goto(`${appOrigin}/submit`);
    await operatorPage.getByLabel("Contact email").fill(publisherEmail);
    await operatorPage.getByLabel("Publisher or company name").fill(appManifest.publisher_name);
    await operatorPage.getByLabel("Extension name").fill(appManifest.name);
    await operatorPage.getByLabel("Public extension listing URL").fill(`https://chromewebstore.google.com/detail/activation-${suffix}`);
    await operatorPage.getByLabel("Source repository URL").fill("https://github.com/serpcompany/serp-appspass");
    await operatorPage.getByLabel("What the extension does and why it belongs in the Pass").fill("An independently built reference extension used to verify the real activation and entitlement boundary.");
    await operatorPage.getByLabel("Permissions, data collection, and privacy explanation").fill("Uses only the documented Apps Pass authority and local extension storage; the reference collects no personal information.");
    await operatorPage.getByLabel(/I attest that I own or am authorized/).check();
    await operatorPage.getByRole("button", { name: "Submit Publisher Application" }).click();
    await operatorPage.getByText("Application received for preliminary SERP review").waitFor();

    await operatorPage.goto(`${appOrigin}/operator`);
    const applicationReview = operatorPage.locator("form").filter({ hasText: appManifest.name });
    await applicationReview.getByLabel("Preliminary review reason").fill("Reference extension listing, ownership, permissions, privacy, and product case accepted for technical onboarding.");
    await applicationReview.getByRole("button", { name: "Accept for technical onboarding" }).click();
    const generatedPublisherId = await applicationReview.getByTestId("generated-publisher-id").innerText();
    const generatedAppId = await applicationReview.getByTestId("generated-app-id").innerText();
    const invitationCode = await applicationReview.getByTestId("invitation-code").innerText();

    const publisherPage = await publisherContext.newPage();
    await signUp(publisherPage, "Activation Publisher", publisherEmail);
    await publisherPage.goto(`${appOrigin}/publisher/invitation`);
    await publisherPage.getByLabel("Invitation code").fill(invitationCode);
    await publisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
    await publisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
    const generatedManifest = { ...appManifest, publisher_id: generatedPublisherId, app_id: generatedAppId };
    const reviewPackage = Buffer.from(zipSync({
      "manifest.json": strToU8(JSON.stringify({ manifest_version: 3, name: appManifest.name, version: "1.0.0", permissions: ["storage"] })),
      "popup.html": strToU8("<!doctype html><title>Activation reference</title>"),
    }));
    await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(generatedManifest, null, 2));
    await publisherPage.getByLabel("Ownership evidence").fill("Independently built Publisher extension source and stable Chromium runtime reviewed for the activation slice.");
    await publisherPage.getByLabel("Exact installable extension ZIP").setInputFiles({ name: "activation-reference.zip", mimeType: "application/zip", buffer: reviewPackage });
    await publisherPage.getByRole("button", { name: "Submit App for review" }).click();
    await publisherPage.getByText(`${generatedAppId} · pending`).waitFor();

    await operatorPage.reload();
    const review = operatorPage.locator("form").filter({ hasText: `${generatedAppId} · pending` });
    await review.getByLabel("Review reason").fill("Independent extension source, manifest, ownership evidence, and runtime identity reviewed.");
    await review.getByRole("button", { name: "Approve Submission" }).click();
    await operatorPage.getByText(`${generatedAppId} · pending`).waitFor({ state: "detached" });
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

const extensionPages = persistentContext.pages().filter((candidate) => candidate.url().startsWith(extension.pageUrl));
let popup = extensionPages[0];
if (!popup) {
  popup = await persistentContext.newPage();
}
for (const stalePopup of extensionPages.slice(1)) await stalePopup.close();
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
runPnpm(["mvp:operator:set-app-status", "--", "--local", subscriberEmail, appManifest.app_id, "suspended", "Unprivileged status mutation must remain a no-op"]);
assert.match(localSql(`SELECT status FROM app WHERE id = '${appManifest.app_id}'`), /approved/);
runPnpm(["mvp:operator:bootstrap", "--", "--local", subscriberEmail]);

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

const pending = await popup.evaluate(async (pendingKey) => {
  const values = await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(pendingKey);
  return JSON.parse(String(values[pendingKey])) as { requestId: string; proofKey: string };
}, storageKey("pending"));
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

const sessionKey = storageKey("session");
const stored = await popup.evaluate(async (key) => await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(key), sessionKey);
const token = stored[sessionKey];
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
runPnpm(["mvp:operator:revoke-session", "--", "--local", subscriberEmail, sessionId, "Private-pilot scoped revocation browser check"]);
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

runPnpm(["mvp:operator:set-app-status", "--", "--local", subscriberEmail, appManifest.app_id, "suspended", "Private-pilot App suspension browser check"]);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("revoked", { exact: true }).waitFor();
runPnpm(["mvp:operator:set-app-status", "--", "--local", subscriberEmail, appManifest.app_id, "approved", "Restore App after private-pilot suspension check"]);
await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
await popup.getByText("active", { exact: true }).waitFor();
const operatorJourney = await subscriberPage.evaluate(async (subscriberUserId) => {
  const response = await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(subscriberUserId)}`);
  return { status: response.status, body: await response.json() as { trace?: { linkRequests?: Array<Record<string, unknown>>; appSessions?: Array<Record<string, unknown>> } } };
}, subscriberUserId);
assert.equal(operatorJourney.status, 200);
assert.equal(operatorJourney.body.trace?.linkRequests?.length, 2);
assert.deepEqual(operatorJourney.body.trace?.linkRequests?.map((request) => ({ appId: request.appId, status: request.status })), [
  { appId: appManifest.app_id, status: "exchanged" },
  { appId: appManifest.app_id, status: "exchanged" },
]);
assert.equal(operatorJourney.body.trace?.linkRequests?.[0]?.requestId, pending.requestId);
assert.notEqual(operatorJourney.body.trace?.linkRequests?.[1]?.requestId, pending.requestId);
assert.match(String(operatorJourney.body.trace?.linkRequests?.[1]?.requestId), /^linkreq_[A-Za-z0-9_-]+$/u);
assert.equal(operatorJourney.body.trace?.appSessions?.length, 2);
assert.deepEqual(operatorJourney.body.trace?.appSessions?.map((session) => ({ appId: session.appId, status: session.status })), [
  { appId: appManifest.app_id, status: "revoked" },
  { appId: appManifest.app_id, status: "active" },
]);
assert.equal(operatorJourney.body.trace?.appSessions?.some((session) => session.sessionId === sessionId), true);
assert.doesNotMatch(JSON.stringify(operatorJourney.body), /token|proof|payload|idempotency|email|hosted|url|installation|revokeReason/iu, "Operator journey trace must exclude App-session credentials, proofs, and installation details");
const operatorAudit = localSql(`SELECT action, actor_user_id FROM operator_audit_event WHERE target_id IN ('${sessionId}', '${appManifest.app_id}') ORDER BY occurred_at`);
assert.equal(operatorAudit.includes(subscriberUserId), true, "Authority mutations must audit the authenticated Operator user ID");
assert.match(localSql(`SELECT COUNT(*) AS count FROM operator_audit_event WHERE target_id = '${sessionId}' AND action = 'app_session_revoked' AND actor_user_id = '${subscriberUserId}'`), /"count": 1/);
assert.match(localSql(`SELECT COUNT(*) AS count FROM operator_audit_event WHERE target_id = '${appManifest.app_id}' AND action IN ('app_suspended', 'app_reapproved') AND actor_user_id = '${subscriberUserId}'`), /"count": 2/);
assert.match(localSql("SELECT COUNT(*) AS count FROM operator_audit_event WHERE reason = 'Unprivileged status mutation must remain a no-op'"), /"count": 0/);

await persistentContext.setOffline(true);
try {
  await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
  await popup.getByText("temporarily_unavailable", { exact: true }).waitFor();
} finally {
  await persistentContext.setOffline(false);
}

await popup.evaluate(async (key) => void await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.remove(key), sessionKey);
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
const expiringPending = await popup.evaluate(async (pendingKey) => {
  const values = await (globalThis as unknown as { chrome: ExtensionChrome }).chrome.storage.local.get(pendingKey);
  return JSON.parse(String(values[pendingKey])) as { requestId: string };
}, storageKey("pending"));
localSql(`UPDATE app_link_request SET expires_at = 0 WHERE id = '${expiringPending.requestId}'`);
await expiredActivation.reload();
await expiredActivation.getByText("This activation request expired. Start again from the extension.").waitFor();
await popup.reload();
await popup.getByRole("button", { name: "Finish linking after approval" }).click();
await popup.getByText("Link request expired.").waitFor();

const nonExtensionOrigin = await fetch(`${appOrigin}/api/app-pass/link-requests`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: appOrigin },
  body: "{}",
});
assert.equal(nonExtensionOrigin.status, 403);
const rateLimitStatuses: number[] = [];
const rateLimitSource = `rate-limit-proof-${Date.now()}`;
for (let attempt = 0; attempt < 21; attempt += 1) {
  const response = await fetch(`${appOrigin}/api/app-pass/link-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: extensionOrigin,
      "cf-connecting-ip": rateLimitSource,
    },
    body: "{}",
  });
  rateLimitStatuses.push(response.status);
  if (attempt === 20) assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
}
assert.deepEqual(rateLimitStatuses.slice(0, 20), Array(20).fill(400));
assert.equal(rateLimitStatuses[20], 429);

assert.equal((await fetch(`${appOrigin}/api/health`)).status, 200);
process.stdout.write("PASS real extension activates through a human Subscriber, paid-through authority, hashed App session, scoped revocation, suspension, and truthful outage state\n");
// connectOverCDP intentionally leaves the repo-owned browser alive. Exiting the
// attaching test process releases its transport without calling browser.close().
setTimeout(() => process.exit(0), 0);
