import type Stripe from "stripe";

import type { BillingMode } from "@/billing/events";
import { StripeEventRejected } from "@/billing/stripe/translate-event";

const payoutEventTypes = new Set(["payout.created", "payout.updated", "payout.paid", "payout.failed", "payout.canceled"]);
const payoutStatuses = new Set(["pending", "in_transit", "paid", "failed", "canceled"]);

export async function projectConnectedAccountPayoutEvent(input: {
  db: CloudflareEnv["DB"];
  event: Stripe.Event;
  mode: BillingMode;
  payloadSha256: string;
}) {
  if (!payoutEventTypes.has(input.event.type)) throw new StripeEventRejected("Stripe Payout Event type is unsupported");
  if (input.event.livemode !== (input.mode === "live")) throw new StripeEventRejected("Stripe Payout Event mode does not match the authority environment");
  const providerAccountId = input.event.account;
  if (typeof providerAccountId !== "string" || !providerAccountId.startsWith("acct_")) throw new StripeEventRejected("Stripe Payout Event has no connected Account identity");
  const payout = input.event.data.object as Stripe.Payout;
  if (!payout?.id?.startsWith("po_") || payout.object !== "payout") throw new StripeEventRejected("Stripe Payout identity is invalid");
  if (!Number.isSafeInteger(payout.amount) || payout.amount <= 0 || !/^[a-z]{3}$/.test(payout.currency) || !payoutStatuses.has(payout.status)) {
    throw new StripeEventRejected("Stripe Payout financial state is invalid");
  }
  const failureCode = typeof payout.failure_code === "string" ? payout.failure_code.slice(0, 200) : null;
  const connected = await input.db.prepare("SELECT id, publisher_id FROM publisher_connected_account WHERE provider = 'stripe' AND mode = ? AND provider_account_id = ?")
    .bind(input.mode, providerAccountId)
    .first<{ id: string; publisher_id: string }>();
  if (!connected) throw new StripeEventRejected("Stripe Payout belongs to an unknown connected Account");
  const existingEvent = await input.db.prepare("SELECT payload_sha256 FROM stripe_payout_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
    .bind(input.mode, input.event.id)
    .first<{ payload_sha256: string }>();
  if (existingEvent) {
    if (existingEvent.payload_sha256 !== input.payloadSha256) throw new StripeEventRejected("Stripe Payout Event identity was reused with another payload");
    return { outcome: "duplicate" as const, publisherId: connected.publisher_id, payoutId: payout.id };
  }
  const current = await input.db.prepare("SELECT id, publisher_connected_account_id, amount, currency, latest_event_key FROM connected_account_payout WHERE provider = 'stripe' AND mode = ? AND provider_payout_id = ?")
    .bind(input.mode, payout.id)
    .first<{ id: string; publisher_connected_account_id: string; amount: number; currency: string; latest_event_key: string }>();
  if (current && (current.publisher_connected_account_id !== connected.id || current.amount !== payout.amount || current.currency !== payout.currency)) {
    throw new StripeEventRejected("Stripe Payout identity conflicts with its connected Account or financial definition");
  }
  const terminalStatus = input.event.type === "payout.paid" ? "paid" : input.event.type === "payout.failed" ? "failed" : input.event.type === "payout.canceled" ? "canceled" : null;
  if (terminalStatus && payout.status !== terminalStatus) throw new StripeEventRejected("Stripe Payout Event type conflicts with object status");
  const payoutRecordId = current?.id ?? `payout:${input.mode}:${payout.id}`;
  const eventKey = `${String(input.event.created).padStart(20, "0")}:${input.event.id}`;
  const outcome = !current || eventKey > current.latest_event_key ? "applied" : "noop";
  const receivedAt = Math.floor(Date.now() / 1_000);
  try {
    await input.db.batch([
      input.db.prepare(`INSERT INTO connected_account_payout (id, publisher_connected_account_id, publisher_id, provider, mode, provider_payout_id, amount, currency, status, arrival_date, failure_code, latest_event_key, created_at, updated_at)
        VALUES (?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, mode, provider_payout_id) DO UPDATE SET
          status = CASE WHEN excluded.latest_event_key > connected_account_payout.latest_event_key THEN excluded.status ELSE connected_account_payout.status END,
          arrival_date = CASE WHEN excluded.latest_event_key > connected_account_payout.latest_event_key THEN excluded.arrival_date ELSE connected_account_payout.arrival_date END,
          failure_code = CASE WHEN excluded.latest_event_key > connected_account_payout.latest_event_key THEN excluded.failure_code ELSE connected_account_payout.failure_code END,
          latest_event_key = max(connected_account_payout.latest_event_key, excluded.latest_event_key),
          updated_at = CASE WHEN excluded.latest_event_key > connected_account_payout.latest_event_key THEN excluded.updated_at ELSE connected_account_payout.updated_at END`)
        .bind(payoutRecordId, connected.id, connected.publisher_id, input.mode, payout.id, payout.amount, payout.currency, payout.status, payout.arrival_date ?? null, failureCode, eventKey, receivedAt, receivedAt),
      input.db.prepare("INSERT INTO stripe_payout_event (id, connected_account_payout_id, publisher_connected_account_id, publisher_id, provider, mode, provider_event_id, event_type, provider_created_at, received_at, payload_sha256, outcome) VALUES (?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), payoutRecordId, connected.id, connected.publisher_id, input.mode, input.event.id, input.event.type, input.event.created, receivedAt, input.payloadSha256, outcome),
    ]);
  } catch (error) {
    const raced = await input.db.prepare("SELECT payload_sha256 FROM stripe_payout_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
      .bind(input.mode, input.event.id)
      .first<{ payload_sha256: string }>();
    if (raced?.payload_sha256 === input.payloadSha256) return { outcome: "duplicate" as const, publisherId: connected.publisher_id, payoutId: payout.id };
    throw error;
  }
  return { outcome, publisherId: connected.publisher_id, payoutId: payout.id };
}
