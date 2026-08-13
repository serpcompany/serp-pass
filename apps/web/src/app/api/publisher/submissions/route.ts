import { ManifestValidationError, validatedManifest } from "@serp-apps-pass/contracts";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { getDb } from "@/db/get-db";
import { appAssignments, publisherMemberships, publishers } from "@/db/schema";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("publisher")) return Response.json({ message: "Publisher role required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { manifest?: unknown; ownershipEvidence?: unknown } | null;
  let manifest;
  try {
    manifest = validatedManifest(body?.manifest);
  } catch (error) {
    const message = error instanceof ManifestValidationError ? error.message : "Invalid App manifest.";
    return Response.json({ message }, { status: 400 });
  }
  const ownershipEvidence = typeof body?.ownershipEvidence === "string" ? body.ownershipEvidence.trim() : "";
  if (ownershipEvidence.length < 20 || ownershipEvidence.length > 2000) {
    return Response.json({ message: "Ownership evidence must be between 20 and 2000 characters." }, { status: 400 });
  }

  const assignment = await getDb()
    .select({ appId: appAssignments.appId, publisherId: publishers.id, publisherName: publishers.name, status: appAssignments.status })
    .from(appAssignments)
    .innerJoin(publishers, eq(publishers.id, appAssignments.publisherId))
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publishers.id))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(appAssignments.appId, manifest.app_id)))
    .get();

  if (!assignment || assignment.status !== "assigned" || assignment.publisherId !== manifest.publisher_id || assignment.publisherName !== manifest.publisher_name) {
    return Response.json({ message: "Manifest identities do not match an active Operator-issued App Assignment." }, { status: 409 });
  }

  const submissionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const canonicalManifest = JSON.stringify(manifest);
  const statements = [
    env.DB.prepare("INSERT INTO app_submission (id, app_id, publisher_id, schema_version, manifest_json, ownership_evidence, status, submitted_by_user_id, submitted_at) SELECT ?, assignment.app_id, assignment.publisher_id, ?, ?, ?, 'pending', ?, ? FROM app_assignment assignment JOIN publisher_membership membership ON membership.publisher_id = assignment.publisher_id WHERE assignment.app_id = ? AND assignment.publisher_id = ? AND assignment.status = 'assigned' AND membership.user_id = ?")
      .bind(submissionId, manifest.schema_version, canonicalManifest, ownershipEvidence, identity.session.user.id, now, manifest.app_id, manifest.publisher_id, identity.session.user.id),
  ];
  for (const distribution of manifest.distributions) {
    statements.push(env.DB.prepare("INSERT INTO submission_distribution_claim (submission_id, browser_family, channel, runtime_id) SELECT id, ?, ?, ? FROM app_submission WHERE id = ?")
      .bind(distribution.browser_family, distribution.channel, distribution.runtime_id, submissionId));
  }
  statements.push(
    env.DB.prepare("UPDATE app_assignment SET status = 'submitted' WHERE app_id = ? AND status = 'assigned' AND EXISTS (SELECT 1 FROM app_submission WHERE id = ?)").bind(manifest.app_id, submissionId),
    env.DB.prepare("INSERT INTO operator_audit_event (id, actor_user_id, action, target_type, target_id, occurred_at, reason) SELECT ?, ?, 'app_submission_created', 'app_submission', id, ?, 'publisher_submitted_for_review' FROM app_submission WHERE id = ?")
      .bind(auditId, identity.session.user.id, now, submissionId),
  );

  try {
    const results = await env.DB.batch(statements);
    if ((results[0].meta.changes ?? 0) !== 1) {
      return Response.json({ message: "App Assignment is no longer available for submission." }, { status: 409 });
    }
  } catch {
    return Response.json({ message: "App or Distribution conflicts with an existing pending Submission." }, { status: 409 });
  }

  logEvent("info", { event: "app_submission_created", correlationId, environment: env.APP_ENV, outcome: "pending", submissionId, appId: manifest.app_id });
  return Response.json({ submissionId, status: "pending" }, { status: 201 });
}
