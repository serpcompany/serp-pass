import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment } from "@/billing/read";
import { readStripeTestSettlementConfig } from "@/billing/stripe/config";
import { logEvent } from "@/observability/log";
import { localTransferExecutor, releasePublisherEarning, SettlementRejected, stripeTestTransferExecutor } from "@/settlement/release";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });
  const value = await request.json().catch(() => null);
  try {
    const stripeSettlement = readStripeTestSettlementConfig(env);
    const result = await releasePublisherEarning({
      db: env.DB,
      mode: billingModeForEnvironment(env.APP_ENV),
      actorUserId: identity.session.user.id,
      value,
      executor: env.APP_ENV === "local" ? localTransferExecutor() : stripeSettlement ? stripeTestTransferExecutor(stripeSettlement) : null,
    });
    logEvent("info", { event: "publisher_earning_release", correlationId, environment: env.APP_ENV, outcome: result.outcome, settlementId: result.settlementId, simulated: result.simulated });
    return Response.json(result, { status: result.outcome === "transferred" ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SettlementRejected) return Response.json({ message: error.message }, { status: error.status });
    logEvent("error", { event: "publisher_earning_release", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Publisher Earning could not be released." }, { status: 500 });
  }
}
