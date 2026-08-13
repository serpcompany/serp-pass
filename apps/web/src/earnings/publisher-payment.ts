import type { BillingMode } from "@/billing/events";
import { sha256Hex } from "@/billing/test-signature";

type PaymentMethod = "ach" | "bank_transfer" | "paypal" | "wise" | "other";

type NormalizedPayment = {
  schemaVersion: 1;
  paymentId: string;
  earningId: string;
  method: PaymentMethod;
  providerReference: string;
  paidAt: string;
  paidAtSeconds: number;
  reason: string;
};

export class PublisherPaymentRejected extends Error {
  constructor(message: string, readonly status: 400 | 409) {
    super(message);
  }
}

function normalize(value: unknown): NormalizedPayment {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PublisherPaymentRejected("Publisher Payment request is invalid.", 400);
  const body = value as Record<string, unknown>;
  const expected = ["schemaVersion", "paymentId", "earningId", "method", "providerReference", "paidAt", "reason"].sort();
  const actual = Object.keys(body).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new PublisherPaymentRejected("Publisher Payment request contains unsupported fields.", 400);
  if (body.schemaVersion !== 1) throw new PublisherPaymentRejected("Publisher Payment schema version is unsupported.", 400);
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const earningId = typeof body.earningId === "string" ? body.earningId.trim() : "";
  const method = typeof body.method === "string" ? body.method.trim() : "";
  const providerReference = typeof body.providerReference === "string" ? body.providerReference.trim() : "";
  const paidAtInput = typeof body.paidAt === "string" ? body.paidAt.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!/^payment_[A-Za-z0-9_-]{6,120}$/u.test(paymentId)) throw new PublisherPaymentRejected("Publisher Payment ID is invalid.", 400);
  if (!/^earning_[A-Za-z0-9_-]{6,120}$/u.test(earningId)) throw new PublisherPaymentRejected("Publisher Earning ID is invalid.", 400);
  if (!["ach", "bank_transfer", "paypal", "wise", "other"].includes(method)) throw new PublisherPaymentRejected("Publisher Payment method is unsupported.", 400);
  if (!/^[A-Za-z0-9._:/-]{4,160}$/u.test(providerReference)) throw new PublisherPaymentRejected("Provider reference must be an opaque identifier and must not contain payment credentials or an email address.", 400);
  const paidAtMilliseconds = Date.parse(paidAtInput);
  if (!Number.isFinite(paidAtMilliseconds)) throw new PublisherPaymentRejected("Publisher Payment paid-at time is invalid.", 400);
  const paidAtSeconds = Math.floor(paidAtMilliseconds / 1_000);
  if (paidAtSeconds > Math.floor(Date.now() / 1_000) + 300) throw new PublisherPaymentRejected("Publisher Payment cannot be recorded in the future.", 400);
  if (reason.length < 10 || reason.length > 1_000) throw new PublisherPaymentRejected("Publisher Payment reason must be between 10 and 1000 characters.", 400);
  return { schemaVersion: 1, paymentId, earningId, method: method as PaymentMethod, providerReference, paidAt: new Date(paidAtSeconds * 1_000).toISOString(), paidAtSeconds, reason };
}

export async function recordPublisherPayment(input: {
  db: CloudflareEnv["DB"];
  mode: BillingMode;
  actorUserId: string;
  value: unknown;
}) {
  const payment = normalize(input.value);
  const { paidAtSeconds: _paidAtSeconds, ...canonical } = payment;
  const requestSha256 = await sha256Hex(JSON.stringify(canonical));
  const existing = await input.db.prepare("SELECT request_sha256, publisher_earning_id, amount, currency FROM publisher_payment WHERE id = ?")
    .bind(payment.paymentId)
    .first<{ request_sha256: string; publisher_earning_id: string; amount: number; currency: string }>();
  if (existing) {
    if (existing.request_sha256 === requestSha256) return { outcome: "duplicate" as const, paymentId: payment.paymentId, earningId: existing.publisher_earning_id, amount: existing.amount, currency: existing.currency };
    throw new PublisherPaymentRejected("Publisher Payment ID conflicts with an existing record.", 409);
  }
  const earning = await input.db.prepare(`SELECT earning.publisher_id, earning.amount, earning.currency, earning.available_at, earning.status, run.mode
    FROM publisher_earning earning JOIN allocation_run run ON run.id = earning.allocation_run_id WHERE earning.id = ?`)
    .bind(payment.earningId)
    .first<{ publisher_id: string; amount: number; currency: string; available_at: number; status: string; mode: BillingMode }>();
  if (!earning || earning.mode !== input.mode) throw new PublisherPaymentRejected("Publisher Earning is missing or belongs to another mode.", 409);
  if (earning.status !== "accrued") throw new PublisherPaymentRejected("Publisher Earning is not eligible for an external payment.", 409);
  if (earning.available_at > payment.paidAtSeconds) throw new PublisherPaymentRejected("Publisher Payment predates the Earning hold release.", 409);
  const now = Math.floor(Date.now() / 1_000);
  try {
    await input.db.batch([
      input.db.prepare("INSERT INTO publisher_payment (id, publisher_earning_id, publisher_id, mode, method, provider_reference, amount, currency, paid_at, request_sha256, reason, recorded_by_user_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payment.paymentId, payment.earningId, earning.publisher_id, input.mode, payment.method, payment.providerReference, earning.amount, earning.currency, payment.paidAtSeconds, requestSha256, payment.reason, input.actorUserId, now),
      input.db.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_payment_recorded', 'publisher_payment', ?, ?, ?)")
        .bind(crypto.randomUUID(), input.actorUserId, payment.paymentId, now, payment.reason),
    ]);
  } catch (error) {
    const raced = await input.db.prepare("SELECT request_sha256, publisher_earning_id, amount, currency FROM publisher_payment WHERE id = ?")
      .bind(payment.paymentId)
      .first<{ request_sha256: string; publisher_earning_id: string; amount: number; currency: string }>();
    if (raced?.request_sha256 === requestSha256) return { outcome: "duplicate" as const, paymentId: payment.paymentId, earningId: raced.publisher_earning_id, amount: raced.amount, currency: raced.currency };
    if (raced) throw new PublisherPaymentRejected("Publisher Payment ID conflicts with an existing record.", 409);
    const conflictingIdentity = await input.db.prepare(`SELECT id FROM publisher_payment
      WHERE publisher_earning_id = ? OR (mode = ? AND method = ? AND provider_reference = ?) LIMIT 1`)
      .bind(payment.earningId, input.mode, payment.method, payment.providerReference)
      .first<{ id: string }>();
    if (conflictingIdentity) throw new PublisherPaymentRejected("Publisher Earning or provider reference is already associated with another Payment.", 409);
    throw error;
  }
  return { outcome: "recorded" as const, paymentId: payment.paymentId, earningId: payment.earningId, amount: earning.amount, currency: earning.currency };
}
