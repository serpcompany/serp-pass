import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment } from "@/billing/read";
import { assertStripePlatformAccount, createStripeClient } from "@/billing/stripe/client";
import { readStripeConnectOnboardingConfig } from "@/billing/stripe/config";
import { beginConnectOnboarding, ConnectOnboardingRejected, localConnectOnboardingExecutor, stripeConnectOnboardingExecutor } from "@/connect/onboarding";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("publisher")) return Response.json({ message: "Publisher role required." }, { status: 403 });
  const { env } = getCloudflareContext();
  const fields = await request.formData().catch(() => null);
  if (fields?.get("schemaVersion") !== "1") return Response.json({ message: "Unsupported onboarding request version." }, { status: 400 });
  const publisherId = String(fields?.get("publisherId") ?? "");
  const country = fields?.get("country");

  try {
    let executor;
    if (env.APP_ENV === "local") {
      executor = localConnectOnboardingExecutor();
    } else {
      const config = readStripeConnectOnboardingConfig(env);
      if (!config) return Response.json({ message: "Stripe Connect onboarding is not configured." }, { status: 503 });
      const stripe = createStripeClient(config.secretKey, env.APP_ENV);
      await assertStripePlatformAccount(stripe, config.expectedAccountId);
      executor = stripeConnectOnboardingExecutor(stripe);
    }
    const result = await beginConnectOnboarding({
      db: env.DB,
      mode: billingModeForEnvironment(env.APP_ENV),
      actorUserId: identity.session.user.id,
      actorEmail: identity.session.user.email,
      publisherId,
      country,
      applicationOrigin: new URL(request.url).origin,
      executor,
    });
    logEvent("info", { event: "stripe_connect_onboarding", correlationId, environment: env.APP_ENV, outcome: "redirect", publisherId: result.publisherId, providerAccountId: result.providerAccountId });
    return new Response(null, { status: 303, headers: { location: result.url, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ConnectOnboardingRejected) return Response.json({ message: error.message }, { status: error.status });
    logEvent("error", { event: "stripe_connect_onboarding", correlationId, environment: env.APP_ENV, outcome: "failed", publisherId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Stripe Connect onboarding could not be started." }, { status: 502 });
  }
}
