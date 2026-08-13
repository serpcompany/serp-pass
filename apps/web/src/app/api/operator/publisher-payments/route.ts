import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment } from "@/billing/read";
import { PublisherPaymentRejected, recordPublisherPayment } from "@/earnings/publisher-payment";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });
  const { env } = getCloudflareContext();
  try {
    const result = await recordPublisherPayment({ db: env.DB, mode: billingModeForEnvironment(env.APP_ENV), actorUserId: identity.session.user.id, value: await request.json().catch(() => null) });
    logEvent("info", { event: "publisher_payment_recorded", correlationId, environment: env.APP_ENV, outcome: result.outcome, paymentId: result.paymentId, earningId: result.earningId });
    return Response.json(result, { status: result.outcome === "recorded" ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof PublisherPaymentRejected) return Response.json({ message: error.message }, { status: error.status });
    logEvent("error", { event: "publisher_payment_recorded", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Publisher Payment could not be recorded." }, { status: 500 });
  }
}
