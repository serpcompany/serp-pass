import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { decideLinkRequest, EntitlementAuthorityError } from "@/entitlements/authority";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("subscriber")) return Response.json({ message: "Subscriber role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { decision?: unknown } | null;
  if (body?.decision !== "approve" && body?.decision !== "deny") return Response.json({ message: "Approve or deny is required." }, { status: 400 });
  const { requestId } = await context.params;
  const { env } = getCloudflareContext();
  try {
    const result = await decideLinkRequest(env.DB, requestId, identity.session.user.id, body.decision);
    logEvent("info", { event: "app_link_decided", correlationId, environment: env.APP_ENV, outcome: result.status, requestId, subscriberUserId: identity.session.user.id });
    return Response.json(result);
  } catch (error) {
    if (error instanceof EntitlementAuthorityError) return Response.json({ message: error.message }, { status: error.status });
    logEvent("error", { event: "app_link_decided", correlationId, environment: env.APP_ENV, outcome: "failed", requestId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "App linking is temporarily unavailable." }, { status: 503 });
  }
}
