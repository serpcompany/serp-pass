import type { NormalizedBillingEvent } from "./events";

export type BillingEventOutcome = { outcome: "applied" | "duplicate"; eventId: string };

function identity(kind: string, mode: string, externalId: string) {
  return `${kind}:${mode}:${externalId}`;
}

function eventKey(event: NormalizedBillingEvent) {
  return `${String(event.createdAt).padStart(12, "0")}:${event.id}`;
}

export async function projectBillingEvent(
  db: CloudflareEnv["DB"],
  event: NormalizedBillingEvent,
  payloadSha256: string,
  source: "local_signed_fixture" | "stripe_webhook",
): Promise<BillingEventOutcome> {
  const provider = "stripe";
  const receivedAt = Math.floor(Date.now() / 1000);
  const customerId = identity("customer", event.mode, event.data.customerId);
  const subscriptionId = identity("subscription", event.mode, event.data.subscriptionId);
  const billingEventId = identity("event", event.mode, event.id);
  const invoiceId = event.type === "invoice.paid" || event.type === "invoice.payment_failed"
    ? identity("invoice", event.mode, event.data.invoiceId)
    : null;
  const orderKey = eventKey(event);
  const existingEvent = await db.prepare("SELECT payload_sha256 FROM billing_event WHERE provider = ? AND mode = ? AND provider_event_id = ?")
    .bind(provider, event.mode, event.id)
    .first<{ payload_sha256: string }>();
  if (existingEvent) {
    if (existingEvent.payload_sha256 !== payloadSha256) {
      throw new Error("Billing Event identity was reused with a different payload");
    }
    return { outcome: "duplicate", eventId: event.id };
  }
  const existingCustomers = await db.prepare("SELECT subscriber_user_id, provider_customer_id FROM billing_customer WHERE provider = ? AND mode = ? AND (provider_customer_id = ? OR subscriber_user_id = ?)")
    .bind(provider, event.mode, event.data.customerId, event.data.subscriberUserId)
    .all<{ subscriber_user_id: string; provider_customer_id: string }>();
  if (existingCustomers.results.some((customer: { subscriber_user_id: string; provider_customer_id: string }) => customer.subscriber_user_id !== event.data.subscriberUserId || customer.provider_customer_id !== event.data.customerId)) {
    throw new Error("Billing Customer identity conflicts with an existing Subscriber mapping");
  }
  const existingSubscription = await db.prepare("SELECT billing_customer_id FROM normalized_subscription WHERE provider = ? AND mode = ? AND provider_subscription_id = ?")
    .bind(provider, event.mode, event.data.subscriptionId)
    .first<{ billing_customer_id: string }>();
  if (existingSubscription && existingSubscription.billing_customer_id !== customerId) {
    throw new Error("Billing Subscription identity conflicts with an existing Customer mapping");
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const existingInvoice = await db.prepare("SELECT normalized_subscription_id FROM billing_invoice WHERE provider = ? AND mode = ? AND provider_invoice_id = ?")
      .bind(provider, event.mode, event.data.invoiceId)
      .first<{ normalized_subscription_id: string }>();
    if (existingInvoice && existingInvoice.normalized_subscription_id !== subscriptionId) {
      throw new Error("Billing Invoice identity conflicts with an existing Subscription mapping");
    }
  }

  const statements: Array<ReturnType<CloudflareEnv["DB"]["prepare"]>> = [
    db.prepare("INSERT INTO billing_customer (id, subscriber_user_id, provider, mode, provider_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, mode, provider_customer_id) DO UPDATE SET updated_at = excluded.updated_at WHERE billing_customer.subscriber_user_id = excluded.subscriber_user_id")
      .bind(customerId, event.data.subscriberUserId, provider, event.mode, event.data.customerId, receivedAt, receivedAt),
  ];

  const status = event.type === "invoice.paid" ? "active" : event.type === "invoice.payment_failed" ? "past_due" : event.data.status;
  const cancelAtPeriodEnd = event.type === "subscription.updated" ? event.data.cancelAtPeriodEnd : false;
  const currentPeriodEnd = event.type === "subscription.updated" ? event.data.currentPeriodEnd : event.data.periodEnd;
  const entitledUntil = event.type === "invoice.paid" ? event.data.periodEnd : null;
  statements.push(
    db.prepare(`INSERT INTO normalized_subscription (id, billing_customer_id, provider, mode, provider_subscription_id, status, cancel_at_period_end, current_period_end, entitled_until, latest_status_event_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, mode, provider_subscription_id) DO UPDATE SET
        status = CASE WHEN excluded.latest_status_event_key > normalized_subscription.latest_status_event_key THEN excluded.status ELSE normalized_subscription.status END,
        cancel_at_period_end = CASE WHEN excluded.latest_status_event_key > normalized_subscription.latest_status_event_key THEN excluded.cancel_at_period_end ELSE normalized_subscription.cancel_at_period_end END,
        current_period_end = CASE WHEN excluded.latest_status_event_key > normalized_subscription.latest_status_event_key THEN excluded.current_period_end ELSE normalized_subscription.current_period_end END,
        entitled_until = CASE
          WHEN excluded.entitled_until IS NULL THEN normalized_subscription.entitled_until
          WHEN normalized_subscription.entitled_until IS NULL OR excluded.entitled_until > normalized_subscription.entitled_until THEN excluded.entitled_until
          ELSE normalized_subscription.entitled_until
        END,
        latest_status_event_key = CASE WHEN excluded.latest_status_event_key > normalized_subscription.latest_status_event_key THEN excluded.latest_status_event_key ELSE normalized_subscription.latest_status_event_key END,
        updated_at = excluded.updated_at
      WHERE normalized_subscription.billing_customer_id = excluded.billing_customer_id`)
      .bind(subscriptionId, customerId, provider, event.mode, event.data.subscriptionId, status, cancelAtPeriodEnd ? 1 : 0, currentPeriodEnd, entitledUntil, orderKey, receivedAt, receivedAt),
  );

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoiceStatus = event.type === "invoice.paid" ? "paid" : "payment_failed";
    const amountPaid = event.type === "invoice.paid" ? event.data.amountPaid : 0;
    const currency = event.type === "invoice.paid" ? event.data.currency : null;
    const periodStart = event.type === "invoice.paid" ? event.data.periodStart : null;
    statements.push(
      db.prepare(`INSERT INTO billing_invoice (id, normalized_subscription_id, provider, mode, provider_invoice_id, status, amount_paid, currency, period_start, period_end, latest_event_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, mode, provider_invoice_id) DO UPDATE SET
          status = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.status ELSE billing_invoice.status END,
          amount_paid = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.amount_paid ELSE billing_invoice.amount_paid END,
          currency = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.currency ELSE billing_invoice.currency END,
          period_start = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.period_start ELSE billing_invoice.period_start END,
          period_end = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.period_end ELSE billing_invoice.period_end END,
          latest_event_key = CASE WHEN excluded.latest_event_key > billing_invoice.latest_event_key THEN excluded.latest_event_key ELSE billing_invoice.latest_event_key END,
          updated_at = excluded.updated_at
        WHERE billing_invoice.normalized_subscription_id = excluded.normalized_subscription_id`)
        .bind(invoiceId, subscriptionId, provider, event.mode, event.data.invoiceId, invoiceStatus, amountPaid, currency, periodStart, event.data.periodEnd, orderKey, receivedAt, receivedAt),
    );
  }

  statements.push(
    db.prepare("INSERT INTO billing_event (id, provider, mode, provider_event_id, event_type, provider_created_at, received_at, payload_sha256, outcome, detail, billing_customer_id, normalized_subscription_id, billing_invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?)")
      .bind(billingEventId, provider, event.mode, event.id, event.type, event.createdAt, receivedAt, payloadSha256, source, customerId, subscriptionId, invoiceId),
  );
  if (event.type === "invoice.paid") {
    statements.push(
      db.prepare("INSERT INTO cash_receipt (id, billing_invoice_id, source_billing_event_id, amount, currency, received_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(billing_invoice_id) DO NOTHING")
        .bind(identity("receipt", event.mode, event.data.invoiceId), invoiceId, billingEventId, event.data.amountPaid, event.data.currency, receivedAt),
    );
  }

  try {
    await db.batch(statements);
    return { outcome: "applied", eventId: event.id };
  } catch (error) {
    const duplicate = await db.prepare("SELECT payload_sha256 FROM billing_event WHERE provider = ? AND mode = ? AND provider_event_id = ?")
      .bind(provider, event.mode, event.id).first<{ payload_sha256: string }>();
    if (duplicate?.payload_sha256 === payloadSha256) return { outcome: "duplicate", eventId: event.id };
    if (duplicate) throw new Error("Billing Event identity was reused with a different payload");
    throw error;
  }
}
