import { getCloudflareContext } from "@opennextjs/cloudflare";

import { checkEntitlement } from "@/entitlements/authority";
import { extensionCorsHeaders, extensionPreflight, runtimeIdFromExtensionOrigin } from "@/entitlements/origin";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";
export const OPTIONS = extensionPreflight;

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const originRuntimeId = runtimeIdFromExtensionOrigin(origin);
  if (!origin || !originRuntimeId) return Response.json({ message: "Approved Chromium extension origin required." }, { status: 403 });
  const headers = extensionCorsHeaders(origin);
  const authorization = request.headers.get("authorization");
  const appId = request.headers.get("x-app-id");
  const runtimeId = request.headers.get("x-runtime-id");
  if (!authorization?.startsWith("Bearer ") || !appId || runtimeId !== originRuntimeId) {
    return Response.json({ message: "Invalid App session." }, { status: 401, headers });
  }
  const { env } = getCloudflareContext();
  try {
    const entitlement = await checkEntitlement(env.DB, env.APP_ENV, authorization.slice(7), appId, runtimeId);
    if (!entitlement) return Response.json({ message: "Invalid App session." }, { status: 401, headers });
    logEvent("info", { event: "entitlement_checked", correlationId, environment: env.APP_ENV, outcome: entitlement.status, appId });
    return Response.json(entitlement, { headers });
  } catch (error) {
    logEvent("error", { event: "entitlement_checked", correlationId, environment: env.APP_ENV, outcome: "temporarily_unavailable", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ status: "temporarily_unavailable" }, { status: 503, headers });
  }
}
