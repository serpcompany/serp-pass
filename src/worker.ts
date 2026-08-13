import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { appDistributions, apps, publishers } from "./db/schema";
import { importApp, ImportConflictError } from "./import-app";
import { ManifestValidationError } from "./manifest";

type Env = {
  DB: D1Database;
};

async function state(env: Env) {
  const db = drizzle(env.DB);
  const [publisherRows, appRows, distributionRows] = await Promise.all([
    db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.id)),
    db.select({
      id: apps.id,
      publisherId: apps.publisherId,
      name: apps.name,
      features: apps.features,
      status: apps.status,
    }).from(apps).orderBy(asc(apps.id)),
    db.select({
      appId: appDistributions.appId,
      browserFamily: appDistributions.browserFamily,
      channel: appDistributions.channel,
      runtimeId: appDistributions.runtimeId,
    }).from(appDistributions).orderBy(
      asc(appDistributions.appId),
      asc(appDistributions.channel),
      asc(appDistributions.runtimeId),
    ),
  ]);
  return {
    publishers: publisherRows,
    apps: appRows,
    distributions: distributionRows,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (request.method === "GET" && url.pathname === "/operator/state") {
      return Response.json(await state(env));
    }
    if (request.method === "POST" && url.pathname === "/operator/import-app") {
      try {
        return Response.json(await importApp(env.DB, await request.json()));
      } catch (error) {
        if (error instanceof ManifestValidationError) {
          return Response.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof ImportConflictError) {
          return Response.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
