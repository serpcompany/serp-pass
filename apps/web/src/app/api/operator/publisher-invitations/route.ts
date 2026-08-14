import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { generateAppId, generatePublisherId } from "@/apps/public-id";
import { generateInvitationToken, hashInvitationToken } from "@/invitations/token";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });

  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const publisherName = typeof body?.publisherName === "string" ? body.publisherName.trim() : "";
  const appName = typeof body?.appName === "string" ? body.appName.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ message: "A valid Publisher email is required." }, { status: 400 });
  }
  if (publisherName.length < 1 || publisherName.length > 100) {
    return Response.json({ message: "Publisher name must be between 1 and 100 characters." }, { status: 400 });
  }
  if (appName.length < 1 || appName.length > 100) {
    return Response.json({ message: "First App name must be between 1 and 100 characters." }, { status: 400 });
  }

  const invitationId = crypto.randomUUID();
  const suffix = crypto.randomUUID().slice(0, 8);
  const publisherBaseId = generatePublisherId(publisherName);
  const appBaseId = generateAppId(appName);
  const [publisherCollision, appCollision] = await Promise.all([
    env.DB.prepare("SELECT id FROM publisher WHERE id = ?").bind(publisherBaseId).first(),
    env.DB.prepare("SELECT app_id FROM app_assignment WHERE app_id = ?").bind(appBaseId).first(),
  ]);
  const publisherId = publisherCollision ? generatePublisherId(publisherName, suffix) : publisherBaseId;
  const appId = appCollision ? generateAppId(appName, suffix) : appBaseId;
  const auditId = crypto.randomUUID();
  const invitationCode = generateInvitationToken();
  const tokenHash = await hashInvitationToken(invitationCode);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 24 * 7;

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO publisher (id, name, status, created_at, created_by_user_id) VALUES (?, ?, 'invited', ?, ?)")
        .bind(publisherId, publisherName, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO app_assignment (app_id, publisher_id, status, assigned_at, assigned_by_user_id) VALUES (?, ?, 'assigned', ?, ?)")
        .bind(appId, publisherId, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO publisher_invitation (id, email, token_hash, status, expires_at, created_at, created_by_user_id) VALUES (?, ?, ?, 'pending', ?, ?, ?)")
        .bind(invitationId, email, tokenHash, expiresAt, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO publisher_invitation_assignment (invitation_id, publisher_id, app_id) VALUES (?, ?, ?)")
        .bind(invitationId, publisherId, appId),
      env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_invitation_created', 'publisher_invitation', ?, ?, 'private_pilot_invitation')")
        .bind(auditId, identity.session.user.id, invitationId, now),
    ]);
  } catch {
    return Response.json({ message: "The invitation conflicts with an existing Publisher assignment." }, { status: 409 });
  }

  logEvent("info", {
    event: "publisher_invitation_created",
    correlationId,
    environment: env.APP_ENV,
    outcome: "created",
    invitationId,
  });

  return Response.json({ publisherId, appId, invitationCode, expiresAt: new Date(expiresAt * 1000).toISOString() }, { headers: { "cache-control": "no-store" } });
}
