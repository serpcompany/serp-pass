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

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

async function walkthrough(env: Env) {
  const current = await state(env);
  const appCards = current.apps.map((app) => {
    const publisher = current.publishers.find((candidate) => candidate.id === app.publisherId);
    const distribution = current.distributions.find((candidate) => candidate.appId === app.id);
    return `
      <article class="app-card">
        <div><span class="status">${escapeHtml(app.status)}</span><span class="kind">Publisher extension</span></div>
        <h3>${escapeHtml(app.name)}</h3>
        <p>Published by <strong>${escapeHtml(publisher?.name ?? app.publisherId)}</strong></p>
        <code>${escapeHtml(distribution?.runtimeId ?? "No runtime registered")}</code>
      </article>`;
  }).join("");

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SERP Apps Pass · Prototype walkthrough</title>
      <style>
        :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f5f7fb; }
        * { box-sizing: border-box; }
        body { margin: 0; background: radial-gradient(circle at 88% 0%, #e3e6ff 0, transparent 30%), #f5f7fb; }
        main { width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 72px; }
        .eyebrow, .status, .kind { display: inline-flex; border-radius: 999px; font-weight: 800; }
        .eyebrow { padding: 6px 11px; color: #4051d8; background: #e9ecff; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
        h1 { max-width: 780px; margin: 18px 0 12px; font-size: clamp(36px, 6vw, 68px); line-height: .98; letter-spacing: -.055em; }
        .intro { max-width: 720px; margin: 0; color: #5d687d; font-size: 18px; }
        .note { margin-top: 24px; padding: 14px 16px; border: 1px solid #d9def0; border-radius: 14px; background: rgba(255,255,255,.76); color: #48536a; }
        h2 { margin: 48px 0 16px; font-size: 25px; letter-spacing: -.03em; }
        .actors { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .actor, .app-card, .proof { border: 1px solid #e0e5ef; border-radius: 20px; background: rgba(255,255,255,.94); box-shadow: 0 12px 32px rgba(31,42,68,.06); }
        .actor { padding: 22px; }
        .number { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 11px; color: #fff; background: #4051d8; font-weight: 900; }
        .actor h3 { margin: 16px 0 6px; font-size: 18px; }
        .actor > p, .app-card p { margin: 0; color: #6c778c; }
        ol { margin: 16px 0 0; padding-left: 20px; color: #465269; }
        li + li { margin-top: 8px; }
        .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; align-items: stretch; }
        .flow div { position: relative; padding: 16px; border-radius: 14px; color: #fff; background: #172033; font-weight: 750; }
        .flow span { display: block; margin-bottom: 5px; color: #9eabc2; font-size: 11px; font-weight: 700; }
        .apps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .app-card { padding: 18px; }
        .app-card h3 { margin: 13px 0 4px; font-size: 16px; }
        .app-card code { display: block; margin-top: 14px; overflow-wrap: anywhere; color: #66728a; font-size: 10px; }
        .status { padding: 4px 8px; color: #19764f; background: #ddf7e9; font-size: 10px; text-transform: uppercase; }
        .kind { margin-left: 6px; padding: 4px 8px; color: #56627a; background: #edf0f5; font-size: 10px; }
        .proof { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px; padding: 24px; }
        .proof h2 { margin: 0 0 8px; }
        .proof p { margin: 0; color: #626e83; }
        .proof strong { color: #172033; }
        @media (max-width: 760px) { main { padding-top: 32px; } .actors, .apps, .flow, .proof { grid-template-columns: 1fr; } h1 { font-size: 42px; } }
      </style>
    </head>
    <body>
      <main>
        <span class="eyebrow">Disposable local prototype</span>
        <h1>How an extension joins SERP Apps Pass</h1>
        <p class="intro">One subscription can unlock multiple independently published extensions. This page explains who does what and shows the Apps currently registered in local D1.</p>
        <p class="note"><strong>This is the SERP-owned authority.</strong> It validates developer submissions, stores App registrations, links Subscribers, and answers entitlement checks. The extension popup is the Publisher-owned side of the integration.</p>

        <h2>The three participants</h2>
        <section class="actors">
          <article class="actor"><span class="number">1</span><h3>Third-party developer</h3><p>This represents someone else who wants their extension included.</p><ol><li>Receive public Publisher and App IDs from SERP.</li><li>Add the shared SDK and an <code>apppass.json</code> manifest.</li><li>Submit the manifest for Operator import.</li></ol></article>
          <article class="actor"><span class="number">2</span><h3>SERP Operator (you)</h3><p>You own the authority, database, subscription rules, and approval boundary.</p><ol><li>Validate and import the submitted manifest.</li><li>Register its Publisher, App, and runtime ID in D1.</li><li>Approve links and return entitlement decisions.</li></ol></article>
          <article class="actor"><span class="number">3</span><h3>Subscriber</h3><p>This represents the customer paying once for access to the bundle.</p><ol><li>Install any participating extension.</li><li>Link that extension to their Apps Pass identity.</li><li>Receive active access while the shared Subscription is valid.</li></ol></article>
        </section>

        <h2>The standardized path</h2>
        <section class="flow"><div><span>Developer</span>Submit manifest</div><div><span>SERP</span>Validate + register</div><div><span>Subscriber</span>Link installation</div><div><span>Authority</span>Return active access</div></section>

        <h2>Live registered examples</h2>
        <section class="apps">${appCards || '<p>No Apps are registered in local D1 yet.</p>'}</section>

        <section class="proof"><div><h2>What this proves</h2><p>A previously unknown compatible extension can be included using only the standard manifest, importer, and SDK—without adding extension-specific authority code.</p></div><div><h2>What comes later</h2><p><strong>Not shown here:</strong> Stripe, production authentication, a marketplace catalog, Publisher self-service, payouts, deployment, or production hardening.</p></div></section>
      </main>
    </body>
  </html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return walkthrough(env);
    }
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
