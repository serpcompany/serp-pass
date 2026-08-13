import type { BillingMode } from "@/billing/events";
import { sha256Hex } from "@/billing/test-signature";
import { assertStripePlatformAccount, createStripeClient } from "@/billing/stripe/client";

type TransferRequest = {
  idempotencyKey: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  transferGroup: string;
};

export type TransferExecutor = {
  executionMode: "local_simulation" | "stripe_api";
  createTransfer(request: TransferRequest): Promise<{ providerTransferId: string }>;
};

export class SettlementRejected extends Error {
  constructor(message: string, readonly status: 400 | 409 | 503) {
    super(message);
  }
}

function normalizedRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettlementRejected("Settlement request is invalid.", 400);
  const body = value as Record<string, unknown>;
  const expected = ["earningId", "reason", "schemaVersion"].sort();
  const actual = Object.keys(body).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new SettlementRejected("Settlement request contains unsupported fields.", 400);
  if (body.schemaVersion !== 1) throw new SettlementRejected("Settlement schema version is unsupported.", 400);
  const earningId = typeof body.earningId === "string" ? body.earningId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!/^earning_[A-Za-z0-9_-]{6,120}$/.test(earningId)) throw new SettlementRejected("Publisher Earning ID is invalid.", 400);
  if (reason.length < 10 || reason.length > 1_000) throw new SettlementRejected("Settlement reason must be between 10 and 1000 characters.", 400);
  return { schemaVersion: 1 as const, earningId, reason };
}

export function localTransferExecutor(): TransferExecutor {
  return {
    executionMode: "local_simulation",
    async createTransfer(request) {
      const digest = await sha256Hex(JSON.stringify(request));
      return { providerTransferId: `tr_local_${digest.slice(0, 24)}` };
    },
  };
}

export function stripeTestTransferExecutor(config: { secretKey: string; expectedAccountId: string }): TransferExecutor {
  return {
    executionMode: "stripe_api",
    async createTransfer(request) {
      const stripe = createStripeClient(config.secretKey, "staging");
      await assertStripePlatformAccount(stripe, config.expectedAccountId);
      const transfer = await stripe.transfers.create({
        amount: request.amount,
        currency: request.currency,
        destination: request.destinationAccountId,
        transfer_group: request.transferGroup,
        metadata: { apps_pass_settlement_id: request.transferGroup },
      }, { idempotencyKey: request.idempotencyKey });
      return { providerTransferId: transfer.id };
    },
  };
}

export async function releasePublisherEarning(input: {
  db: CloudflareEnv["DB"];
  mode: BillingMode;
  actorUserId: string;
  value: unknown;
  executor: TransferExecutor | null;
}) {
  if (!input.executor) throw new SettlementRejected("Stripe Transfer execution is not configured.", 503);
  const request = normalizedRequest(input.value);
  const requestSha256 = await sha256Hex(JSON.stringify(request));
  const existing = await input.db.prepare(`SELECT settlement.id, settlement.request_sha256, settlement.status, attempt.provider_transfer_id, attempt.execution_mode
    FROM settlement
    JOIN transfer_attempt attempt ON attempt.settlement_id = settlement.id
    WHERE settlement.publisher_earning_id = ?`).bind(request.earningId).first<{
      id: string; request_sha256: string; status: string; provider_transfer_id: string | null; execution_mode: "local_simulation" | "stripe_api";
    }>();
  if (existing) {
    if (existing.request_sha256 !== requestSha256) throw new SettlementRejected("Publisher Earning already has another Settlement request.", 409);
    if (existing.status === "transferred" && existing.provider_transfer_id) {
      return { outcome: "duplicate" as const, settlementId: existing.id, providerTransferId: existing.provider_transfer_id, simulated: existing.execution_mode === "local_simulation" };
    }
  }

  const source = await input.db.prepare(`SELECT earning.publisher_id, earning.amount, earning.currency, earning.available_at, earning.status,
      run.mode, account.id AS connected_account_id, account.provider_account_id, account.details_submitted,
      account.payouts_enabled, account.transfers_capability, account.requirements_currently_due_count, account.disabled_reason
    FROM publisher_earning earning
    JOIN allocation_run run ON run.id = earning.allocation_run_id
    LEFT JOIN publisher_connected_account account ON account.publisher_id = earning.publisher_id AND account.provider = 'stripe' AND account.mode = run.mode
    WHERE earning.id = ?`).bind(request.earningId).first<{
      publisher_id: string; amount: number; currency: string; available_at: number; status: string; mode: BillingMode;
      connected_account_id: string | null; provider_account_id: string | null; details_submitted: number | null;
      payouts_enabled: number | null; transfers_capability: string | null; requirements_currently_due_count: number | null; disabled_reason: string | null;
    }>();
  if (!source || source.mode !== input.mode) throw new SettlementRejected("Publisher Earning is missing or belongs to another mode.", 409);
  if (source.status !== "accrued") throw new SettlementRejected("Publisher Earning is not available for release.", 409);
  if (source.available_at > Math.floor(Date.now() / 1_000)) throw new SettlementRejected("Publisher Earning hold has not elapsed.", 409);
  const connectReady = Boolean(source.connected_account_id && source.provider_account_id && source.details_submitted && source.payouts_enabled && source.transfers_capability === "active" && source.requirements_currently_due_count === 0 && !source.disabled_reason);
  if (!connectReady) throw new SettlementRejected("Publisher Connect account is not ready for settlement.", 409);

  const digest = await sha256Hex(`${input.mode}:${request.earningId}`);
  const settlementId = `settlement_${input.mode}_${digest.slice(0, 24)}`;
  const transferAttemptId = `transfer_attempt_${input.mode}_${digest.slice(0, 24)}`;
  const idempotencyKey = `apps-pass:${input.mode}:settlement:${request.earningId}`;
  const now = Math.floor(Date.now() / 1_000);
  if (!existing) {
    try {
      await input.db.batch([
        input.db.prepare("INSERT INTO settlement (id, publisher_earning_id, publisher_id, publisher_connected_account_id, provider, mode, amount, currency, status, request_sha256, reason, requested_by_user_id, created_at) VALUES (?, ?, ?, ?, 'stripe', ?, ?, ?, 'pending', ?, ?, ?, ?)")
          .bind(settlementId, request.earningId, source.publisher_id, source.connected_account_id, input.mode, source.amount, source.currency, requestSha256, request.reason, input.actorUserId, now),
        input.db.prepare("INSERT INTO transfer_attempt (id, settlement_id, provider, execution_mode, idempotency_key, destination_account_id, amount, currency, status, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, 'creating', ?, ?)")
          .bind(transferAttemptId, settlementId, input.executor.executionMode, idempotencyKey, source.provider_account_id, source.amount, source.currency, now, now),
      ]);
    } catch {
      const raced = await input.db.prepare("SELECT request_sha256 FROM settlement WHERE publisher_earning_id = ?").bind(request.earningId).first<{ request_sha256: string }>();
      if (raced?.request_sha256 !== requestSha256) throw new SettlementRejected("Publisher Earning already has another Settlement request.", 409);
    }
  }

  let transfer: { providerTransferId: string };
  try {
    transfer = await input.executor.createTransfer({
      idempotencyKey,
      destinationAccountId: source.provider_account_id!,
      amount: source.amount,
      currency: source.currency,
      transferGroup: settlementId,
    });
  } catch {
    await input.db.prepare("UPDATE transfer_attempt SET status = 'failed', failure_code = 'provider_request_failed', updated_at = ? WHERE settlement_id = ? AND status IN ('creating', 'failed')").bind(now, settlementId).run();
    throw new SettlementRejected("Transfer provider request failed; retry is safe.", 503);
  }
  if (!/^(?:tr_|local_transfer_)[A-Za-z0-9_-]+$/.test(transfer.providerTransferId)) throw new SettlementRejected("Transfer provider returned an invalid identity.", 503);
  const completedAt = Math.floor(Date.now() / 1_000);
  try {
    await input.db.batch([
      input.db.prepare("UPDATE transfer_attempt SET status = 'succeeded', provider_transfer_id = ?, failure_code = NULL, updated_at = ?, succeeded_at = ? WHERE settlement_id = ? AND status IN ('creating', 'failed')")
        .bind(transfer.providerTransferId, completedAt, completedAt, settlementId),
      input.db.prepare("UPDATE settlement SET status = 'transferred', transferred_at = ? WHERE id = ? AND status = 'pending'").bind(completedAt, settlementId),
      input.db.prepare("UPDATE publisher_earning SET status = 'released', released_at = ? WHERE id = ? AND status = 'accrued'").bind(completedAt, request.earningId),
      input.db.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_earning_released', 'settlement', ?, ?, ?)")
        .bind(crypto.randomUUID(), input.actorUserId, settlementId, completedAt, request.reason),
    ]);
  } catch {
    throw new SettlementRejected("Transfer succeeded but local settlement finalization requires reconciliation.", 503);
  }
  return { outcome: "transferred" as const, settlementId, providerTransferId: transfer.providerTransferId, simulated: input.executor.executionMode === "local_simulation" };
}
