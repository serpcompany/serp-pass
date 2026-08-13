import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const authorityBaseUrl = "http://127.0.0.1:8787";
type BrowserState = {
  cdpUrl: string;
  extensions: Array<{ id: string; name: string; path: string; pageUrl: string }>;
};

function runPnpm(args: string[]) {
  const result = spawnSync("pnpm", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function waitForAuthority() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${authorityBaseUrl}/health`)).ok) return;
    } catch {
      // The local Worker is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local authority did not start");
}

async function discoverSubmittedApps() {
  const apps = [];
  for (const entry of await readdir(path.join(repositoryRoot, "examples"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(repositoryRoot, "examples", entry.name, "apppass.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        app_id: string;
        distributions: Array<{ browser_family: string; channel: string; runtime_id: string }>;
      };
      const distribution = manifest.distributions.find((candidate) =>
        candidate.browser_family === "chromium" && candidate.channel === "unpacked");
      assert.ok(distribution, `${manifestPath} lacks a Chromium unpacked distribution`);
      apps.push({
        appId: manifest.app_id,
        runtimeId: distribution.runtime_id,
        manifestPath,
        outputPath: path.join(repositoryRoot, "examples", entry.name, "dist"),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return apps.sort((left, right) => left.appId.localeCompare(right.appId));
}

let authority: ChildProcess | undefined;
let browser: Browser | undefined;
try {
  runPnpm(["dev:browser:status"]);
  runPnpm(["db:reset"]);
  runPnpm(["db:migrate"]);
  authority = spawn("pnpm", ["operator:serve"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "ignore",
  });
  await waitForAuthority();

  const submittedApps = await discoverSubmittedApps();
  assert.ok(submittedApps.length >= 2, "Acceptance requires at least two submitted Apps");
  assert.equal(new Set(submittedApps.map((app) => app.appId)).size, submittedApps.length,
    "Submitted App IDs must be unique");
  assert.equal(new Set(submittedApps.map((app) => app.runtimeId)).size, submittedApps.length,
    "Submitted runtime IDs must be unique");
  for (const app of submittedApps) runPnpm(["operator:import-app", app.manifestPath]);
  runPnpm(["operator:activate-local-subscription"]);

  const browserState = JSON.parse(await readFile(
    path.join(repositoryRoot, ".extension-dev-browser/state.json"),
    "utf8",
  )) as BrowserState;
  assert.equal(browserState.extensions.length, submittedApps.length);
  assert.equal(new Set(browserState.extensions.map((extension) => extension.id)).size,
    browserState.extensions.length, "Loaded runtime IDs must be unique");
  assert.equal(new Set(browserState.extensions.map((extension) => path.resolve(extension.path))).size,
    browserState.extensions.length, "Loaded extension paths must be unique");
  browser = await chromium.connectOverCDP(browserState.cdpUrl);
  const context = browser.contexts()[0];
  assert.ok(context, "Project-owned browser has no persistent context");
  const evidence = [];

  for (const app of submittedApps) {
    const extension = browserState.extensions.find((candidate) => path.resolve(candidate.path) === app.outputPath);
    assert.ok(extension, `No loaded extension for ${app.outputPath}`);
    assert.equal(extension.id, app.runtimeId);
    process.stderr.write(`[browser-acceptance] exercising ${app.appId} (${extension.id})\n`);
    const page = await context.newPage();
    await page.goto(extension.pageUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const extensionGlobal = globalThis as typeof globalThis & {
        chrome: { storage: { local: { clear(): Promise<void> } } };
      };
      await extensionGlobal.chrome.storage.local.clear();
    });
    await page.click("#begin-link");
    await page.locator("#request-id").waitFor({ state: "visible" });
    await page.waitForFunction(() => Boolean(document.querySelector<HTMLElement>("#request-id")?.dataset.requestId));
    const requestId = await page.locator("#request-id").getAttribute("data-request-id");
    assert.ok(requestId);
    runPnpm(["operator:approve-link", requestId]);
    await page.click("#finish-link");
    await page.waitForFunction(() => document.querySelector("#result")?.textContent === '{"linked":true}');
    await page.click("#check-access");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#result")?.dataset.status === "active");
    const entitlement = JSON.parse(await page.locator("#result").textContent() ?? "null") as {
      status: string;
      features: string[];
    };
    assert.deepEqual(entitlement, { status: "active", features: ["premium"] });
    evidence.push({ appId: app.appId, runtimeId: extension.id, entitlement });
  }

  assert.equal(evidence.length, submittedApps.length);
  assert.equal(new Set(evidence.map((entry) => entry.appId)).size, evidence.length);
  assert.equal(new Set(evidence.map((entry) => entry.runtimeId)).size, evidence.length);
  assert.ok(evidence.every((entry) => entry.entitlement.status === "active"));

  const prototypeState = await (await fetch(`${authorityBaseUrl}/operator/prototype-state`)).json() as {
    subscriptions: Array<{ id: string; subscriberId: string; status: string }>;
    links: Array<{ appId: string; subscriberId: string }>;
  };
  const subscription = prototypeState.subscriptions.find((candidate) => candidate.id === "subscription_local");
  assert.deepEqual(subscription, {
    id: "subscription_local",
    subscriberId: "subscriber_local",
    status: "active",
  });
  assert.ok(evidence.every(({ appId }) => prototypeState.links.some((link) =>
    link.appId === appId && link.subscriberId === subscription.subscriberId)));
  process.stdout.write(`${JSON.stringify({ extensions: evidence, subscriptionId: subscription.id })}\n`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  authority?.kill("SIGTERM");
  await browser?.close();
}
