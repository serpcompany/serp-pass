import type Stripe from "stripe";

import type { BillingMode } from "@/billing/events";
import { StripeEventRejected } from "@/billing/stripe/translate-event";

const transferTypes = new Set(["transfer.created", "transfer.updated", "transfer.reversed"]);

export async function projectStripeTransferEvent(input: { db: CloudflareEnv["DB"]; event: Stripe.Event; mode: BillingMode; payloadSha256: string }) {
  if (!transferTypes.has(input.event.type)) throw new StripeEventRejected("Stripe Transfer Event type is unsupported");
  if (input.event.livemode !== (input.mode === "live")) throw new StripeEventRejected("Stripe Transfer Event mode does not match the authority environment");
  const transfer = input.event.data.object as Stripe.Transfer;
  if (!transfer?.id?.startsWith("tr_") || transfer.object !== "transfer") throw new StripeEventRejected("Stripe Transfer identity is invalid");
  if (!Number.isSafeInteger(transfer.amount) || transfer.amount <= 0 || !Number.isSafeInteger(transfer.amount_reversed) || transfer.amount_reversed < 0 || transfer.amount_reversed > transfer.amount || !/^[a-z]{3}$/.test(transfer.currency)) {
    throw new StripeEventRejected("Stripe Transfer financial state is invalid");
  }
  const destination = typeof transfer.destination === "string" ? transfer.destination : transfer.destination?.id;
  if (!destination?.startsWith("acct_") || typeof transfer.transfer_group !== "string") throw new StripeEventRejected("Stripe Transfer destination or group is invalid");
  if (input.event.type === "transfer.reversed" && transfer.amount_reversed !== transfer.amount) throw new StripeEventRejected("Partial Transfer reversal requires a separate correction workflow");
  const existingEvent = await input.db.prepare("SELECT payload_sha256 FROM stripe_transfer_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
    .bind(input.mode, input.event.id).first<{ payload_sha256: string }>();
  if (existingEvent) {
    if (existingEvent.payload_sha256 !== input.payloadSha256) throw new StripeEventRejected("Stripe Transfer Event identity was reused with another payload");
    return { outcome: "duplicate" as const, transferId: transfer.id };
  }
  const attempt = await input.db.prepare(`SELECT attempt.id, attempt.settlement_id, attempt.destination_account_id, attempt.amount, attempt.currency, attempt.latest_event_key,
      settlement.mode, settlement.publisher_earning_id
    FROM transfer_attempt attempt
    JOIN settlement ON settlement.id = attempt.settlement_id
    WHERE attempt.provider = 'stripe' AND attempt.provider_transfer_id = ?`).bind(transfer.id).first<{
      id: string; settlement_id: string; destination_account_id: string; amount: number; currency: string; latest_event_key: string | null; mode: BillingMode; publisher_earning_id: string;
    }>();
  if (!attempt || attempt.mode !== input.mode) throw new StripeEventRejected("Stripe Transfer has no matching mode-scoped Settlement");
  if (attempt.destination_account_id !== destination || attempt.amount !== transfer.amount || attempt.currency !== transfer.currency || attempt.settlement_id !== transfer.transfer_group) {
    throw new StripeEventRejected("Stripe Transfer conflicts with its Settlement definition");
  }
  const eventKey = `${String(input.event.created).padStart(20, "0")}:${input.event.id}`;
  const outcome = !attempt.latest_event_key || eventKey > attempt.latest_event_key ? "applied" : "noop";
  const now = Math.floor(Date.now() / 1_000);
  const fullyReversed = outcome === "applied" && transfer.amount_reversed === transfer.amount;
  const statements: Array<ReturnType<CloudflareEnv["DB"]["prepare"]>> = [];
  if (outcome === "applied") {
    statements.push(input.db.prepare(`UPDATE transfer_attempt SET amount_reversed = ?, latest_event_key = ?, updated_at = ?,
      status = CASE WHEN ? THEN 'reversed' ELSE status END,
      reversed_at = CASE WHEN ? THEN ? ELSE reversed_at END
      WHERE id = ?`).bind(transfer.amount_reversed, eventKey, now, fullyReversed ? 1 : 0, fullyReversed ? 1 : 0, now, attempt.id));
    if (fullyReversed) {
      statements.push(
        input.db.prepare("UPDATE settlement SET status = 'reversed', reversed_at = ? WHERE id = ? AND status = 'transferred'").bind(now, attempt.settlement_id),
        input.db.prepare("UPDATE publisher_earning SET status = 'reversed' WHERE id = ? AND status = 'released'").bind(attempt.publisher_earning_id),
      );
    }
  }
  statements.push(input.db.prepare("INSERT INTO stripe_transfer_event (id, transfer_attempt_id, settlement_id, provider, mode, provider_event_id, event_type, provider_created_at, received_at, payload_sha256, outcome) VALUES (?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), attempt.id, attempt.settlement_id, input.mode, input.event.id, input.event.type, input.event.created, now, input.payloadSha256, outcome));
  try {
    await input.db.batch(statements);
  } catch (error) {
    const raced = await input.db.prepare("SELECT payload_sha256 FROM stripe_transfer_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?").bind(input.mode, input.event.id).first<{ payload_sha256: string }>();
    if (raced?.payload_sha256 === input.payloadSha256) return { outcome: "duplicate" as const, transferId: transfer.id };
    throw error;
  }
  return { outcome, transferId: transfer.id, fullyReversed };
}
