import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/get-db";
import { appDistributions, apps, publishers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ appId: string; runtimeId: string }> }) {
  const { appId, runtimeId } = await context.params;
  const identity = await getDb()
    .select({ appId: apps.id, appName: apps.name, appStatus: apps.status, publisherId: publishers.id, publisherName: publishers.name, runtimeId: appDistributions.runtimeId, distributionStatus: appDistributions.status })
    .from(apps)
    .innerJoin(publishers, eq(publishers.id, apps.publisherId))
    .innerJoin(appDistributions, eq(appDistributions.appId, apps.id))
    .where(and(eq(apps.id, appId), eq(appDistributions.runtimeId, runtimeId), eq(apps.status, "approved"), eq(appDistributions.status, "approved")))
    .get();
  if (!identity) return Response.json({ message: "Approved App Distribution not found." }, { status: 404 });
  return Response.json(identity, { headers: { "cache-control": "no-store" } });
}
