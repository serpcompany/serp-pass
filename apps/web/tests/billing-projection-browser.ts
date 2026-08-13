import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const suffix = Date.now();
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const devVarsPath = path.join(repositoryRoot, "apps/web/.dev.vars");
const devVarsSecret = existsSync(devVarsPath)
  ? /^TEST_BILLING_WEBHOOK_SECRET=(.+)$/mu.exec(readFileSync(devVarsPath, "utf8"))?.[1]?.trim()
  : undefined;
const fixtureSecret = process.env.TEST_BILLING_WEBHOOK_SECRET ?? devVarsSecret ?? "local-only-billing-fixture-secret-2026";

type FixtureEvent = {
  id: string;
  type: "invoice.paid" | "invoice.payment_failed" | "subscription.updated";
  createdAt: number;
  mode: "test";
  data: Record<string, unknown>;
};

async function sendEvent(event: FixtureEvent, mutateAfterSigning = false) {
  const signedBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", fixtureSecret).update(`${timestamp}.${signedBody}`).digest("hex");
  const body = mutateAfterSigning ? `${signedBody} ` : signedBody;
  return fetch(`${appOrigin}/api/billing/test-events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-apps-pass-test-signature": `t=${timestamp},v1=${signature}`,
    },
    body,
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.40" } } : {});
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Billing Projection Subscriber");
  await page.getByLabel("Email").fill(`billing-projection-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  const subscriberUserId = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    const body = await response.json() as { user: { id: string } };
    return body.user.id;
  });

  const baseData = {
    subscriberUserId,
    customerId: `cus_fixture_${suffix}`,
    subscriptionId: `sub_fixture_${suffix}`,
  };
  const paid = {
    id: `evt_fixture_paid_${suffix}`,
    type: "invoice.paid" as const,
    createdAt: 1_900_000_000,
    mode: "test" as const,
    data: {
      ...baseData,
      invoiceId: `in_fixture_paid_${suffix}`,
      amountPaid: 1_000,
      currency: "usd",
      periodStart: 4_070_908_800,
      periodEnd: 4_102_444_800,
    },
  };

  const tampered = await sendEvent(paid, true);
  assert.equal(tampered.status, 400);

  const accepted = await sendEvent(paid);
  const acceptedBody = await accepted.text();
  assert.equal(accepted.status, 202, acceptedBody);
  assert.deepEqual(JSON.parse(acceptedBody), { outcome: "applied", eventId: paid.id });

  const duplicate = await sendEvent(paid);
  const duplicateBody = await duplicate.text();
  assert.equal(duplicate.status, 200, duplicateBody);
  assert.deepEqual(JSON.parse(duplicateBody), { outcome: "duplicate", eventId: paid.id });

  const conflictingReplay = await sendEvent({
    ...paid,
    data: { ...paid.data, amountPaid: paid.data.amountPaid + 1 },
  });
  assert.equal(conflictingReplay.status, 400, "A reused provider Event ID with a different payload must be rejected");

  const failed = await sendEvent({
    id: `evt_fixture_failed_${suffix}`,
    type: "invoice.payment_failed",
    createdAt: 1_900_000_300,
    mode: "test",
    data: { ...baseData, invoiceId: `in_fixture_failed_${suffix}`, periodEnd: 4_133_980_800 },
  });
  assert.equal(failed.status, 202, await failed.text());

  const canceled = await sendEvent({
    id: `evt_fixture_canceled_${suffix}`,
    type: "subscription.updated",
    createdAt: 1_900_000_600,
    mode: "test",
    data: { ...baseData, status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: 4_102_444_800 },
  });
  assert.equal(canceled.status, 202, await canceled.text());

  const delayedOlderPaid = await sendEvent({
    ...paid,
    id: `evt_fixture_delayed_${suffix}`,
    createdAt: 1_899_000_000,
    data: { ...paid.data, invoiceId: `in_fixture_older_${suffix}`, periodStart: 4_039_372_800, periodEnd: 4_070_908_800 },
  });
  assert.equal(delayedOlderPaid.status, 202, await delayedOlderPaid.text());

  const concurrentEvent: FixtureEvent = {
    id: `evt_fixture_concurrent_${suffix}`,
    type: "subscription.updated",
    createdAt: 1_900_000_700,
    mode: "test",
    data: { ...baseData, status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: 4_102_444_800 },
  };
  const concurrentStatuses = (await Promise.all([sendEvent(concurrentEvent), sendEvent(concurrentEvent)]))
    .map((response) => response.status)
    .sort();
  assert.deepEqual(concurrentStatuses, [200, 202]);

  const conflictingCustomer = await sendEvent({
    id: `evt_fixture_customer_conflict_${suffix}`,
    type: "subscription.updated",
    createdAt: 1_900_000_800,
    mode: "test",
    data: { ...baseData, subscriberUserId: `different_${subscriberUserId}`, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: 4_133_980_800 },
  });
  assert.equal(conflictingCustomer.status, 400);

  const secondContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.41" } } : {});
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`${appOrigin}/account`);
  await secondPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await secondPage.getByLabel("Name").fill("Second Billing Subscriber");
  await secondPage.getByLabel("Email").fill(`billing-projection-second-${suffix}@example.test`);
  await secondPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await secondPage.getByRole("button", { name: "Create account" }).click();
  await secondPage.getByText("Human session active").waitFor();
  const secondSubscriberUserId = await secondPage.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    const body = await response.json() as { user: { id: string } };
    return body.user.id;
  });

  const conflictingInvoice = await sendEvent({
    ...paid,
    id: `evt_fixture_invoice_conflict_${suffix}`,
    createdAt: 1_900_000_900,
    data: {
      ...paid.data,
      subscriberUserId: secondSubscriberUserId,
      customerId: `cus_fixture_second_${suffix}`,
      subscriptionId: `sub_fixture_second_${suffix}`,
    },
  });
  assert.equal(conflictingInvoice.status, 400, "A provider Invoice already bound to another Subscription must be rejected atomically");
  const secondProjection = await secondPage.evaluate(async () => {
    const response = await fetch("/api/account/subscription");
    return { status: response.status, body: await response.json() as unknown };
  });
  assert.deepEqual(secondProjection, { status: 200, body: { subscription: null } });
  await secondContext.close();

  const projection = await page.evaluate(async () => {
    const response = await fetch("/api/account/subscription");
    return { status: response.status, body: await response.json() as unknown };
  });
  assert.equal(projection.status, 200);
  assert.deepEqual(projection.body, {
    subscription: {
      provider: "stripe",
      mode: "test",
      status: "canceled",
      cancelAtPeriodEnd: true,
      entitledUntil: "2100-01-01T00:00:00.000Z",
      access: "active",
    },
  });

  await page.reload();
  await page.getByText("Apps Pass access active").waitFor();
  assert.equal(await page.getByText("Paid through Jan 1, 2100").isVisible(), true);
  assert.equal(await page.getByText("Cancellation scheduled; access remains active through the paid-through date.").isVisible(), true);

  const deniedAuditStatus = await page.evaluate(async (subscriberUserId) => {
    return (await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(subscriberUserId)}`)).status;
  }, subscriberUserId);
  assert.equal(deniedAuditStatus, 403);

  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", appOrigin.includes("localhost") ? "--local" : "--staging", `billing-projection-${suffix}@example.test`], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  const audit = await page.evaluate(async (subscriberUserId) => {
    const response = await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(subscriberUserId)}`);
    return { status: response.status, correlationId: response.headers.get("x-apps-pass-correlation-id"), body: await response.json() as unknown };
  }, subscriberUserId);
  assert.equal(audit.status, 200);
  assert.match(audit.correlationId ?? "", /^[A-Za-z0-9_-]{8,128}$/u);
  assert.deepEqual(audit.body, {
    counts: { customers: 1, subscriptions: 1, events: 5, invoices: 3, cashReceipts: 2 },
    issues: [],
    trace: {
      subscriberUserId,
      checkoutAttempts: [],
      billingCustomers: [baseData.customerId],
      subscriptions: [baseData.subscriptionId],
      billingEvents: [
        `evt_fixture_delayed_${suffix}`,
        paid.id,
        `evt_fixture_failed_${suffix}`,
        `evt_fixture_canceled_${suffix}`,
        `evt_fixture_concurrent_${suffix}`,
      ],
      invoices: [
        `in_fixture_failed_${suffix}`,
        `in_fixture_older_${suffix}`,
        `in_fixture_paid_${suffix}`,
      ],
      cashReceipts: [
        { providerInvoiceId: `in_fixture_older_${suffix}`, amount: 1_000, currency: "usd" },
        { providerInvoiceId: `in_fixture_paid_${suffix}`, amount: 1_000, currency: "usd" },
      ],
      linkRequests: [],
      appSessions: [],
      allocationRuns: [],
      publisherEarnings: [],
      publisherPayments: [],
      settlements: [],
      transfers: [],
    },
  });
  assert.doesNotMatch(JSON.stringify(audit.body), /token|proof|payload|idempotency|email|hosted|url/iu, "Operator journey trace must exclude secret and personal-data field classes");

  process.stdout.write("PASS signed billing projection is replay-safe, order-safe, and paid-through authoritative\n");
} finally {
  await browser.close();
}
