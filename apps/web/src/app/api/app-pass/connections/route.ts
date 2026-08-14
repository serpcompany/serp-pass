import { getCloudflareContext } from "@opennextjs/cloudflare";

import { AppConnectionError, verifyAppConnection } from "@/apps/connection";
import { extensionCorsHeaders, extensionPreflight, runtimeIdFromExtensionOrigin } from "@/entitlements/origin";
import { consumeAppLinkRateLimit } from "@/entitlements/rate-limit";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";
export const OPTIONS = extensionPreflight;

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const runtimeId = runtimeIdFromExtensionOrigin(origin);
  if (!origin || !runtimeId) return Response.json({ message: "Chromium extension origin required." }, { status: 403 });
  const headers = extensionCorsHeaders(origin);
  const { env } = getCloudflareContext();
  try {
    const limit = await consumeAppLinkRateLimit(env.DB, request, "connection");
    if (!limit.allowed) return Response.json({ message: "Too many connection checks. Try again later." }, { status: 429, headers: { ...headers, "retry-after": String(limit.retryAfter) } });
    const result = await verifyAppConnection(env.DB, await request.json().catch(() => null), runtimeId);
    logEvent("info", { event: "app_connection_verified", correlationId, environment: env.APP_ENV, outcome: result.status, appId: result.appId });
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof AppConnectionError) {
      logEvent("warn", { event: "app_connection_verified", correlationId, environment: env.APP_ENV, outcome: "rejected", errorType: error.name });
      return Response.json({ message: error.message }, { status: error.status, headers });
    }
    logEvent("error", { event: "app_connection_verified", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Connection verification is temporarily unavailable." }, { status: 503, headers });
  }
}
