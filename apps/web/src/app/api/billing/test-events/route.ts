import { getCloudflareContext } from "@opennextjs/cloudflare";

import { parseNormalizedBillingEvent } from "@/billing/events";
import { projectBillingEvent } from "@/billing/projection";
import { sha256Hex, verifyTestBillingSignature } from "@/billing/test-signature";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (env.APP_ENV !== "local") return new Response(null, { status: 404 });
  const fixtureSecret = (env as CloudflareEnv & { TEST_BILLING_WEBHOOK_SECRET?: string }).TEST_BILLING_WEBHOOK_SECRET;
  if (!fixtureSecret) return Response.json({ message: "Local billing fixture verifier is not configured." }, { status: 503 });

  const rawBody = await request.text();
  if (!await verifyTestBillingSignature(rawBody, request.headers.get("x-apps-pass-test-signature"), fixtureSecret)) {
    logEvent("warn", { event: "billing_fixture_signature", correlationId, environment: env.APP_ENV, outcome: "rejected" });
    return Response.json({ message: "Invalid billing fixture signature." }, { status: 400 });
  }

  try {
    const event = parseNormalizedBillingEvent(JSON.parse(rawBody));
    if (event.mode !== "test") return Response.json({ message: "Local billing fixtures must use test mode." }, { status: 400 });
    const result = await projectBillingEvent(env.DB, event, await sha256Hex(rawBody), "local_signed_fixture");
    logEvent("info", { event: "billing_fixture_projection", correlationId, environment: env.APP_ENV, outcome: result.outcome, providerEventId: event.id, eventType: event.type });
    return Response.json(result, { status: result.outcome === "applied" ? 202 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    logEvent("error", { event: "billing_fixture_projection", correlationId, environment: env.APP_ENV, outcome: "rejected", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Billing fixture could not be projected." }, { status: 400 });
  }
}
