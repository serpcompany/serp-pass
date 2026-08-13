import { validatedManifest } from "@serp-apps-pass/contracts";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

type ReviewBody = { decision?: unknown; reason?: unknown };

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });

  const { submissionId } = await context.params;
  const body = (await request.json().catch(() => null)) as ReviewBody | null;
  const decision = body?.decision === "approve" || body?.decision === "reject" ? body.decision : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!decision || reason.length < 10 || reason.length > 1000) {
    return Response.json({ message: "A valid decision and review reason of 10–1000 characters are required." }, { status: 400 });
  }

  const submission = await env.DB.prepare("SELECT id, app_id, publisher_id, manifest_json FROM app_submission WHERE id = ? AND status = 'pending'")
    .bind(submissionId).first<{ id: string; app_id: string; publisher_id: string; manifest_json: string }>();
  if (!submission) return Response.json({ message: "Pending Submission not found." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const auditId = crypto.randomUUID();
  if (decision === "reject") {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE app_submission SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = ?, review_reason = ? WHERE id = ? AND status = 'pending'")
        .bind(identity.session.user.id, now, reason, submissionId),
      env.DB.prepare("DELETE FROM submission_distribution_claim WHERE submission_id = ?").bind(submissionId),
      env.DB.prepare("UPDATE app_assignment SET status = 'assigned' WHERE app_id = ? AND status = 'submitted'").bind(submission.app_id),
      env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'app_submission_rejected', 'app_submission', ?, ?, ?)")
        .bind(auditId, identity.session.user.id, submissionId, now, reason),
    ]);
    if ((results[0].meta.changes ?? 0) !== 1) return Response.json({ message: "Submission review conflicted with another decision." }, { status: 409 });
  } else {
    const manifest = validatedManifest(JSON.parse(submission.manifest_json));
    const statements = [
      env.DB.prepare("INSERT INTO app (id, publisher_id, approved_submission_id, name, features_json, status, approved_at) SELECT app_id, publisher_id, id, ?, ?, 'approved', ? FROM app_submission WHERE id = ? AND status = 'pending'")
        .bind(manifest.name, JSON.stringify(manifest.features), now, submissionId),
    ];
    for (const distribution of manifest.distributions) {
      statements.push(env.DB.prepare("INSERT INTO app_distribution (app_id, browser_family, channel, runtime_id, status, approved_at) VALUES (?, ?, ?, ?, 'approved', ?)")
        .bind(manifest.app_id, distribution.browser_family, distribution.channel, distribution.runtime_id, now));
    }
    statements.push(
      env.DB.prepare("UPDATE app_submission SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = ?, review_reason = ? WHERE id = ? AND status = 'pending'")
        .bind(identity.session.user.id, now, reason, submissionId),
      env.DB.prepare("UPDATE app_assignment SET status = 'approved' WHERE app_id = ? AND status = 'submitted'").bind(submission.app_id),
      env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) VALUES (?, ?, 'app_submission_approved', 'app_submission', ?, ?, ?)")
        .bind(auditId, identity.session.user.id, submissionId, now, reason),
    );
    try {
      const results = await env.DB.batch(statements);
      const reviewIndex = 1 + manifest.distributions.length;
      if ((results[reviewIndex].meta.changes ?? 0) !== 1) return Response.json({ message: "Submission review conflicted with another decision." }, { status: 409 });
    } catch {
      return Response.json({ message: "Approved App or Distribution conflicts with existing authority state." }, { status: 409 });
    }
  }

  logEvent("info", { event: "app_submission_reviewed", correlationId, environment: env.APP_ENV, outcome: decision === "approve" ? "approved" : "rejected", submissionId });
  return Response.json({ submissionId, status: decision === "approve" ? "approved" : "rejected" });
}
