import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "https://serp-apps-pass-staging.serpcompany.workers.dev";
if (!appOrigin.startsWith("https://") || appOrigin.includes("localhost")) throw new Error("The Operator trace staging smoke requires deployed HTTPS staging.");
const suffix = Date.now();
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const email = `operator-trace-staging-${suffix}@example.test`;

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Operator Trace Staging");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  const subscriberUserId = await page.evaluate(async () => ((await (await fetch("/api/auth/get-session")).json()) as { user: { id: string } }).user.id);

  const readTrace = () => page.evaluate(async (id) => {
    const response = await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(id)}`);
    return { status: response.status, correlationId: response.headers.get("x-apps-pass-correlation-id"), body: await response.json() as unknown };
  }, subscriberUserId);
  assert.equal((await readTrace()).status, 403, "A Subscriber cannot read an Operator journey trace");

  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", "--staging", email], { cwd: repositoryRoot, stdio: "pipe" });
  const traced = await readTrace();
  assert.equal(traced.status, 200);
  assert.match(traced.correlationId ?? "", /^[A-Za-z0-9_-]{8,128}$/u);
  assert.deepEqual(traced.body, {
    counts: { customers: 0, subscriptions: 0, events: 0, invoices: 0, cashReceipts: 0 },
    issues: [],
    trace: {
      subscriberUserId,
      checkoutAttempts: [],
      billingCustomers: [],
      subscriptions: [],
      billingEvents: [],
      invoices: [],
      cashReceipts: [],
      linkRequests: [],
      appSessions: [],
      allocationRuns: [],
      publisherEarnings: [],
      settlements: [],
      transfers: [],
    },
  });
  assert.doesNotMatch(JSON.stringify(traced.body), /token|proof|payload|idempotency|email|hosted|url|installation|revokeReason/iu);
  process.stdout.write(`PASS deployed staging Operator journey trace is role-protected, correlated, empty-safe, and redacted (${traced.correlationId})\n`);
} finally {
  await browser.close();
}
