import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { hashInvitationToken } from "@/invitations/token";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });

  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { invitationCode?: unknown } | null;
  const invitationCode = typeof body?.invitationCode === "string" ? body.invitationCode.trim() : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(invitationCode)) {
    return Response.json({ message: "Invitation is invalid, expired, already used, or assigned to another email." }, { status: 400 });
  }

  const tokenHash = await hashInvitationToken(invitationCode);
  const auditId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const normalizedEmail = identity.session.user.email.trim().toLowerCase();

  const results = await env.DB.batch([
    env.DB.prepare("INSERT INTO human_role_assignment (user_id, role, source, granted_at, granted_by_user_id) SELECT ?, 'publisher', 'invitation', ?, created_by_user_id FROM publisher_invitation WHERE token_hash = ? AND status = 'pending' AND expires_at > ? AND email = ? ON CONFLICT(user_id, role) DO NOTHING")
      .bind(identity.session.user.id, now, tokenHash, now, normalizedEmail),
    env.DB.prepare("INSERT INTO publisher_membership (publisher_id, user_id, created_at) SELECT assignment.publisher_id, ?, ? FROM publisher_invitation invitation JOIN publisher_invitation_assignment assignment ON assignment.invitation_id = invitation.id WHERE invitation.token_hash = ? AND invitation.status = 'pending' AND invitation.expires_at > ? AND invitation.email = ? ON CONFLICT(publisher_id, user_id) DO NOTHING")
      .bind(identity.session.user.id, now, tokenHash, now, normalizedEmail),
    env.DB.prepare("UPDATE publisher SET status = 'active' WHERE id = (SELECT assignment.publisher_id FROM publisher_invitation invitation JOIN publisher_invitation_assignment assignment ON assignment.invitation_id = invitation.id WHERE invitation.token_hash = ? AND invitation.status = 'pending' AND invitation.expires_at > ? AND invitation.email = ?)")
      .bind(tokenHash, now, normalizedEmail),
    env.DB.prepare("UPDATE publisher_invitation SET status = 'accepted', accepted_at = ?, accepted_by_user_id = ?, acceptance_audit_event_id = ? WHERE token_hash = ? AND status = 'pending' AND expires_at > ? AND email = ?")
      .bind(now, identity.session.user.id, auditId, tokenHash, now, normalizedEmail),
    env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT ?, ?, 'publisher_invitation_accepted', 'publisher_invitation', id, ?, 'invited_publisher_accepted' FROM publisher_invitation WHERE acceptance_audit_event_id = ?")
      .bind(auditId, identity.session.user.id, now, auditId),
  ]);

  const accepted = (results[3].meta.changes ?? 0) === 1;
  logEvent(accepted ? "info" : "warn", {
    event: "publisher_invitation_acceptance",
    correlationId,
    environment: env.APP_ENV,
    outcome: accepted ? "accepted" : "rejected",
    userId: identity.session.user.id,
  });

  if (!accepted) {
    return Response.json({ message: "Invitation is invalid, expired, already used, or assigned to another email." }, { status: 409 });
  }
  return Response.json({ accepted: true });
}
