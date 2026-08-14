import { getCloudflareContext } from "@opennextjs/cloudflare";

import { hasSameOrigin } from "@/auth/request";
import { sha256Hex } from "@/entitlements/crypto";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

function validHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function submitPublisherApplication(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });

  const now = Math.floor(Date.now() / 1000);
  const source = request.headers.get("cf-connecting-ip") ?? "local-or-unknown";
  const sourceHash = (await sha256Hex(source)).slice(0, 32);
  const windowSeconds = 60 * 60;
  const limitKey = `publisher-application:${sourceHash}:${Math.floor(now / windowSeconds)}`;
  await env.DB.prepare(`INSERT INTO rate_limit (id, key, count, last_request) VALUES (?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET count = rate_limit.count + 1, last_request = excluded.last_request`)
    .bind(limitKey, limitKey, now).run();
  const limit = await env.DB.prepare("SELECT count FROM rate_limit WHERE id = ?").bind(limitKey).first<{ count: number }>();
  if (!limit || limit.count > 5) {
    return Response.json({ message: "Too many Applications. Try again later." }, { status: 429, headers: { "retry-after": String(windowSeconds - (now % windowSeconds)) } });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const publisherName = typeof body?.publisherName === "string" ? body.publisherName.trim() : "";
  const appName = typeof body?.appName === "string" ? body.appName.trim() : "";
  const publicListingUrl = typeof body?.publicListingUrl === "string" ? body.publicListingUrl.trim() : "";
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const productDescription = typeof body?.productDescription === "string" ? body.productDescription.trim() : "";
  const permissionsAndPrivacy = typeof body?.permissionsAndPrivacy === "string" ? body.permissionsAndPrivacy.trim() : "";
  const ownershipAttested = body?.ownershipAttested === true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return Response.json({ message: "A valid contact email is required." }, { status: 400 });
  if (publisherName.length < 2 || publisherName.length > 100) return Response.json({ message: "Publisher name must be between 2 and 100 characters." }, { status: 400 });
  if (appName.length < 2 || appName.length > 100) return Response.json({ message: "App name must be between 2 and 100 characters." }, { status: 400 });
  if (!validHttpsUrl(publicListingUrl)) return Response.json({ message: "A public HTTPS extension listing URL is required." }, { status: 400 });
  if (sourceUrl && !validHttpsUrl(sourceUrl)) return Response.json({ message: "Source URL must be HTTPS when supplied." }, { status: 400 });
  if (productDescription.length < 40 || productDescription.length > 2_000) return Response.json({ message: "Product description must be between 40 and 2000 characters." }, { status: 400 });
  if (permissionsAndPrivacy.length < 40 || permissionsAndPrivacy.length > 2_000) return Response.json({ message: "Permissions and privacy explanation must be between 40 and 2000 characters." }, { status: 400 });
  if (!ownershipAttested) return Response.json({ message: "You must attest that you may submit this extension." }, { status: 400 });

  const duplicate = await env.DB.prepare("SELECT id FROM publisher_application WHERE email = ? AND public_listing_url = ? AND status = 'pending'")
    .bind(email, publicListingUrl).first();
  if (duplicate) return Response.json({ message: "This extension already has a pending Application." }, { status: 409 });

  const applicationId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO publisher_application
    (id, email, publisher_name, app_name, public_listing_url, source_url, product_description, permissions_and_privacy, ownership_attested, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?)`)
    .bind(applicationId, email, publisherName, appName, publicListingUrl, sourceUrl || null, productDescription, permissionsAndPrivacy, now).run();

  logEvent("info", { event: "publisher_application_created", correlationId, environment: env.APP_ENV, outcome: "pending", applicationId });
  return Response.json({ applicationId, status: "pending" }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await submitPublisherApplication(request);
  } catch (error) {
    console.error({ event: "publisher_application_failed", errorType: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "unknown" });
    return Response.json({ message: "Publisher Application is temporarily unavailable." }, { status: 503 });
  }
}
