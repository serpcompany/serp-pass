import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";
import Stripe from "stripe";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local_apps_pass_adapter_test";
const passPriceId = process.env.STRIPE_PASS_PRICE_ID ?? "price_local_apps_pass_test";
const suffix = Date.now();
const stripe = new Stripe("sk_test_local_apps_pass_adapter_test", { telemetry: false });
const webRoot = path.resolve(import.meta.dirname, "..");

function localSql(sql: string) {
  const output = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--config", "wrangler.jsonc", "--persist-to", "../../.wrangler/mvp-state", "--command", sql, "--json"], {
    cwd: webRoot,
    encoding: "utf8",
  });
  return JSON.parse(output) as Array<{ results: Array<Record<string, unknown>> }>;
}

function sign(payload: string) {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
}

async function sendStripeEvent(event: Record<string, unknown>, mutateAfterSigning = false) {
  const signedBody = JSON.stringify(event);
  return fetch(`${appOrigin}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sign(signedBody) },
    body: mutateAfterSigning ? `${signedBody} ` : signedBody,
  });
}

function baseEvent(id: string, type: string, object: Record<string, unknown>, created: number) {
  return {
    id,
    object: "event",
    api_version: "2026-07-29.dahlia",
    created,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  };
}

function invoiceObject(input: {
  id: string;
  subscriberUserId: string;
  customerId: string;
  subscriptionId: string;
  status: "paid" | "open";
  priceId?: string;
  amountPaid?: number;
  periodEnd?: number;
}) {
  return {
    id: input.id,
    object: "invoice",
    customer: input.customerId,
    status: input.status,
    amount_paid: input.amountPaid ?? 0,
    currency: "usd",
    period_start: 4_070_908_800,
    period_end: 4_070_908_800,
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: input.subscriptionId,
        metadata: { apps_pass_subscriber_user_id: input.subscriberUserId },
      },
    },
    lines: {
      data: [{
        period: { start: 4_070_908_800, end: input.periodEnd ?? 4_102_444_800 },
        pricing: {
          type: "price_details",
          price_details: { price: input.priceId ?? passPriceId, product: "prod_local_apps_pass_test" },
        },
      }],
    },
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.42" } } : {});
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Stripe Adapter Subscriber");
  await page.getByLabel("Email").fill(`stripe-adapter-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  const subscriberUserId = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    const body = await response.json() as { user: { id: string } };
    return body.user.id;
  });

  const customerId = `cus_stripe_adapter_${suffix}`;
  const subscriptionId = `sub_stripe_adapter_${suffix}`;
  const checkoutSessionId = `cs_test_stripe_adapter_${suffix}`;
  assert.match(subscriberUserId, /^[A-Za-z0-9_-]+$/);
  const now = Math.floor(Date.now() / 1000);
  localSql(`INSERT INTO billing_customer (id, subscriber_user_id, provider, mode, provider_customer_id, created_at, updated_at) VALUES ('customer:test:${customerId}', '${subscriberUserId}', 'stripe', 'test', '${customerId}', ${now}, ${now}); INSERT INTO billing_checkout_attempt (id, subscriber_user_id, provider, mode, price_id, idempotency_key, provider_customer_id, provider_session_id, status, expires_at, created_at, updated_at) VALUES ('checkout:test:${suffix}', '${subscriberUserId}', 'stripe', 'test', '${passPriceId}', 'apps-pass-checkout:test:${suffix}', '${customerId}', '${checkoutSessionId}', 'open', ${now + 3600}, ${now}, ${now});`);

  const checkoutCompleted = baseEvent(
    `evt_stripe_adapter_checkout_${suffix}`,
    "checkout.session.completed",
    {
      id: checkoutSessionId,
      object: "checkout.session",
      client_reference_id: subscriberUserId,
      customer: customerId,
      mode: "subscription",
      metadata: { apps_pass_subscriber_user_id: subscriberUserId },
    },
    1_900_099_900,
  );
  const checkoutAccepted = await sendStripeEvent(checkoutCompleted);
  assert.equal(checkoutAccepted.status, 202, await checkoutAccepted.text());
  assert.equal((await sendStripeEvent(checkoutCompleted)).status, 200);
  const checkoutCollision = structuredClone(checkoutCompleted);
  checkoutCollision.pending_webhooks = 2;
  assert.equal((await sendStripeEvent(checkoutCollision)).status, 400, "A completed Checkout Event ID cannot be reused with another payload");
  const delayedExpired = baseEvent(
    `evt_stripe_adapter_checkout_expired_${suffix}`,
    "checkout.session.expired",
    checkoutCompleted.data.object as Record<string, unknown>,
    1_900_099_800,
  );
  assert.equal((await sendStripeEvent(delayedExpired)).status, 202);
  const checkoutState = localSql(`SELECT status FROM billing_checkout_attempt WHERE provider_session_id = '${checkoutSessionId}'`);
  assert.equal(checkoutState[0]?.results[0]?.status, "complete");

  const paidEvent = baseEvent(
    `evt_stripe_adapter_paid_${suffix}`,
    "invoice.paid",
    invoiceObject({
      id: `in_stripe_adapter_paid_${suffix}`,
      subscriberUserId,
      customerId,
      subscriptionId,
      status: "paid",
      amountPaid: 1_000,
    }),
    1_900_100_000,
  );

  assert.equal((await sendStripeEvent(paidEvent, true)).status, 400, "A mutated Stripe raw body must fail verification");
  const accepted = await sendStripeEvent(paidEvent);
  const acceptedBody = await accepted.text();
  assert.equal(accepted.status, 202, acceptedBody);
  assert.deepEqual(JSON.parse(acceptedBody), { received: true, outcome: "applied", eventId: paidEvent.id });
  const duplicate = await sendStripeEvent(paidEvent);
  const duplicateBody = await duplicate.text();
  assert.equal(duplicate.status, 200, duplicateBody);

  const collision = structuredClone(paidEvent);
  (collision.data.object as { amount_paid: number }).amount_paid = 1_001;
  assert.equal((await sendStripeEvent(collision)).status, 400, "A Stripe Event ID collision must not be treated as a duplicate");

  const wrongPrice = baseEvent(
    `evt_stripe_adapter_wrong_price_${suffix}`,
    "invoice.paid",
    invoiceObject({
      id: `in_stripe_adapter_wrong_price_${suffix}`,
      subscriberUserId,
      customerId,
      subscriptionId,
      status: "paid",
      priceId: "price_unrelated_product",
      amountPaid: 50_000,
    }),
    1_900_100_100,
  );
  assert.equal((await sendStripeEvent(wrongPrice)).status, 400, "An unrelated Stripe Price must never grant Pass access");

  const liveMode = structuredClone(paidEvent);
  liveMode.id = `evt_stripe_adapter_live_${suffix}`;
  liveMode.livemode = true;
  assert.equal((await sendStripeEvent(liveMode)).status, 400, "A live Event must never enter local or staging test state");

  const failedEvent = baseEvent(
    `evt_stripe_adapter_failed_${suffix}`,
    "invoice.payment_failed",
    invoiceObject({
      id: `in_stripe_adapter_failed_${suffix}`,
      subscriberUserId,
      customerId,
      subscriptionId,
      status: "open",
      periodEnd: 4_133_980_800,
    }),
    1_900_100_200,
  );
  assert.equal((await sendStripeEvent(failedEvent)).status, 202);

  const canceledEvent = baseEvent(
    `evt_stripe_adapter_canceled_${suffix}`,
    "customer.subscription.updated",
    {
      id: subscriptionId,
      object: "subscription",
      customer: customerId,
      metadata: { apps_pass_subscriber_user_id: subscriberUserId },
      status: "active",
      cancel_at_period_end: false,
      cancel_at: 4_102_444_800,
      items: {
        data: [{
          id: `si_stripe_adapter_${suffix}`,
          object: "subscription_item",
          price: { id: passPriceId },
          current_period_start: 4_070_908_800,
          current_period_end: 4_102_444_800,
        }],
      },
    },
    1_900_100_300,
  );
  assert.equal((await sendStripeEvent(canceledEvent)).status, 202);

  const projection = await page.evaluate(async () => {
    const response = await fetch("/api/account/subscription");
    return { status: response.status, body: await response.json() as unknown };
  });
  assert.deepEqual(projection, {
    status: 200,
    body: {
      subscription: {
        provider: "stripe",
        mode: "test",
        status: "active",
        cancelAtPeriodEnd: true,
        entitledUntil: "2100-01-01T00:00:00.000Z",
        access: "active",
      },
    },
  });

  process.stdout.write("PASS real Stripe signatures and Dahlia Event shapes project without a Stripe account\n");
  await context.close();
} finally {
  await browser.close();
}
