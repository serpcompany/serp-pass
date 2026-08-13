import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createLinkRequest, EntitlementAuthorityError } from "@/entitlements/authority";
import { extensionCorsHeaders, extensionPreflight, runtimeIdFromExtensionOrigin } from "@/entitlements/origin";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";
export const OPTIONS = extensionPreflight;

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const runtimeId = runtimeIdFromExtensionOrigin(origin);
  if (!origin || !runtimeId) return Response.json({ message: "Approved Chromium extension origin required." }, { status: 403 });
  const headers = extensionCorsHeaders(origin);
  const { env } = getCloudflareContext();
  try {
    const result = await createLinkRequest(env.DB, await request.json().catch(() => null), runtimeId, new URL(request.url).origin);
    logEvent("info", { event: "app_link_requested", correlationId, environment: env.APP_ENV, outcome: "created", requestId: result.requestId });
    return Response.json(result, { status: 201, headers });
  } catch (error) {
    if (error instanceof EntitlementAuthorityError) {
      logEvent("warn", { event: "app_link_requested", correlationId, environment: env.APP_ENV, outcome: "rejected", errorType: error.name });
      return Response.json({ message: error.message }, { status: error.status, headers });
    }
    logEvent("error", { event: "app_link_requested", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "App linking is temporarily unavailable." }, { status: 503, headers });
  }
}
