import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const appRoot = path.resolve(import.meta.dirname, "..");
const stagingOrigin = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const appId = "app_john_doe_focus_timer_cf373931";
const runtimeId = "bpjnchabpcjomgncmbgphbdggkgkobdb";
const popupUrl = `chrome-extension://${runtimeId}/popup.html`;
const phase = process.argv.at(-1);

if (!phase || !["prepare", "finish", "check"].includes(phase)) {
  throw new Error("Usage: pnpm walkthrough:john-doe:activation -- <prepare|finish|check>");
}

type BrowserState = { status: string; cdpUrl: string };
const state = JSON.parse(await readFile(path.join(repositoryRoot, ".extension-dev-browser/state.json"), "utf8")) as BrowserState;
assert.equal(state.status, "ready", "Run pnpm dev:browser:status and start the project browser if needed");

const browser = await chromium.connectOverCDP(state.cdpUrl);
const context = browser.contexts()[0];
assert.ok(context, "Project-owned Chromium context is unavailable");

const session = await browser.newBrowserCDPSession();
await session.send("Extensions.loadUnpacked", { path: path.join(appRoot, "dist") });
await session.detach();

async function popupPage(browserContext: BrowserContext) {
  const existing = browserContext.pages().find((candidate) => candidate.url().startsWith(popupUrl));
  const page = existing ?? await browserContext.newPage();
  await page.goto(popupUrl);
  await page.getByText("Connected to Apps Pass", { exact: true }).waitFor();
  return page;
}

async function storedString(page: Page, key: string) {
  return page.evaluate(async (storageKey) => {
    const values = await chrome.storage.local.get(storageKey);
    return typeof values[storageKey] === "string" ? values[storageKey] : null;
  }, key);
}

const pendingKey = `app-pass:${stagingOrigin}:${appId}:pending`;
const sessionKey = `app-pass:${stagingOrigin}:${appId}:session`;
const popup = await popupPage(context);

if (phase === "prepare") {
  await popup.evaluate(async ({ pendingKey, sessionKey }) => void await chrome.storage.local.remove([pendingKey, sessionKey]), { pendingKey, sessionKey });
  await popup.reload();
  const activationPagePromise = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
  const activationPage = await activationPagePromise;
  const pendingRaw = await storedString(popup, pendingKey);
  assert.ok(pendingRaw, "The extension did not persist a pending link request");
  const pending = JSON.parse(pendingRaw) as { requestId?: unknown; activationUrl?: unknown; expiresAt?: unknown };
  assert.equal(typeof pending.requestId, "string");
  assert.equal(typeof pending.activationUrl, "string");
  assert.equal(typeof pending.expiresAt, "string");
  assert.equal(new URL(pending.activationUrl as string).origin, stagingOrigin);
  await activationPage.close();
  process.stdout.write(`${JSON.stringify({ phase, appId, runtimeId, requestId: pending.requestId, activationUrl: pending.activationUrl, expiresAt: pending.expiresAt })}\n`);
} else if (phase === "finish") {
  await popup.getByRole("button", { name: "Finish linking after approval" }).click();
  await popup.getByText("Linked. Check Apps Pass access to unlock the premium timer.").waitFor();
  assert.ok(await storedString(popup, sessionKey), "The extension did not persist an App-session token");
  await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
  await popup.locator("#entitlement-status").filter({ hasNotText: "Not checked" }).waitFor();
  const entitlement = await popup.locator("#entitlement-status").innerText();
  const message = await popup.locator("#action-message").innerText();
  process.stdout.write(`${JSON.stringify({ phase, appId, runtimeId, link: "linked", entitlement, message })}\n`);
} else {
  assert.ok(await storedString(popup, sessionKey), "John Doe is not linked in the project browser");
  await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
  await popup.locator("#entitlement-status").filter({ hasNotText: "Not checked" }).waitFor();
  const entitlement = await popup.locator("#entitlement-status").innerText();
  const message = await popup.locator("#action-message").innerText();
  process.stdout.write(`${JSON.stringify({ phase, appId, runtimeId, entitlement, message })}\n`);
}

// connectOverCDP must not close the project-owned browser. Exiting releases only
// this helper's transport; the recorded owner and persistent profile stay alive.
setTimeout(() => process.exit(0), 0);
