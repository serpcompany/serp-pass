import type Stripe from "stripe";

import { billingEventOrderKey, type BillingMode } from "@/billing/events";
import { billingRecordId } from "@/billing/identity";
import { StripeEventRejected } from "@/billing/stripe/translate-event";

const PUBLISHER_METADATA_KEY = "apps_pass_publisher_id";
const capabilityStates = new Set(["active", "inactive", "pending", "unrequested"]);

function modeOf(event: Stripe.Event): BillingMode {
  return event.livemode ? "live" : "test";
}

export async function projectConnectAccountEvent(input: {
  db: CloudflareEnv["DB"];
  event: Stripe.Event;
  mode: BillingMode;
  payloadSha256: string;
}) {
  const { db, event, mode, payloadSha256 } = input;
  if (event.type !== "account.updated") throw new StripeEventRejected("Connect Event type is unsupported");
  if (modeOf(event) !== mode) throw new StripeEventRejected("Connect Event mode does not match the application environment");
  const account = event.data.object as Stripe.Account;
  const publisherId = account.metadata?.[PUBLISHER_METADATA_KEY];
  const transfersCapability = account.capabilities?.transfers ?? "unrequested";
  if (!/^acct_[A-Za-z0-9_]+$/.test(account.id) || !publisherId || account.type !== "express") {
    throw new StripeEventRejected("Connect Account identity is invalid");
  }
  if (!capabilityStates.has(transfersCapability)) throw new StripeEventRejected("Connect transfers capability is invalid");
  if (event.account && event.account !== account.id) throw new StripeEventRejected("Connect Event Account does not match its payload");

  const existingEvent = await db.prepare("SELECT payload_sha256 FROM stripe_connect_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
    .bind(mode, event.id)
    .first<{ payload_sha256: string }>();
  if (existingEvent) {
    if (existingEvent.payload_sha256 !== payloadSha256) throw new StripeEventRejected("Connect Event identity was reused with a different payload");
    return { outcome: "duplicate" as const, eventId: event.id };
  }
  const publisher = await db.prepare("SELECT id FROM publisher WHERE id = ?")
    .bind(publisherId)
    .first<{ id: string }>();
  if (!publisher) throw new StripeEventRejected("Connect Event references an unknown Publisher");
  const conflictingAccount = await db.prepare("SELECT publisher_id FROM publisher_connected_account WHERE provider = 'stripe' AND mode = ? AND provider_account_id = ?")
    .bind(mode, account.id)
    .first<{ publisher_id: string }>();
  if (conflictingAccount && conflictingAccount.publisher_id !== publisherId) throw new StripeEventRejected("Connect Account belongs to another Publisher");
  const conflictingPublisher = await db.prepare("SELECT provider_account_id FROM publisher_connected_account WHERE provider = 'stripe' AND mode = ? AND publisher_id = ?")
    .bind(mode, publisherId)
    .first<{ provider_account_id: string }>();
  if (conflictingPublisher && conflictingPublisher.provider_account_id !== account.id) throw new StripeEventRejected("Publisher already has another Connect Account");

  const connectedAccountId = billingRecordId("connect-account", mode, account.id);
  const connectEventId = billingRecordId("connect-event", mode, event.id);
  const orderKey = billingEventOrderKey(event.created, event.id);
  const receivedAt = Math.floor(Date.now() / 1000);
  const currentlyDueCount = account.requirements?.currently_due?.length ?? 0;
  const disabledReason = account.requirements?.disabled_reason ?? null;
  try {
    await db.batch([
      db.prepare(`INSERT INTO publisher_connected_account (id, publisher_id, provider, mode, provider_account_id, account_type, details_submitted, charges_enabled, payouts_enabled, transfers_capability, requirements_currently_due_count, disabled_reason, latest_event_key, created_at, updated_at)
        VALUES (?, ?, 'stripe', ?, ?, 'express', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, mode, provider_account_id) DO UPDATE SET
          details_submitted = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.details_submitted ELSE publisher_connected_account.details_submitted END,
          charges_enabled = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.charges_enabled ELSE publisher_connected_account.charges_enabled END,
          payouts_enabled = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.payouts_enabled ELSE publisher_connected_account.payouts_enabled END,
          transfers_capability = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.transfers_capability ELSE publisher_connected_account.transfers_capability END,
          requirements_currently_due_count = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.requirements_currently_due_count ELSE publisher_connected_account.requirements_currently_due_count END,
          disabled_reason = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.disabled_reason ELSE publisher_connected_account.disabled_reason END,
          latest_event_key = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.latest_event_key ELSE publisher_connected_account.latest_event_key END,
          updated_at = CASE WHEN excluded.latest_event_key > publisher_connected_account.latest_event_key THEN excluded.updated_at ELSE publisher_connected_account.updated_at END
        WHERE publisher_connected_account.publisher_id = excluded.publisher_id`)
        .bind(connectedAccountId, publisherId, mode, account.id, account.details_submitted ? 1 : 0, account.charges_enabled ? 1 : 0, account.payouts_enabled ? 1 : 0, transfersCapability, currentlyDueCount, disabledReason, orderKey, receivedAt, receivedAt),
      db.prepare("INSERT INTO stripe_connect_event (id, publisher_connected_account_id, publisher_id, provider, mode, provider_event_id, event_type, provider_created_at, received_at, payload_sha256, outcome) VALUES (?, ?, ?, 'stripe', ?, ?, 'account.updated', ?, ?, ?, 'applied')")
        .bind(connectEventId, connectedAccountId, publisherId, mode, event.id, event.created, receivedAt, payloadSha256),
    ]);
    return { outcome: "applied" as const, eventId: event.id };
  } catch (error) {
    const raced = await db.prepare("SELECT payload_sha256 FROM stripe_connect_event WHERE provider = 'stripe' AND mode = ? AND provider_event_id = ?")
      .bind(mode, event.id)
      .first<{ payload_sha256: string }>();
    if (raced?.payload_sha256 === payloadSha256) return { outcome: "duplicate" as const, eventId: event.id };
    if (raced) throw new StripeEventRejected("Connect Event identity was reused with a different payload");
    throw error;
  }
}

export { PUBLISHER_METADATA_KEY };
