import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";
import Stripe from "stripe";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
if (!appOrigin.includes("localhost")) throw new Error("The account-independent Connect projection test is local-only.");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local_apps_pass_adapter_test";
const suffix = Date.now();
const stripe = new Stripe("sk_test_local_apps_pass_adapter_test", { telemetry: false });
const webRoot = path.resolve(import.meta.dirname, "..");

function localSql(sql: string) {
  return execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--config", "wrangler.jsonc", "--persist-to", "../../.wrangler/mvp-state", "--command", sql], {
    cwd: webRoot,
    encoding: "utf8",
  });
}

function sign(payload: string) {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
}

async function sendAccountEvent(input: {
  eventId: string;
  accountId: string;
  publisherId: string;
  created: number;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transfers: "active" | "inactive" | "pending";
  currentlyDue?: string[];
  disabledReason?: string | null;
  livemode?: boolean;
}) {
  const payload = JSON.stringify({
    id: input.eventId,
    object: "event",
    api_version: "2026-07-29.dahlia",
    created: input.created,
    data: {
      object: {
        id: input.accountId,
        object: "account",
        type: "express",
        metadata: { apps_pass_publisher_id: input.publisherId },
        details_submitted: input.detailsSubmitted,
        charges_enabled: input.chargesEnabled,
        payouts_enabled: input.payoutsEnabled,
        capabilities: { transfers: input.transfers },
        requirements: {
          currently_due: input.currentlyDue ?? [],
          disabled_reason: input.disabledReason ?? null,
        },
      },
    },
    livemode: input.livemode ?? false,
    pending_webhooks: 1,
    request: null,
    type: "account.updated",
  });
  return fetch(`${appOrigin}/api/stripe/connect-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    body: payload,
  });
}

async function sendPayoutEvent(input: {
  eventId: string;
  accountId: string;
  payoutId: string;
  created: number;
  status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
  failureCode?: string | null;
}) {
  const payload = JSON.stringify({
    id: input.eventId,
    object: "event",
    api_version: "2026-07-29.dahlia",
    account: input.accountId,
    created: input.created,
    data: { object: {
      id: input.payoutId,
      object: "payout",
      amount: 700,
      currency: "usd",
      status: input.status,
      arrival_date: 1_900_300_000,
      failure_code: input.failureCode ?? null,
    } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: `payout.${input.status === "pending" ? "created" : input.status}`,
  });
  return fetch(`${appOrigin}/api/stripe/connect-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sign(payload) },
    body: payload,
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.43" } });
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Connect Projection Publisher");
  await page.getByLabel("Email").fill(`connect-publisher-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  const userId = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    return ((await response.json()) as { user: { id: string } }).user.id;
  });
  const publisherId = `pub_connect_${suffix}`;
  const preMembership = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "1", publisherId, country: "US" },
    headers: { origin: appOrigin },
    maxRedirects: 0,
  });
  assert.equal(preMembership.status(), 403, "A Subscriber cannot start Publisher onboarding");
  localSql(`INSERT INTO publisher (id, name, status, created_at, created_by_user_id) VALUES ('${publisherId}', 'Connect Projection Publisher', 'active', ${Math.floor(Date.now() / 1000)}, '${userId}'); INSERT INTO publisher_membership (publisher_id, user_id, created_at) VALUES ('${publisherId}', '${userId}', ${Math.floor(Date.now() / 1000)}); INSERT INTO human_role_assignment (user_id, role, source, granted_at, granted_by_user_id) VALUES ('${userId}', 'publisher', 'invitation', ${Math.floor(Date.now() / 1000)}, '${userId}');`);

  await page.goto(`${appOrigin}/publisher?connect=returned`);
  await page.getByText("Connect not started").waitFor();
  assert.equal(await page.getByText("Returning from Stripe does not mark this Publisher ready.").isVisible(), true);

  const unsupportedRequest = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "2", publisherId, country: "US" },
    headers: { origin: appOrigin },
    maxRedirects: 0,
  });
  assert.equal(unsupportedRequest.status(), 400, "An unsupported onboarding request version must reject");

  const crossOrigin = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "1", publisherId, country: "US" },
    headers: { origin: "https://attacker.example" },
    maxRedirects: 0,
  });
  assert.equal(crossOrigin.status(), 403, "Cross-origin onboarding must reject");
  const onboarding = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "1", publisherId, country: "US" },
    headers: { origin: appOrigin },
    maxRedirects: 0,
  });
  assert.equal(onboarding.status(), 303, await onboarding.text());
  const onboardingLocation = onboarding.headers().location;
  assert.ok(onboardingLocation);
  assert.equal(new URL(onboardingLocation).hostname, "connect.stripe.com", "Onboarding must use a Stripe-hosted URL");
  const accountOutput = localSql(`SELECT provider_account_id, country, status FROM publisher_connect_onboarding WHERE publisher_id = '${publisherId}'`);
  const accountId = accountOutput.match(/acct_local_[A-Za-z0-9_]+/u)?.[0];
  assert.ok(accountId, accountOutput);
  assert.match(accountOutput, /"country": "US"/u);
  assert.match(accountOutput, /"status": "account_created"/u);
  assert.match(localSql(`SELECT COUNT(*) AS count FROM publisher_connect_onboarding WHERE publisher_id = '${publisherId}'`), /"count": 1/u);
  assert.doesNotMatch(localSql("PRAGMA table_info(publisher_connect_onboarding)"), /account_link|onboarding_url/u, "One-time Stripe URLs must not be stored");
  const resumed = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "1", publisherId, country: "US" },
    headers: { origin: appOrigin },
    maxRedirects: 0,
  });
  assert.equal(resumed.status(), 303, "A retry should create a fresh one-time Account Link without another Account");
  assert.match(localSql(`SELECT COUNT(*) AS count FROM publisher_connect_onboarding WHERE publisher_id = '${publisherId}'`), /"count": 1/u);
  const countryConflict = await context.request.post(`${appOrigin}/api/publisher/connect/onboarding`, {
    form: { schemaVersion: "1", publisherId, country: "JP" },
    headers: { origin: appOrigin },
    maxRedirects: 0,
  });
  assert.equal(countryConflict.status(), 409, "A retry cannot silently change the connected Account country");
  await page.goto(`${appOrigin}/publisher?connect=returned`);
  await page.getByText("Onboarding started — awaiting verified Stripe state").waitFor();
  assert.equal(await page.getByText("Returning from Stripe does not mark this Publisher ready.").isVisible(), true);

  assert.equal((await sendAccountEvent({
    eventId: `evt_connect_wrong_account_${suffix}`,
    accountId: `acct_wrong_${suffix}`,
    publisherId,
    created: 1_900_199_900,
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    transfers: "pending",
  })).status, 400, "A signed Event cannot replace the Account created for this Publisher");
  const pending = await sendAccountEvent({
    eventId: `evt_connect_pending_${suffix}`,
    accountId,
    publisherId,
    created: 1_900_200_000,
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    transfers: "pending",
    currentlyDue: ["individual.id_number"],
  });
  assert.equal(pending.status, 202, await pending.text());
  await page.reload();
  await page.getByText("Connect onboarding incomplete").waitFor();
  assert.equal(await page.getByText("Transfers pending").isVisible(), true);
  assert.equal(await page.getByText("1 requirement currently due").isVisible(), true);

  const readyEvent = {
    eventId: `evt_connect_ready_${suffix}`,
    accountId,
    publisherId,
    created: 1_900_200_100,
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    transfers: "active" as const,
  };
  const ready = await sendAccountEvent(readyEvent);
  assert.equal(ready.status, 202, await ready.text());
  assert.equal((await sendAccountEvent(readyEvent)).status, 200, "Exact replay must be idempotent");
  await page.reload();
  await page.getByText("Ready for test settlement").waitFor();
  assert.equal(await page.getByText("Charges enabled").isVisible(), true);
  assert.equal(await page.getByText("Transfers active").isVisible(), true);
  assert.equal(await page.getByText("Bank payouts enabled").isVisible(), true);

  const stale = await sendAccountEvent({
    eventId: `evt_connect_stale_${suffix}`,
    accountId,
    publisherId,
    created: 1_900_199_999,
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    transfers: "inactive",
    currentlyDue: ["stale.requirement"],
  });
  assert.equal(stale.status, 202, await stale.text());
  await page.reload();
  await page.getByText("Ready for test settlement").waitFor();

  const collisionPayload = {
    ...readyEvent,
    detailsSubmitted: false,
  };
  assert.equal((await sendAccountEvent(collisionPayload)).status, 400, "A reused Stripe Event ID with another payload must reject");
  assert.equal((await sendAccountEvent({ ...readyEvent, eventId: `evt_connect_live_${suffix}`, livemode: true })).status, 400, "Live Connect state must not enter local test D1");
  assert.equal((await sendAccountEvent({ ...readyEvent, eventId: `evt_connect_unknown_${suffix}`, accountId: `acct_unknown_${suffix}`, publisherId: `pub_unknown_${suffix}` })).status, 400, "Unknown Publisher metadata must reject");

  const payoutId = `po_connect_${suffix}`;
  const payoutCreated = {
    eventId: `evt_payout_created_${suffix}`,
    accountId,
    payoutId,
    created: 1_900_200_200,
    status: "pending" as const,
  };
  assert.equal((await sendPayoutEvent(payoutCreated)).status, 202);
  assert.equal((await sendPayoutEvent(payoutCreated)).status, 200, "Exact Payout Event replay must be idempotent");
  assert.equal((await sendPayoutEvent({ ...payoutCreated, status: "failed", failureCode: "account_closed" })).status, 400, "Changed Payout Event replay must reject");
  const payoutPaid = await sendPayoutEvent({ ...payoutCreated, eventId: `evt_payout_paid_${suffix}`, created: 1_900_200_300, status: "paid" });
  assert.equal(payoutPaid.status, 202, await payoutPaid.text());
  const stalePayout = await sendPayoutEvent({ ...payoutCreated, eventId: `evt_payout_stale_${suffix}`, created: 1_900_200_100, status: "failed", failureCode: "stale_failure" });
  assert.equal(stalePayout.status, 200, await stalePayout.text());
  await page.reload();
  await page.getByText("Bank Payouts observed").waitFor();
  assert.equal(await page.getByText("$7.00 USD · paid").isVisible(), true);
  assert.equal(await page.getByText("Transfer and Earning records are separate from this bank Payout observation.").isVisible(), true);

  process.stdout.write("PASS signed Connect account and bank Payout state are replay-safe, order-safe, mode-scoped, and Publisher-visible\n");
  await context.close();
} finally {
  await browser.close();
}
