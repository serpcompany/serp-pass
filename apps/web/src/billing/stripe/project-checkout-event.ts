import type Stripe from "stripe";

import type { BillingEventOutcome } from "../projection";
import { billingEventOrderKey, type BillingMode } from "../events";
import { billingRecordId } from "../identity";
import { SUBSCRIBER_METADATA_KEY, StripeEventRejected } from "./translate-event";

function objectId(value: { id: string } | string | null, name: string) {
  const id = typeof value === "string" ? value : value?.id;
  if (!id) throw new StripeEventRejected(`${name} is missing`);
  return id;
}

export async function projectStripeCheckoutEvent(input: {
  db: CloudflareEnv["DB"];
  event: Stripe.Event;
  mode: BillingMode;
  passPriceId: string;
  payloadSha256: string;
}): Promise<BillingEventOutcome> {
  const { db, event, mode, passPriceId, payloadSha256 } = input;
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
    throw new StripeEventRejected("Checkout Event type is unsupported");
  }
  if ((event.livemode ? "live" : "test") !== mode) throw new StripeEventRejected("Stripe Event mode does not match the application environment");
  const session = event.data.object as Stripe.Checkout.Session;
  const subscriberUserId = session.metadata?.[SUBSCRIBER_METADATA_KEY];
  if (!subscriberUserId || session.client_reference_id !== subscriberUserId || session.mode !== "subscription") {
    throw new StripeEventRejected("Checkout Session identity is invalid");
  }
  const customerId = objectId(session.customer, "Checkout Customer");
  const billingEventId = billingRecordId("event", mode, event.id);
  const existing = await db.prepare("SELECT payload_sha256 FROM billing_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
    .bind(mode, event.id)
    .first<{ payload_sha256: string }>();
  if (existing) {
    if (existing.payload_sha256 !== payloadSha256) throw new StripeEventRejected("Billing Event identity was reused with a different payload");
    return { outcome: "duplicate", eventId: event.id };
  }
  const attempt = await db.prepare("SELECT id, subscriber_user_id, price_id, provider_customer_id FROM billing_checkout_attempt WHERE provider = 'stripe' AND mode = ? AND provider_session_id = ?")
    .bind(mode, session.id)
    .first<{ id: string; subscriber_user_id: string; price_id: string; provider_customer_id: string | null }>();
  if (!attempt || attempt.subscriber_user_id !== subscriberUserId || attempt.price_id !== passPriceId || attempt.provider_customer_id !== customerId) {
    throw new StripeEventRejected("Checkout Session does not match an Apps Pass attempt");
  }
  const customer = await db.prepare("SELECT id FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? AND provider_customer_id = ?")
    .bind(mode, subscriberUserId, customerId)
    .first<{ id: string }>();
  if (!customer) throw new StripeEventRejected("Checkout Customer mapping is missing");

  const receivedAt = Math.floor(Date.now() / 1000);
  const status = event.type === "checkout.session.completed" ? "complete" : "expired";
  const orderKey = billingEventOrderKey(event.created, event.id);
  try {
    await db.batch([
      db.prepare("UPDATE billing_checkout_attempt SET status = CASE WHEN latest_event_key IS NULL OR latest_event_key < ? THEN ? ELSE status END, latest_event_key = CASE WHEN latest_event_key IS NULL OR latest_event_key < ? THEN ? ELSE latest_event_key END, updated_at = ? WHERE id = ?")
        .bind(orderKey, status, orderKey, orderKey, receivedAt, attempt.id),
      db.prepare("INSERT INTO billing_event (id, provider, mode, provider_event_id, event_type, provider_created_at, received_at, payload_sha256, outcome, detail, billing_customer_id) VALUES (?, 'stripe', ?, ?, ?, ?, ?, ?, 'noop', 'stripe_webhook', ?)")
        .bind(billingEventId, mode, event.id, event.type, event.created, receivedAt, payloadSha256, customer.id),
    ]);
    return { outcome: "applied", eventId: event.id };
  } catch (error) {
    const raced = await db.prepare("SELECT payload_sha256 FROM billing_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
      .bind(mode, event.id)
      .first<{ payload_sha256: string }>();
    if (raced?.payload_sha256 === payloadSha256) return { outcome: "duplicate", eventId: event.id };
    if (raced) throw new StripeEventRejected("Billing Event identity was reused with a different payload");
    throw error;
  }
}
