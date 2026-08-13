import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { appDistributions, apps, publishers } from "./db/schema";
import { importApp, ImportConflictError } from "./import-app";
import { ManifestValidationError } from "./manifest";
import {
  activateLocalSubscription,
  AppPassRequestError,
  approveLinkRequest,
  checkEntitlement,
  createLinkRequest,
  exchangeLinkRequest,
  expireLinkRequest,
  phase2State,
  revokeAppSession,
  setAppStatus,
} from "./app-pass";

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
    try {
      if (request.method === "POST" && url.pathname === "/operator/local-subscription") {
        return Response.json(await activateLocalSubscription(env.DB, await request.json()));
      }
      if (request.method === "GET" && url.pathname === "/operator/phase2-state") {
        return Response.json(await phase2State(env.DB));
      }
      const revocation = url.pathname.match(/^\/operator\/sessions\/([^/]+)\/revoke$/u);
      if (request.method === "POST" && revocation) {
        return Response.json(await revokeAppSession(env.DB, revocation[1]!));
      }
      const appStatus = url.pathname.match(/^\/operator\/apps\/([^/]+)\/status$/u);
      if (request.method === "POST" && appStatus) {
        const body = await request.json() as { status?: unknown };
        if (body.status !== "approved" && body.status !== "suspended") {
          throw new AppPassRequestError("status is invalid");
        }
        return Response.json(await setAppStatus(env.DB, appStatus[1]!, body.status));
      }
      const approval = url.pathname.match(/^\/operator\/link-requests\/([^/]+)\/approve$/u);
      if (request.method === "POST" && approval) {
        const body = await request.json() as { subscriberId?: unknown };
        if (typeof body.subscriberId !== "string") throw new AppPassRequestError("subscriberId is invalid");
        return Response.json(await approveLinkRequest(env.DB, approval[1]!, body.subscriberId));
      }
      const expiry = url.pathname.match(/^\/operator\/link-requests\/([^/]+)\/expire$/u);
      if (request.method === "POST" && expiry) {
        return Response.json(await expireLinkRequest(env.DB, expiry[1]!));
      }
      if (request.method === "POST" && url.pathname === "/app-pass/link-requests") {
        return Response.json(await createLinkRequest(env.DB, await request.json()));
      }
      const exchange = url.pathname.match(/^\/app-pass\/link-requests\/([^/]+)\/exchange$/u);
      if (request.method === "POST" && exchange) {
        return Response.json(await exchangeLinkRequest(env.DB, exchange[1]!, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/app-pass/entitlements/check") {
        const authorization = request.headers.get("authorization");
        const appId = request.headers.get("x-app-id");
        const runtimeId = request.headers.get("x-runtime-id");
        if (!authorization?.startsWith("Bearer ") || !appId || !runtimeId) {
          return Response.json({ error: "Invalid App session" }, { status: 401 });
        }
        const entitlement = await checkEntitlement(env.DB, authorization.slice(7), appId, runtimeId);
        return entitlement
          ? Response.json(entitlement)
          : Response.json({ error: "Invalid App session" }, { status: 401 });
      }
    } catch (error) {
      if (error instanceof AppPassRequestError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
