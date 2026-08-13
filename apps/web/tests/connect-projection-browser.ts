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
  localSql(`INSERT INTO publisher (id, name, status, created_at, created_by_user_id) VALUES ('${publisherId}', 'Connect Projection Publisher', 'active', ${Math.floor(Date.now() / 1000)}, '${userId}'); INSERT INTO publisher_membership (publisher_id, user_id, created_at) VALUES ('${publisherId}', '${userId}', ${Math.floor(Date.now() / 1000)}); INSERT INTO human_role_assignment (user_id, role, source, granted_at, granted_by_user_id) VALUES ('${userId}', 'publisher', 'invitation', ${Math.floor(Date.now() / 1000)}, '${userId}');`);

  await page.goto(`${appOrigin}/publisher?connect=returned`);
  await page.getByText("Connect not started").waitFor();
  assert.equal(await page.getByText("A Stripe return does not prove onboarding readiness.").isVisible(), true);

  const accountId = `acct_connect_${suffix}`;
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
