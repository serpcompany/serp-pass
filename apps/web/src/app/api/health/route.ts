import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getDb } from "@/db/get-db";
import { stackSpikeChecks } from "@/db/schema";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();

  try {
    const check = await getDb().select().from(stackSpikeChecks).limit(1);
    const ready = check.some((row) => row.id === "d1-ready");

    logEvent("info", {
      event: "stack_health_checked",
      correlationId,
      environment: env.APP_ENV,
      outcome: ready ? "ready" : "migration_missing",
    });

    return Response.json(
      {
        status: ready ? "ready" : "degraded",
        environment: env.APP_ENV,
        checks: { worker: true, d1: ready, drizzle: ready },
        correlationId,
      },
      { status: ready ? 200 : 503 },
    );
  } catch (error) {
    logEvent("error", {
      event: "stack_health_failed",
      correlationId,
      environment: env.APP_ENV,
      outcome: "error",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });

    return Response.json(
      {
        status: "unavailable",
        environment: env.APP_ENV,
        checks: { worker: true, d1: false, drizzle: false },
        correlationId,
      },
      { status: 503 },
    );
  }
}
