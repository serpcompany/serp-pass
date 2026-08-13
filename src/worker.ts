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
        .translation { display: block; margin-top: 6px; color: #4051d8; font-size: 12px; font-weight: 750; }
        .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; align-items: stretch; }
        .flow div { position: relative; padding: 16px; border-radius: 14px; color: #fff; background: #172033; font-weight: 750; }
        .flow span { display: block; margin-bottom: 5px; color: #9eabc2; font-size: 11px; font-weight: 700; }
        .concrete { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .lane { padding: 22px; border: 1px solid #e0e5ef; border-radius: 20px; background: rgba(255,255,255,.94); box-shadow: 0 12px 32px rgba(31,42,68,.06); }
        .lane h3 { margin: 0 0 6px; font-size: 19px; }
        .lane > p { margin: 0; color: #68748a; }
        .file { margin-top: 18px; padding: 15px; border: 1px solid #dae0ec; border-radius: 14px; background: #f8f9fc; }
        .file-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: #5f6c83; font-size: 11px; font-weight: 800; }
        .file-label span { padding: 3px 7px; border-radius: 999px; color: #4051d8; background: #e9ecff; }
        pre { margin: 0; overflow-x: auto; color: #dce4f3; background: #172033; padding: 14px; border-radius: 11px; font: 11px/1.55 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; }
        .callout { margin-top: 12px; padding: 12px 14px; border-left: 4px solid #4051d8; border-radius: 4px 12px 12px 4px; color: #4f5b72; background: #eef0ff; font-size: 13px; }
        .glossary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .term { padding: 16px; border: 1px solid #e0e5ef; border-radius: 15px; background: rgba(255,255,255,.9); }
        .term dt { font-weight: 850; }
        .term dd { margin: 5px 0 0; color: #68748a; font-size: 13px; }
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
        @media (max-width: 760px) { main { padding-top: 32px; } .actors, .apps, .flow, .proof, .concrete, .glossary { grid-template-columns: 1fr; } h1 { font-size: 42px; } }
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
          <article class="actor"><span class="number">1</span><h3>Third-party developer</h3><p>This represents someone else who wants their extension included.</p><ol><li>Receive two public labels from SERP: one identifies their company and one identifies this extension.<span class="translation">Think: account number + product number. They are identifiers, not passwords.</span></li><li>Add the SDK code to their extension and put the assigned App ID in its configuration.<span class="translation">Yes: they rebuild the extension so the SDK becomes part of its JavaScript bundle.</span></li><li>Create and send SERP a small <code>apppass.json</code> submission file.<span class="translation">The JSON is a registration form. It does not have to ship inside the extension.</span></li></ol></article>
          <article class="actor"><span class="number">2</span><h3>SERP Operator (you)</h3><p>You own the authority, database, subscription rules, and approval boundary.</p><ol><li>Run one import command against the submitted JSON.<span class="translation">“Validate” means reject it if fields are missing, IDs are malformed, or another App already owns that Chrome runtime ID.</span></li><li>Save three connected D1 records: the developer, their App, and its Chrome identity.<span class="translation">“Register” just means writing approved rows to your database.</span></li><li>Answer the extension’s access checks.<span class="translation">Your server combines App approval + the customer’s subscription status into active or inactive.</span></li></ol></article>
          <article class="actor"><span class="number">3</span><h3>Subscriber</h3><p>This represents the customer paying once for access to the bundle.</p><ol><li>Install any participating extension.<span class="translation">Each extension remains a separate product from its own developer.</span></li><li>Connect that installation to their Apps Pass account.<span class="translation">The extension receives its own revocable session—never your Stripe or platform secret.</span></li><li>Use premium features while the shared Subscription is valid.<span class="translation">One subscription can make several participating Apps active.</span></li></ol></article>
        </section>

        <h2>The standardized path</h2>
        <section class="flow"><div><span>Developer</span>Submit manifest</div><div><span>SERP</span>Validate + register</div><div><span>Subscriber</span>Link installation</div><div><span>Authority</span>Return active access</div></section>

        <h2>What the developer actually changes and sends</h2>
        <section class="concrete">
          <article class="lane">
            <h3>Inside the extension</h3>
            <p>The developer installs your SDK package, configures it with the public App ID, and rebuilds their normal extension bundle.</p>
            <div class="file"><div class="file-label">extension source <span>ships to users</span></div><pre>import { createAppPass } from "@serp-apps-pass/sdk";

const access = createAppPass({
  appId: "app_example_video_downloader",
  runtimeId: chrome.runtime.id,
  authorityBaseUrl: "https://pass.serp.co"
});

const result = await access.check();
if (result.status === "active") {
  enablePremiumFeatures();
}</pre></div>
            <p class="callout"><strong>The SDK</strong> is reusable JavaScript supplied by SERP. It knows how to link an installation, store its App-scoped session, and ask your authority whether access is active.</p>
          </article>
          <article class="lane">
            <h3>Sent to SERP for registration</h3>
            <p>The developer also sends a small JSON file describing who owns the App and which public Chrome extension ID is allowed to represent it.</p>
            <div class="file"><div class="file-label">apppass.json <span>submission form</span></div><pre>{
  "$schema": "https://pass.serp.co/schema/app-manifest-v1.json",
  "schema_version": 1,
  "publisher_id": "pub_example_dev",
  "publisher_name": "Example Developer",
  "app_id": "app_example_video_downloader",
  "name": "Example Video Downloader",
  "features": ["premium"],
  "distributions": [{
    "browser_family": "chromium",
    "channel": "chrome_web_store",
    "runtime_id": "abcdefghijklmnopabcdefghijklmnop"
  }]
}</pre></div>
            <p class="callout">SERP runs <code>pnpm operator:import-app path/to/apppass.json</code>. The importer reads the file, checks it, and writes the approved registration to D1. It does not run the developer’s code.</p>
          </article>
        </section>

        <h2>Plain-English glossary</h2>
        <dl class="glossary">
          <div class="term"><dt>Publisher ID</dt><dd>Your public database label for the developer or company that owns Apps.</dd></div>
          <div class="term"><dt>App ID</dt><dd>Your public database label for one product inside Apps Pass.</dd></div>
          <div class="term"><dt>Chrome runtime ID</dt><dd>Chrome’s public identity for the installed extension. SERP allowlists it so another extension cannot pretend to be this App.</dd></div>
          <div class="term"><dt>SDK</dt><dd>A reusable JavaScript package the developer bundles into their extension instead of rebuilding linking and access-check logic.</dd></div>
          <div class="term"><dt>Manifest</dt><dd>Here, <code>apppass.json</code>: a structured submission form describing the Publisher, App, features, and allowed Chrome identity.</dd></div>
          <div class="term"><dt>Register in D1</dt><dd>Save approved Publisher, App, and Distribution rows in the Cloudflare database so the authority recognizes them.</dd></div>
          <div class="term"><dt>Validate</dt><dd>Check the whole submission before saving anything: correct version, required fields, valid formats, and no ownership conflicts.</dd></div>
          <div class="term"><dt>Entitlement</dt><dd>The authority’s answer to “May this specific App installation use these paid features right now?”</dd></div>
          <div class="term"><dt>App session</dt><dd>A revocable credential for one linked extension installation. It is not the subscriber’s password and is stored hashed on your server.</dd></div>
        </dl>

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
