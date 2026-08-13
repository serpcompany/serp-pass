import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment } from "@/billing/read";
import { assertStripePlatformAccount, createStripeClient } from "@/billing/stripe/client";
import { createPortal } from "@/billing/stripe/checkout";
import { readStripeHostedBillingConfig } from "@/billing/stripe/config";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("subscriber")) return Response.json({ message: "Subscriber role required." }, { status: 403 });
  const { env } = getCloudflareContext();
  const config = readStripeHostedBillingConfig(env);
  if (!config) return Response.json({ message: "Stripe billing management is not configured." }, { status: 503 });

  try {
    const stripe = createStripeClient(config.secretKey, env.APP_ENV);
    await assertStripePlatformAccount(stripe, config.expectedAccountId);
    const url = await createPortal({
      db: env.DB,
      stripe,
      subscriberId: identity.session.user.id,
      mode: billingModeForEnvironment(env.APP_ENV),
      applicationOrigin: new URL(request.url).origin,
    });
    if (!url) return Response.json({ message: "No Stripe Billing Customer exists for this Subscriber." }, { status: 409 });
    logEvent("info", { event: "stripe_portal", correlationId, environment: env.APP_ENV, outcome: "redirect", subscriberUserId: identity.session.user.id });
    return new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });
  } catch (error) {
    logEvent("error", { event: "stripe_portal", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Stripe billing management could not be started." }, { status: 502 });
  }
}
