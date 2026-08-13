import type { BillingMode } from "@/billing/events";
import { sha256Hex } from "@/billing/test-signature";

type ReceiptAllocation = { cashReceiptId: string; amount: number };
type EarningAllocation = { earningId: string; publisherId: string; amount: number; availableAt: string; availableAtSeconds: number };
type NormalizedAllocation = {
  schemaVersion: 1;
  allocationRunId: string;
  currency: string;
  receiptAllocations: ReceiptAllocation[];
  reserveAmount: number;
  platformAmount: number;
  publisherEarnings: EarningAllocation[];
  reason: string;
  agreementReference: string;
};

export class AllocationRejected extends Error {
  constructor(message: string, readonly status: 400 | 409) {
    super(message);
  }
}

function objectWithKeys(value: unknown, keys: string[], name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AllocationRejected(`${name} is invalid.`, 400);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== [...keys].sort()[index])) {
    throw new AllocationRejected(`${name} contains unsupported fields.`, 400);
  }
  return record;
}

function positiveInteger(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new AllocationRejected(`${name} must be a positive integer in minor currency units.`, 400);
  return Number(value);
}

function nonnegativeInteger(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AllocationRejected(`${name} must be a nonnegative integer in minor currency units.`, 400);
  return Number(value);
}

function normalizedInput(value: unknown, mode: BillingMode): NormalizedAllocation {
  const body = objectWithKeys(value, ["schemaVersion", "allocationRunId", "currency", "receiptAllocations", "reserveAmount", "platformAmount", "publisherEarnings", "reason", "agreementReference"], "Allocation request");
  if (body.schemaVersion !== 1) throw new AllocationRejected("Allocation schema version is unsupported.", 400);
  const allocationRunId = typeof body.allocationRunId === "string" ? body.allocationRunId.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency.trim().toLowerCase() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const agreementReference = typeof body.agreementReference === "string" ? body.agreementReference.trim() : "";
  if (!/^alloc_[A-Za-z0-9_-]{6,120}$/.test(allocationRunId)) throw new AllocationRejected("Allocation Run ID is invalid.", 400);
  if (!/^[a-z]{3}$/.test(currency)) throw new AllocationRejected("Allocation currency must be a lowercase three-letter ISO code.", 400);
  if (reason.length < 10 || reason.length > 1_000) throw new AllocationRejected("Allocation reason must be between 10 and 1000 characters.", 400);
  if (agreementReference.length < 1 || agreementReference.length > 200) throw new AllocationRejected("Agreement reference must be between 1 and 200 characters.", 400);
  if (!Array.isArray(body.receiptAllocations) || body.receiptAllocations.length < 1 || body.receiptAllocations.length > 100) {
    throw new AllocationRejected("Allocation requires 1–100 Cash Receipt allocations.", 400);
  }
  if (!Array.isArray(body.publisherEarnings) || body.publisherEarnings.length < 1 || body.publisherEarnings.length > 100) {
    throw new AllocationRejected("Allocation requires 1–100 Publisher Earnings.", 400);
  }
  const receiptAllocations = body.receiptAllocations.map((value) => {
    const receipt = objectWithKeys(value, ["cashReceiptId", "amount"], "Cash Receipt allocation");
    const cashReceiptId = typeof receipt.cashReceiptId === "string" ? receipt.cashReceiptId.trim() : "";
    if (!/^receipt:(?:test|live):[A-Za-z0-9_:-]{4,180}$/.test(cashReceiptId)) throw new AllocationRejected("Cash Receipt ID is invalid.", 400);
    return { cashReceiptId, amount: positiveInteger(receipt.amount, "Cash Receipt amount") };
  }).sort((left, right) => left.cashReceiptId.localeCompare(right.cashReceiptId));
  if (new Set(receiptAllocations.map(({ cashReceiptId }) => cashReceiptId)).size !== receiptAllocations.length) {
    throw new AllocationRejected("Cash Receipt allocations must be unique.", 400);
  }
  const publisherEarnings = body.publisherEarnings.map((value) => {
    const earning = objectWithKeys(value, ["earningId", "publisherId", "amount", "availableAt"], "Publisher Earning");
    const earningId = typeof earning.earningId === "string" ? earning.earningId.trim() : "";
    const publisherId = typeof earning.publisherId === "string" ? earning.publisherId.trim() : "";
    const availableAtInput = typeof earning.availableAt === "string" ? earning.availableAt.trim() : "";
    const availableAtMilliseconds = Date.parse(availableAtInput);
    if (!/^earning_[A-Za-z0-9_-]{6,120}$/.test(earningId) || !/^pub_[a-z0-9][a-z0-9_]{2,120}$/.test(publisherId)) {
      throw new AllocationRejected("Publisher Earning identity is invalid.", 400);
    }
    if (!Number.isFinite(availableAtMilliseconds)) throw new AllocationRejected("Publisher Earning available-at time is invalid.", 400);
    const availableAtSeconds = Math.floor(availableAtMilliseconds / 1_000);
    if (mode === "live" && availableAtSeconds <= Math.floor(Date.now() / 1_000)) {
      throw new AllocationRejected("A live Publisher Earning requires a future hold time.", 400);
    }
    return {
      earningId,
      publisherId,
      amount: positiveInteger(earning.amount, "Publisher Earning amount"),
      availableAt: new Date(availableAtSeconds * 1_000).toISOString(),
      availableAtSeconds,
    };
  }).sort((left, right) => left.earningId.localeCompare(right.earningId));
  if (new Set(publisherEarnings.map(({ earningId }) => earningId)).size !== publisherEarnings.length || new Set(publisherEarnings.map(({ publisherId }) => publisherId)).size !== publisherEarnings.length) {
    throw new AllocationRejected("An Allocation Run may contain only one Earning per Publisher and each Earning ID must be unique.", 400);
  }
  const reserveAmount = nonnegativeInteger(body.reserveAmount, "Reserve amount");
  const platformAmount = nonnegativeInteger(body.platformAmount, "Platform amount");
  const distributableAmount = receiptAllocations.reduce((total, receipt) => total + receipt.amount, 0);
  const publisherEarningAmount = publisherEarnings.reduce((total, earning) => total + earning.amount, 0);
  if (!Number.isSafeInteger(distributableAmount) || reserveAmount + platformAmount + publisherEarningAmount !== distributableAmount) {
    throw new AllocationRejected("Allocation Run does not balance.", 400);
  }
  return { schemaVersion: 1, allocationRunId, currency, receiptAllocations, reserveAmount, platformAmount, publisherEarnings, reason, agreementReference };
}

function summary(input: NormalizedAllocation, outcome: "posted" | "duplicate") {
  return {
    outcome,
    allocationRunId: input.allocationRunId,
    currency: input.currency,
    distributableAmount: input.receiptAllocations.reduce((total, receipt) => total + receipt.amount, 0),
    reserveAmount: input.reserveAmount,
    platformAmount: input.platformAmount,
    publisherEarningAmount: input.publisherEarnings.reduce((total, earning) => total + earning.amount, 0),
  };
}

export async function postAllocationRun(input: {
  db: CloudflareEnv["DB"];
  mode: BillingMode;
  actorUserId: string;
  value: unknown;
}) {
  const allocation = normalizedInput(input.value, input.mode);
  const canonical = {
    ...allocation,
    publisherEarnings: allocation.publisherEarnings.map(({ availableAtSeconds: _ignored, ...earning }) => earning),
  };
  const requestSha256 = await sha256Hex(JSON.stringify(canonical));
  const existing = await input.db.prepare("SELECT request_sha256, status FROM allocation_run WHERE id = ?")
    .bind(allocation.allocationRunId)
    .first<{ request_sha256: string; status: string }>();
  if (existing) {
    if (existing.request_sha256 === requestSha256 && existing.status === "posted") return summary(allocation, "duplicate");
    throw new AllocationRejected("Allocation Run ID conflicts with an existing posting.", 409);
  }

  const receiptChecks = await input.db.batch(allocation.receiptAllocations.map((receipt) => input.db.prepare(`SELECT receipt.id, receipt.amount, receipt.currency, COALESCE(sum(allocated.amount), 0) AS allocated_amount
    FROM cash_receipt receipt
    JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id
    LEFT JOIN allocation_run_receipt allocated ON allocated.cash_receipt_id = receipt.id
    WHERE receipt.id = ? AND invoice.mode = ?
    GROUP BY receipt.id, receipt.amount, receipt.currency`).bind(receipt.cashReceiptId, input.mode)));
  for (const [index, result] of receiptChecks.entries()) {
    const row = result.results[0] as { amount?: number; currency?: string; allocated_amount?: number } | undefined;
    const requested = allocation.receiptAllocations[index]!;
    if (!row || row.currency !== allocation.currency || Number(row.amount) - Number(row.allocated_amount) < requested.amount) {
      throw new AllocationRejected("Cash Receipt is missing, uses another mode/currency, or lacks unallocated value.", 409);
    }
  }
  const publisherChecks = await input.db.batch(allocation.publisherEarnings.map((earning) => input.db.prepare("SELECT status FROM publisher WHERE id = ?").bind(earning.publisherId)));
  if (publisherChecks.some((result: { results: unknown[] }) => (result.results[0] as { status?: string } | undefined)?.status !== "active")) {
    throw new AllocationRejected("Every Publisher Earning requires an active Publisher.", 409);
  }

  const now = Math.floor(Date.now() / 1_000);
  const distributableAmount = allocation.receiptAllocations.reduce((total, receipt) => total + receipt.amount, 0);
  const statements: Array<ReturnType<CloudflareEnv["DB"]["prepare"]>> = [
    input.db.prepare("INSERT INTO allocation_run (id, provider, mode, currency, distributable_amount, reserve_amount, platform_amount, status, request_sha256, reason, agreement_reference, posted_by_user_id, created_at) VALUES (?, 'stripe', ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)")
      .bind(allocation.allocationRunId, input.mode, allocation.currency, distributableAmount, allocation.reserveAmount, allocation.platformAmount, requestSha256, allocation.reason, allocation.agreementReference, input.actorUserId, now),
  ];
  allocation.receiptAllocations.forEach((receipt, index) => {
    statements.push(
      input.db.prepare("INSERT INTO allocation_run_receipt (allocation_run_id, cash_receipt_id, amount) VALUES (?, ?, ?)").bind(allocation.allocationRunId, receipt.cashReceiptId, receipt.amount),
      input.db.prepare("INSERT INTO ledger_entry (id, allocation_run_id, entry_type, amount, currency, cash_receipt_id, posted_at) VALUES (?, ?, 'cash_receipt', ?, ?, ?, ?)")
        .bind(`ledger:${allocation.allocationRunId}:receipt:${index}`, allocation.allocationRunId, -receipt.amount, allocation.currency, receipt.cashReceiptId, now),
    );
  });
  allocation.publisherEarnings.forEach((earning, index) => {
    statements.push(
      input.db.prepare("INSERT INTO publisher_earning (id, allocation_run_id, publisher_id, amount, currency, available_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'accrued', ?)")
        .bind(earning.earningId, allocation.allocationRunId, earning.publisherId, earning.amount, allocation.currency, earning.availableAtSeconds, now),
      input.db.prepare("INSERT INTO ledger_entry (id, allocation_run_id, entry_type, amount, currency, publisher_id, publisher_earning_id, posted_at) VALUES (?, ?, 'publisher_earning', ?, ?, ?, ?, ?)")
        .bind(`ledger:${allocation.allocationRunId}:earning:${index}`, allocation.allocationRunId, earning.amount, allocation.currency, earning.publisherId, earning.earningId, now),
    );
  });
  if (allocation.reserveAmount > 0) statements.push(input.db.prepare("INSERT INTO ledger_entry (id, allocation_run_id, entry_type, amount, currency, posted_at) VALUES (?, ?, 'reserve', ?, ?, ?)").bind(`ledger:${allocation.allocationRunId}:reserve`, allocation.allocationRunId, allocation.reserveAmount, allocation.currency, now));
  if (allocation.platformAmount > 0) statements.push(input.db.prepare("INSERT INTO ledger_entry (id, allocation_run_id, entry_type, amount, currency, posted_at) VALUES (?, ?, 'platform', ?, ?, ?)").bind(`ledger:${allocation.allocationRunId}:platform`, allocation.allocationRunId, allocation.platformAmount, allocation.currency, now));
  statements.push(
    input.db.prepare("UPDATE allocation_run SET status = 'posted', posted_at = ? WHERE id = ? AND status = 'draft'").bind(now, allocation.allocationRunId),
    input.db.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'allocation_run_posted', 'allocation_run', ?, ?, ?)")
      .bind(crypto.randomUUID(), input.actorUserId, allocation.allocationRunId, now, allocation.reason),
  );
  try {
    await input.db.batch(statements);
    return summary(allocation, "posted");
  } catch (error) {
    const raced = await input.db.prepare("SELECT request_sha256, status FROM allocation_run WHERE id = ?")
      .bind(allocation.allocationRunId)
      .first<{ request_sha256: string; status: string }>();
    if (raced?.request_sha256 === requestSha256 && raced.status === "posted") return summary(allocation, "duplicate");
    if (raced) throw new AllocationRejected("Allocation Run ID conflicts with an existing posting.", 409);
    throw new AllocationRejected("Allocation conflicts with receipt capacity or immutable ledger state.", 409);
  }
}
