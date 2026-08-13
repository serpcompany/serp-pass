import { getCloudflareContext } from "@opennextjs/cloudflare";

import { billingModeForEnvironment } from "@/billing/read";
import { projectBillingEvent } from "@/billing/projection";
import { sha256Hex } from "@/billing/test-signature";
import { createStripeClient, createStripeCryptoProvider } from "@/billing/stripe/client";
import { readStripeWebhookConfig } from "@/billing/stripe/config";
import { projectStripeCheckoutEvent } from "@/billing/stripe/project-checkout-event";
import { StripeEventRejected, translateStripeEvent } from "@/billing/stripe/translate-event";
import { logEvent } from "@/observability/log";
import { projectStripeTransferEvent } from "@/settlement/transfer-projection";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  const config = readStripeWebhookConfig(env);
  if (!config) {
    logEvent("error", { event: "stripe_webhook_configuration", correlationId, environment: env.APP_ENV, outcome: "unavailable" });
    return Response.json({ message: "Stripe webhook ingestion is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ message: "Stripe signature is required." }, { status: 400 });

  try {
    const stripe = createStripeClient(config.secretKey, env.APP_ENV);
    const stripeEvent = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      config.webhookSecret,
      undefined,
      createStripeCryptoProvider(),
    );
    const payloadSha256 = await sha256Hex(rawBody);
    if (stripeEvent.type === "transfer.created" || stripeEvent.type === "transfer.updated" || stripeEvent.type === "transfer.reversed") {
      const result = await projectStripeTransferEvent({ db: env.DB, event: stripeEvent, mode: billingModeForEnvironment(env.APP_ENV), payloadSha256 });
      logEvent("info", { event: "stripe_transfer_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: stripeEvent.id, eventType: stripeEvent.type });
      return Response.json({ received: true, ...result }, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
    }
    if (stripeEvent.type === "checkout.session.completed" || stripeEvent.type === "checkout.session.expired") {
      const result = await projectStripeCheckoutEvent({
        db: env.DB,
        event: stripeEvent,
        mode: billingModeForEnvironment(env.APP_ENV),
        passPriceId: config.passPriceId,
        payloadSha256,
      });
      logEvent("info", { event: "stripe_webhook_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: stripeEvent.id, eventType: stripeEvent.type });
      return Response.json({ received: true, ...result }, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
    }
    const event = translateStripeEvent(stripeEvent, billingModeForEnvironment(env.APP_ENV), config.passPriceId);
    if (!event) {
      logEvent("info", { event: "stripe_webhook_projection", correlationId, environment: env.APP_ENV, outcome: "ignored", providerEventId: stripeEvent.id, eventType: stripeEvent.type });
      return Response.json({ received: true, outcome: "ignored" }, { headers: { "cache-control": "no-store" } });
    }
    const result = await projectBillingEvent(env.DB, event, payloadSha256, "stripe_webhook");
    logEvent("info", { event: "stripe_webhook_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: event.id, eventType: event.type });
    return Response.json({ received: true, ...result }, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const rejectionType = error instanceof StripeEventRejected ? "StripeEventRejected" : error instanceof Error ? error.name : "UnknownError";
    logEvent("error", { event: "stripe_webhook_projection", correlationId, environment: env.APP_ENV, outcome: "rejected", errorType: rejectionType });
    return Response.json({ message: "Stripe Event could not be verified or projected." }, { status: 400 });
  }
}
