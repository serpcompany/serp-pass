import { getCloudflareContext } from "@opennextjs/cloudflare";

import { logEvent } from "@/observability/log";
import { createAuth } from "@/auth/server";

export const dynamic = "force-dynamic";

async function handleAuth(request: Request) {
  const url = new URL(request.url);
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();

  try {
    const response = await createAuth(url.origin).handler(request);
    logEvent(response.ok ? "info" : "warn", {
      event: "human_auth_request",
      correlationId,
      environment: env.APP_ENV,
      outcome: response.ok ? "accepted" : "rejected",
      method: request.method,
      authPath: url.pathname.replace("/api/auth/", ""),
      status: response.status,
    });
    return response;
  } catch (error) {
    logEvent("error", {
      event: "human_auth_failure",
      correlationId,
      environment: env.APP_ENV,
      outcome: "error",
      method: request.method,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}

export const GET = handleAuth;
export const POST = handleAuth;
