import type { BillingMode } from "@/billing/events";

type Row = Record<string, string | number | null>;

function rows(result: { results?: unknown[] }) {
  return (result.results ?? []) as Row[];
}

export async function readOperatorJourneyTrace(db: CloudflareEnv["DB"], mode: BillingMode, subscriberUserId: string) {
  const result = await db.batch([
    db.prepare("SELECT id, provider_session_id, status FROM billing_checkout_attempt WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? ORDER BY created_at, id").bind(mode, subscriberUserId),
    db.prepare("SELECT provider_customer_id FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ? ORDER BY provider_customer_id").bind(mode, subscriberUserId),
    db.prepare("SELECT subscription.provider_subscription_id FROM normalized_subscription subscription JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE subscription.mode = ? AND customer.subscriber_user_id = ? ORDER BY subscription.provider_subscription_id").bind(mode, subscriberUserId),
    db.prepare("SELECT event.provider_event_id FROM billing_event event JOIN billing_customer customer ON customer.id = event.billing_customer_id WHERE event.mode = ? AND customer.subscriber_user_id = ? ORDER BY event.provider_created_at, event.provider_event_id").bind(mode, subscriberUserId),
    db.prepare("SELECT invoice.provider_invoice_id FROM billing_invoice invoice JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE invoice.mode = ? AND customer.subscriber_user_id = ? ORDER BY invoice.provider_invoice_id").bind(mode, subscriberUserId),
    db.prepare("SELECT invoice.provider_invoice_id, receipt.amount, receipt.currency FROM cash_receipt receipt JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE invoice.mode = ? AND customer.subscriber_user_id = ? ORDER BY invoice.provider_invoice_id").bind(mode, subscriberUserId),
    db.prepare("SELECT id, app_id, status FROM app_link_request WHERE subscriber_user_id = ? ORDER BY created_at, id").bind(subscriberUserId),
    db.prepare("SELECT session.id, link.app_id, CASE WHEN session.revoked_at IS NULL THEN 'active' ELSE 'revoked' END AS status FROM app_session session JOIN app_link link ON link.id = session.app_link_id WHERE link.subscriber_user_id = ? ORDER BY session.created_at, session.id").bind(subscriberUserId),
    db.prepare(`SELECT DISTINCT run.id, run.status, run.distributable_amount, run.reserve_amount, run.platform_amount, run.currency
      FROM allocation_run run JOIN allocation_run_receipt allocated ON allocated.allocation_run_id = run.id
      JOIN cash_receipt receipt ON receipt.id = allocated.cash_receipt_id JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id
      JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id
      WHERE run.mode = ? AND customer.subscriber_user_id = ? ORDER BY run.created_at, run.id`).bind(mode, subscriberUserId),
    db.prepare(`SELECT DISTINCT earning.id, earning.allocation_run_id, earning.publisher_id, earning.amount, earning.currency, earning.status
      FROM publisher_earning earning JOIN allocation_run run ON run.id = earning.allocation_run_id
      JOIN allocation_run_receipt allocated ON allocated.allocation_run_id = run.id JOIN cash_receipt receipt ON receipt.id = allocated.cash_receipt_id
      JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id
      JOIN billing_customer customer ON customer.id = subscription.billing_customer_id
      WHERE run.mode = ? AND customer.subscriber_user_id = ? ORDER BY earning.created_at, earning.id`).bind(mode, subscriberUserId),
    db.prepare(`SELECT DISTINCT payment.id, payment.publisher_earning_id, payment.publisher_id, payment.amount, payment.currency, payment.method, payment.provider_reference, payment.paid_at
      FROM publisher_payment payment JOIN publisher_earning earning ON earning.id = payment.publisher_earning_id JOIN allocation_run run ON run.id = earning.allocation_run_id
      JOIN allocation_run_receipt allocated ON allocated.allocation_run_id = run.id JOIN cash_receipt receipt ON receipt.id = allocated.cash_receipt_id
      JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id
      JOIN billing_customer customer ON customer.id = subscription.billing_customer_id
      WHERE payment.mode = ? AND customer.subscriber_user_id = ? ORDER BY payment.paid_at, payment.id`).bind(mode, subscriberUserId),
    db.prepare(`SELECT DISTINCT settlement.id, settlement.publisher_earning_id, settlement.publisher_id, settlement.amount, settlement.currency, settlement.status
      FROM settlement JOIN publisher_earning earning ON earning.id = settlement.publisher_earning_id JOIN allocation_run run ON run.id = earning.allocation_run_id
      JOIN allocation_run_receipt allocated ON allocated.allocation_run_id = run.id JOIN cash_receipt receipt ON receipt.id = allocated.cash_receipt_id
      JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id
      JOIN billing_customer customer ON customer.id = subscription.billing_customer_id
      WHERE settlement.mode = ? AND customer.subscriber_user_id = ? ORDER BY settlement.created_at, settlement.id`).bind(mode, subscriberUserId),
    db.prepare(`SELECT DISTINCT attempt.provider_transfer_id, attempt.settlement_id, attempt.amount, attempt.currency, attempt.status, attempt.execution_mode
      FROM transfer_attempt attempt JOIN settlement ON settlement.id = attempt.settlement_id JOIN publisher_earning earning ON earning.id = settlement.publisher_earning_id
      JOIN allocation_run run ON run.id = earning.allocation_run_id JOIN allocation_run_receipt allocated ON allocated.allocation_run_id = run.id
      JOIN cash_receipt receipt ON receipt.id = allocated.cash_receipt_id JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id
      JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id
      WHERE settlement.mode = ? AND customer.subscriber_user_id = ? ORDER BY attempt.created_at, attempt.id`).bind(mode, subscriberUserId),
  ]);

  return {
    subscriberUserId,
    checkoutAttempts: rows(result[0]).map((row) => ({ attemptId: row.id, providerSessionId: row.provider_session_id, status: row.status })),
    billingCustomers: rows(result[1]).map((row) => row.provider_customer_id),
    subscriptions: rows(result[2]).map((row) => row.provider_subscription_id),
    billingEvents: rows(result[3]).map((row) => row.provider_event_id),
    invoices: rows(result[4]).map((row) => row.provider_invoice_id),
    cashReceipts: rows(result[5]).map((row) => ({ providerInvoiceId: row.provider_invoice_id, amount: row.amount, currency: row.currency })),
    linkRequests: rows(result[6]).map((row) => ({ requestId: row.id, appId: row.app_id, status: row.status })),
    appSessions: rows(result[7]).map((row) => ({ sessionId: row.id, appId: row.app_id, status: row.status })),
    allocationRuns: rows(result[8]).map((row) => ({ allocationRunId: row.id, status: row.status, distributableAmount: row.distributable_amount, reserveAmount: row.reserve_amount, platformAmount: row.platform_amount, currency: row.currency })),
    publisherEarnings: rows(result[9]).map((row) => ({ earningId: row.id, allocationRunId: row.allocation_run_id, publisherId: row.publisher_id, amount: row.amount, currency: row.currency, status: row.status })),
    publisherPayments: rows(result[10]).map((row) => ({ paymentId: row.id, earningId: row.publisher_earning_id, publisherId: row.publisher_id, amount: row.amount, currency: row.currency, method: row.method, providerReference: row.provider_reference, paidAt: row.paid_at })),
    settlements: rows(result[11]).map((row) => ({ settlementId: row.id, earningId: row.publisher_earning_id, publisherId: row.publisher_id, amount: row.amount, currency: row.currency, status: row.status })),
    transfers: rows(result[12]).map((row) => ({ providerTransferId: row.provider_transfer_id, settlementId: row.settlement_id, amount: row.amount, currency: row.currency, status: row.status, executionMode: row.execution_mode })),
  };
}
