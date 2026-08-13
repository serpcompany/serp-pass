import { getCloudflareContext } from "@opennextjs/cloudflare";

import { EntitlementAuthorityError, exchangeLinkRequest } from "@/entitlements/authority";
import { extensionCorsHeaders, extensionPreflight, runtimeIdFromExtensionOrigin } from "@/entitlements/origin";
import { consumeAppLinkRateLimit } from "@/entitlements/rate-limit";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";
export const OPTIONS = extensionPreflight;

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const runtimeId = runtimeIdFromExtensionOrigin(origin);
  if (!origin || !runtimeId) return Response.json({ message: "Approved Chromium extension origin required." }, { status: 403 });
  const headers = extensionCorsHeaders(origin);
  const { env } = getCloudflareContext();
  const { requestId } = await context.params;
  const body = await request.json().catch(() => null) as { proofKey?: unknown } | null;
  try {
    const limit = await consumeAppLinkRateLimit(env.DB, request, "exchange");
    if (!limit.allowed) return Response.json({ message: "Too many exchange attempts. Try again later." }, { status: 429, headers: { ...headers, "retry-after": String(limit.retryAfter) } });
    const result = await exchangeLinkRequest(env.DB, requestId, body?.proofKey, runtimeId);
    logEvent("info", { event: "app_link_exchanged", correlationId, environment: env.APP_ENV, outcome: "created", requestId });
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof EntitlementAuthorityError) {
      logEvent("warn", { event: "app_link_exchanged", correlationId, environment: env.APP_ENV, outcome: "rejected", requestId, errorType: error.name });
      return Response.json({ message: error.message }, { status: error.status, headers });
    }
    logEvent("error", { event: "app_link_exchanged", correlationId, environment: env.APP_ENV, outcome: "failed", requestId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "App linking is temporarily unavailable." }, { status: 503, headers });
  }
}
