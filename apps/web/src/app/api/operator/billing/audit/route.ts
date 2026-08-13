import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { billingModeForEnvironment } from "@/billing/read";
import { logEvent } from "@/observability/log";
import { readOperatorJourneyTrace } from "@/operator/journey-trace";

export const dynamic = "force-dynamic";

function count(result: { results?: unknown[] }) {
  return Number((result.results?.[0] as { count?: number } | undefined)?.count ?? 0);
}

export async function GET(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });
  const subscriberUserId = new URL(request.url).searchParams.get("subscriberUserId")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(subscriberUserId)) return Response.json({ message: "A valid Subscriber user ID is required." }, { status: 400 });

  const { env } = getCloudflareContext();
  const mode = billingModeForEnvironment(env.APP_ENV);
  const results = await env.DB.batch([
    env.DB.prepare("SELECT count(*) AS count FROM billing_customer WHERE provider = 'stripe' AND mode = ? AND subscriber_user_id = ?").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM normalized_subscription subscription JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE subscription.mode = ? AND customer.subscriber_user_id = ?").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM billing_event event JOIN billing_customer customer ON customer.id = event.billing_customer_id WHERE event.mode = ? AND customer.subscriber_user_id = ?").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM billing_invoice invoice JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE invoice.mode = ? AND customer.subscriber_user_id = ?").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM cash_receipt receipt JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE invoice.mode = ? AND customer.subscriber_user_id = ?").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM billing_invoice invoice JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id LEFT JOIN cash_receipt receipt ON receipt.billing_invoice_id = invoice.id WHERE invoice.mode = ? AND customer.subscriber_user_id = ? AND invoice.status = 'paid' AND receipt.id IS NULL").bind(mode, subscriberUserId),
    env.DB.prepare("SELECT count(*) AS count FROM cash_receipt receipt JOIN billing_invoice invoice ON invoice.id = receipt.billing_invoice_id JOIN normalized_subscription subscription ON subscription.id = invoice.normalized_subscription_id JOIN billing_customer customer ON customer.id = subscription.billing_customer_id WHERE invoice.mode = ? AND customer.subscriber_user_id = ? AND (receipt.amount <> invoice.amount_paid OR receipt.currency <> invoice.currency)").bind(mode, subscriberUserId),
  ]);
  const issues = [];
  if (count(results[5]) > 0) issues.push("paid_invoice_missing_cash_receipt");
  if (count(results[6]) > 0) issues.push("cash_receipt_invoice_mismatch");
  const trace = await readOperatorJourneyTrace(env.DB, mode, subscriberUserId);
  logEvent("info", {
    event: "operator_journey_trace",
    correlationId,
    environment: env.APP_ENV,
    outcome: issues.length === 0 ? "consistent" : "issues_found",
    subscriberUserId,
    billingEventCount: trace.billingEvents.length,
    linkRequestCount: trace.linkRequests.length,
    allocationRunCount: trace.allocationRuns.length,
    settlementCount: trace.settlements.length,
  });
  return Response.json({
    counts: {
      customers: count(results[0]),
      subscriptions: count(results[1]),
      events: count(results[2]),
      invoices: count(results[3]),
      cashReceipts: count(results[4]),
    },
    issues,
    trace,
  }, { headers: { "cache-control": "no-store", "x-apps-pass-correlation-id": correlationId } });
}
