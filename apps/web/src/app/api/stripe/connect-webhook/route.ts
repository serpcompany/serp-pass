import { getCloudflareContext } from "@opennextjs/cloudflare";

import { billingModeForEnvironment } from "@/billing/read";
import { sha256Hex } from "@/billing/test-signature";
import { createStripeClient, createStripeCryptoProvider } from "@/billing/stripe/client";
import { readStripeConnectWebhookConfig } from "@/billing/stripe/config";
import { StripeEventRejected } from "@/billing/stripe/translate-event";
import { projectConnectedAccountPayoutEvent } from "@/connect/payout-projection";
import { projectConnectAccountEvent } from "@/connect/projection";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  const config = readStripeConnectWebhookConfig(env);
  if (!config) {
    logEvent("error", { event: "stripe_connect_webhook_configuration", correlationId, environment: env.APP_ENV, outcome: "unavailable" });
    return Response.json({ message: "Stripe Connect webhook ingestion is not configured." }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ message: "Stripe signature is required." }, { status: 400 });
  try {
    const stripe = createStripeClient(config.secretKey, env.APP_ENV);
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, config.webhookSecret, undefined, createStripeCryptoProvider());
    const payloadSha256 = await sha256Hex(rawBody);
    const mode = billingModeForEnvironment(env.APP_ENV);
    if (event.type === "account.updated") {
      const result = await projectConnectAccountEvent({ db: env.DB, event, mode, payloadSha256 });
      logEvent("info", { event: "stripe_connect_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: event.id, eventType: event.type });
      return Response.json({ received: true, ...result }, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
    }
    if (event.type === "payout.created" || event.type === "payout.updated" || event.type === "payout.paid" || event.type === "payout.failed" || event.type === "payout.canceled") {
      const result = await projectConnectedAccountPayoutEvent({ db: env.DB, event, mode, payloadSha256 });
      logEvent("info", { event: "stripe_payout_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: event.id, eventType: event.type });
      return Response.json({ received: true, ...result }, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
    }
    logEvent("info", { event: "stripe_connect_projection", correlationId, environment: env.APP_ENV, outcome: "ignored", providerEventId: event.id, eventType: event.type });
    return Response.json({ received: true, outcome: "ignored" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const rejectionType = error instanceof StripeEventRejected ? "StripeEventRejected" : error instanceof Error ? error.name : "UnknownError";
    logEvent("error", { event: "stripe_connect_projection", correlationId, environment: env.APP_ENV, outcome: "rejected", errorType: rejectionType });
    return Response.json({ message: "Stripe Connect Event could not be verified or projected." }, { status: 400 });
  }
}
