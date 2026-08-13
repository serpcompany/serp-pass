import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment, readSubscriberSubscription } from "@/billing/read";
import { assertStripePlatformAccount, createStripeClient } from "@/billing/stripe/client";
import { createOrResumeCheckout } from "@/billing/stripe/checkout";
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
  if (!config) return Response.json({ message: "Stripe Checkout is not configured." }, { status: 503 });
  const subscription = await readSubscriberSubscription(identity.session.user.id, env.APP_ENV);
  if (subscription?.access === "active" || (subscription && !["canceled", "incomplete_expired"].includes(subscription.status))) {
    return Response.json({ message: "Manage the existing Subscription instead of creating another." }, { status: 409 });
  }

  try {
    const stripe = createStripeClient(config.secretKey, env.APP_ENV);
    await assertStripePlatformAccount(stripe, config.expectedAccountId);
    const url = await createOrResumeCheckout({
      db: env.DB,
      stripe,
      subscriber: { id: identity.session.user.id, email: identity.session.user.email, name: identity.session.user.name },
      mode: billingModeForEnvironment(env.APP_ENV),
      passPriceId: config.passPriceId,
      applicationOrigin: new URL(request.url).origin,
      allowAfterCompleted: subscription !== null,
    });
    logEvent("info", { event: "stripe_checkout", correlationId, environment: env.APP_ENV, outcome: "redirect", subscriberUserId: identity.session.user.id });
    return new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });
  } catch (error) {
    logEvent("error", { event: "stripe_checkout", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Stripe Checkout could not be started." }, { status: 502 });
  }
}
