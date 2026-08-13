import type Stripe from "stripe";

import type { BillingMode } from "../events";
import { billingRecordId } from "../identity";
import { SUBSCRIBER_METADATA_KEY } from "./translate-event";

type Subscriber = { id: string; email: string; name: string };
type ActiveAttempt = {
  id: string;
  idempotency_key: string;
  provider_session_id: string | null;
  price_id: string;
  status: "creating" | "open";
};

function stripeUrl(value: string | null, hostname: "checkout.stripe.com" | "billing.stripe.com") {
  if (!value) throw new Error("Stripe did not return a hosted URL");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== hostname) throw new Error("Stripe returned an unexpected hosted URL");
  return url.toString();
}

async function ensureCustomer(
  db: CloudflareEnv["DB"],
  stripe: Stripe,
  subscriber: Subscriber,
  mode: BillingMode,
) {
  const existing = await db.prepare("SELECT provider_customer_id FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ?")
    .bind(mode, subscriber.id)
    .first<{ provider_customer_id: string }>();
  if (existing) return existing.provider_customer_id;

  const customer = await stripe.customers.create({
    email: subscriber.email,
    name: subscriber.name,
    metadata: { [SUBSCRIBER_METADATA_KEY]: subscriber.id },
  }, { idempotencyKey: `apps-pass-customer:${mode}:${subscriber.id}` });
  const now = Math.floor(Date.now() / 1000);
  try {
    await db.prepare("INSERT INTO billing_customer (id, subscriber_user_id, provider, mode, provider_customer_id, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, ?, ?)")
      .bind(billingRecordId("customer", mode, customer.id), subscriber.id, mode, customer.id, now, now)
      .run();
  } catch {
    const raced = await db.prepare("SELECT provider_customer_id FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ?")
      .bind(mode, subscriber.id)
      .first<{ provider_customer_id: string }>();
    if (raced?.provider_customer_id === customer.id) return customer.id;
    throw new Error("Stripe Customer mapping conflicted with another request");
  }
  return customer.id;
}

async function activeAttempt(db: CloudflareEnv["DB"], subscriberId: string, mode: BillingMode) {
  return db.prepare("SELECT id, idempotency_key, provider_session_id, price_id, status FROM billing_checkout_attempt WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status IN ('creating', 'open')")
    .bind(mode, subscriberId)
    .first<ActiveAttempt>();
}

async function createAttempt(db: CloudflareEnv["DB"], subscriberId: string, mode: BillingMode, priceId: string) {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const idempotencyKey = `apps-pass-checkout:${mode}:${id}`;
  await db.batch([
    db.prepare("UPDATE billing_checkout_attempt SET status = 'expired', updated_at = ? WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status = 'open' AND expires_at <= ?")
      .bind(now, mode, subscriberId, now),
    db.prepare("UPDATE billing_checkout_attempt SET status = 'failed', updated_at = ? WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status = 'creating' AND created_at <= ?")
      .bind(now, mode, subscriberId, now - 86_400),
    db.prepare("INSERT OR IGNORE INTO billing_checkout_attempt (id, subscriber_user_id, provider, mode, price_id, idempotency_key, status, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, ?, 'creating', ?, ?)")
      .bind(id, subscriberId, mode, priceId, idempotencyKey, now, now),
  ]);
  const attempt = await activeAttempt(db, subscriberId, mode);
  if (!attempt) throw new Error("Could not establish an idempotent Checkout attempt");
  return attempt;
}

export async function createOrResumeCheckout(input: {
  db: CloudflareEnv["DB"];
  stripe: Stripe;
  subscriber: Subscriber;
  mode: BillingMode;
  passPriceId: string;
  applicationOrigin: string;
  allowAfterCompleted: boolean;
}) {
  const { db, stripe, subscriber, mode, passPriceId, applicationOrigin } = input;
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare("UPDATE billing_checkout_attempt SET status = 'expired', updated_at = ? WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status = 'open' AND expires_at <= ?")
      .bind(now, mode, subscriber.id, now),
    db.prepare("UPDATE billing_checkout_attempt SET status = 'failed', updated_at = ? WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status = 'creating' AND created_at <= ?")
      .bind(now, mode, subscriber.id, now - 86_400),
  ]);
  let attempt = await activeAttempt(db, subscriber.id, mode);
  if (!attempt) {
    const completed = await db.prepare("SELECT id FROM billing_checkout_attempt WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND status = 'complete' ORDER BY updated_at DESC LIMIT 1")
      .bind(mode, subscriber.id)
      .first<{ id: string }>();
    if (completed && !input.allowAfterCompleted) return `${applicationOrigin}/account?checkout=processing`;
    attempt = await createAttempt(db, subscriber.id, mode, passPriceId);
  }
  if (attempt.price_id !== passPriceId) throw new Error("Active Checkout attempt uses a different configured Price");
  if (attempt.status === "open" && attempt.provider_session_id) {
    const session = await stripe.checkout.sessions.retrieve(attempt.provider_session_id);
    if (session.status === "open") return stripeUrl(session.url, "checkout.stripe.com");
    const finalStatus = session.status === "complete" ? "complete" : "expired";
    await db.prepare("UPDATE billing_checkout_attempt SET status = ?, updated_at = ? WHERE id = ?")
      .bind(finalStatus, Math.floor(Date.now() / 1000), attempt.id)
      .run();
    if (finalStatus === "complete") return `${applicationOrigin}/account?checkout=returned`;
    attempt = await createAttempt(db, subscriber.id, mode, passPriceId);
  }

  const customerId = await ensureCustomer(db, stripe, subscriber, mode);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: subscriber.id,
    line_items: [{ price: passPriceId, quantity: 1 }],
    success_url: `${applicationOrigin}/account?checkout=returned`,
    cancel_url: `${applicationOrigin}/account?checkout=canceled`,
    expires_at: Math.floor(Date.now() / 1000) + 3_600,
    metadata: { [SUBSCRIBER_METADATA_KEY]: subscriber.id },
    subscription_data: { metadata: { [SUBSCRIBER_METADATA_KEY]: subscriber.id } },
  }, { idempotencyKey: attempt.idempotency_key });
  if (session.status !== "open") throw new Error("Stripe Checkout Session was not created in the open state");
  const sessionRecordedAt = Math.floor(Date.now() / 1000);
  await db.prepare("UPDATE billing_checkout_attempt SET provider_customer_id = ?, provider_session_id = ?, status = 'open', expires_at = ?, updated_at = ? WHERE id = ? AND status = 'creating'")
    .bind(customerId, session.id, session.expires_at, sessionRecordedAt, attempt.id)
    .run();
  return stripeUrl(session.url, "checkout.stripe.com");
}

export async function createPortal(input: {
  db: CloudflareEnv["DB"];
  stripe: Stripe;
  subscriberId: string;
  mode: BillingMode;
  applicationOrigin: string;
}) {
  const customer = await input.db.prepare("SELECT provider_customer_id FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ?")
    .bind(input.mode, input.subscriberId)
    .first<{ provider_customer_id: string }>();
  if (!customer) return null;
  const session = await input.stripe.billingPortal.sessions.create({
    customer: customer.provider_customer_id,
    return_url: `${input.applicationOrigin}/account`,
  });
  return stripeUrl(session.url, "billing.stripe.com");
}
