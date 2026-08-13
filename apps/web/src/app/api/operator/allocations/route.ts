import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { billingModeForEnvironment } from "@/billing/read";
import { AllocationRejected, postAllocationRun } from "@/earnings/allocation";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });
  const value = await request.json().catch(() => null);
  try {
    const result = await postAllocationRun({ db: env.DB, mode: billingModeForEnvironment(env.APP_ENV), actorUserId: identity.session.user.id, value });
    logEvent("info", { event: "allocation_run_posted", correlationId, environment: env.APP_ENV, outcome: result.outcome, allocationRunId: result.allocationRunId });
    return Response.json(result, { status: result.outcome === "posted" ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AllocationRejected) return Response.json({ message: error.message }, { status: error.status });
    logEvent("error", { event: "allocation_run_posted", correlationId, environment: env.APP_ENV, outcome: "failed", errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Allocation Run could not be posted." }, { status: 500 });
  }
}
