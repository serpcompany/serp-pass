import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
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

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ message: "A valid Publisher email is required." }, { status: 400 });
  }

  const invitationId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const invitationCode = generateInvitationToken();
  const tokenHash = await hashInvitationToken(invitationCode);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 24 * 7;

  await env.DB.batch([
    env.DB.prepare("INSERT INTO publisher_invitation (id, email, token_hash, status, expires_at, created_at, created_by_user_id) VALUES (?, ?, ?, 'pending', ?, ?, ?)")
      .bind(invitationId, email, tokenHash, expiresAt, now, identity.session.user.id),
    env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'publisher_invitation_created', 'publisher_invitation', ?, ?, 'private_pilot_invitation')")
      .bind(auditId, identity.session.user.id, invitationId, now),
  ]);

  logEvent("info", {
    event: "publisher_invitation_created",
    correlationId,
    environment: env.APP_ENV,
    outcome: "created",
    invitationId,
  });

  return Response.json({ invitationCode, expiresAt: new Date(expiresAt * 1000).toISOString() }, { headers: { "cache-control": "no-store" } });
}
