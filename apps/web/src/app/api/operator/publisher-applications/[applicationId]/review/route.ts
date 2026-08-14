import { getCloudflareContext } from "@opennextjs/cloudflare";

import { generateAppId, generatePublisherId } from "@/apps/public-id";
import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { generateInvitationToken, hashInvitationToken } from "@/invitations/token";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });

  const { applicationId } = await context.params;
  const body = (await request.json().catch(() => null)) as { decision?: unknown; reason?: unknown } | null;
  const decision = body?.decision === "accept" || body?.decision === "reject" ? body.decision : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!decision || reason.length < 20 || reason.length > 1_000) {
    return Response.json({ message: "A valid decision and review reason of 20–1000 characters are required." }, { status: 400 });
  }

  const application = await env.DB.prepare(`SELECT id, email, publisher_name, app_name
    FROM publisher_application WHERE id = ? AND status = 'pending'`)
    .bind(applicationId).first<{ id: string; email: string; publisher_name: string; app_name: string }>();
  if (!application) return Response.json({ message: "Pending Publisher Application not found." }, { status: 404 });

  const now = Math.floor(Date.now() / 1_000);
  const auditId = crypto.randomUUID();
  if (decision === "reject") {
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO publisher_application_decision_guard (application_id, decided_at) VALUES (?, ?)").bind(applicationId, now),
        env.DB.prepare("UPDATE publisher_application SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = ?, review_reason = ? WHERE id = ? AND status = 'pending'")
          .bind(identity.session.user.id, now, reason, applicationId),
        env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_application_rejected', 'publisher_application', ?, ?, ?)")
          .bind(auditId, identity.session.user.id, applicationId, now, reason),
      ]);
    } catch {
      return Response.json({ message: "Application review conflicted with another decision." }, { status: 409 });
    }
    logEvent("info", { event: "publisher_application_reviewed", correlationId, environment: env.APP_ENV, outcome: "rejected", applicationId });
    return Response.json({ applicationId, status: "rejected" });
  }

  const suffix = crypto.randomUUID().slice(0, 8);
  const publisherBaseId = generatePublisherId(application.publisher_name);
  const appBaseId = generateAppId(application.app_name);
  const [publisherCollision, appCollision] = await Promise.all([
    env.DB.prepare("SELECT id FROM publisher WHERE id = ?").bind(publisherBaseId).first(),
    env.DB.prepare("SELECT app_id FROM app_assignment WHERE app_id = ?").bind(appBaseId).first(),
  ]);
  const publisherId = publisherCollision ? generatePublisherId(application.publisher_name, suffix) : publisherBaseId;
  const appId = appCollision ? generateAppId(application.app_name, suffix) : appBaseId;
  const invitationId = crypto.randomUUID();
  const invitationCode = generateInvitationToken();
  const tokenHash = await hashInvitationToken(invitationCode);
  const expiresAt = now + 60 * 60 * 24 * 7;

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO publisher_application_decision_guard (application_id, decided_at) VALUES (?, ?)").bind(applicationId, now),
      env.DB.prepare("INSERT INTO publisher (id, name, status, created_at, created_by_user_id) VALUES (?, ?, 'invited', ?, ?)")
        .bind(publisherId, application.publisher_name, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO app_assignment (app_id, publisher_id, status, assigned_at, assigned_by_user_id) VALUES (?, ?, 'assigned', ?, ?)")
        .bind(appId, publisherId, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO publisher_invitation (id, email, token_hash, status, expires_at, created_at, created_by_user_id) VALUES (?, ?, ?, 'pending', ?, ?, ?)")
        .bind(invitationId, application.email, tokenHash, expiresAt, now, identity.session.user.id),
      env.DB.prepare("INSERT INTO publisher_invitation_assignment (invitation_id, publisher_id, app_id) VALUES (?, ?, ?)")
        .bind(invitationId, publisherId, appId),
      env.DB.prepare("UPDATE publisher_application SET status = 'accepted', reviewed_by_user_id = ?, reviewed_at = ?, review_reason = ?, invitation_id = ?, publisher_id = ?, app_id = ? WHERE id = ? AND status = 'pending'")
        .bind(identity.session.user.id, now, reason, invitationId, publisherId, appId, applicationId),
      env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_application_accepted', 'publisher_application', ?, ?, ?)")
        .bind(auditId, identity.session.user.id, applicationId, now, reason),
    ]);
  } catch {
    return Response.json({ message: "Application acceptance conflicted with another decision or identity." }, { status: 409 });
  }

  logEvent("info", { event: "publisher_application_reviewed", correlationId, environment: env.APP_ENV, outcome: "accepted", applicationId, publisherId, appId });
  return Response.json({ applicationId, status: "accepted", publisherId, appId, invitationCode, expiresAt: new Date(expiresAt * 1_000).toISOString() }, { headers: { "cache-control": "no-store" } });
}
