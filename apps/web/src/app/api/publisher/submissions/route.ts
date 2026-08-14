import { ManifestValidationError, validatedManifest } from "@serp-apps-pass/contracts";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { getDb } from "@/db/get-db";
import { appAssignments, publisherMemberships, publishers } from "@/db/schema";
import { logEvent } from "@/observability/log";

export const dynamic = "force-dynamic";

type DeclarationBody = { manifest?: unknown; storeVersion?: unknown };

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("publisher")) return Response.json({ message: "Publisher role required." }, { status: 403 });

  const body = await request.json().catch(() => null) as DeclarationBody | null;
  let manifest;
  try {
    manifest = validatedManifest(body?.manifest);
  } catch (error) {
    const message = error instanceof ManifestValidationError ? error.message : "Invalid App manifest.";
    return Response.json({ message }, { status: 400 });
  }
  const storeVersion = typeof body?.storeVersion === "string" ? body.storeVersion.trim() : "";
  if (storeVersion.length < 1 || storeVersion.length > 64) {
    return Response.json({ message: "Published extension version must be between 1 and 64 characters." }, { status: 400 });
  }

  const assignment = await getDb()
    .select({ appId: appAssignments.appId, publisherId: publishers.id, publisherName: publishers.name, status: appAssignments.status })
    .from(appAssignments)
    .innerJoin(publishers, eq(publishers.id, appAssignments.publisherId))
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publishers.id))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(appAssignments.appId, manifest.app_id)))
    .get();

  if (!assignment || assignment.status !== "assigned" || assignment.publisherId !== manifest.publisher_id || assignment.publisherName !== manifest.publisher_name) {
    return Response.json({ message: "Manifest identities do not match an available Apps Pass-generated App Assignment." }, { status: 409 });
  }

  const submissionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const canonicalManifest = JSON.stringify(manifest);
  const statements = [
    env.DB.prepare(`INSERT INTO app_submission
      (id, app_id, publisher_id, schema_version, manifest_json, store_version, ownership_evidence, status, submitted_by_user_id, submitted_at)
      SELECT ?, assignment.app_id, assignment.publisher_id, ?, ?, ?, 'covered_by_product_acceptance', 'pending', ?, ?
      FROM app_assignment assignment
      JOIN publisher_membership membership ON membership.publisher_id = assignment.publisher_id
      WHERE assignment.app_id = ? AND assignment.publisher_id = ? AND assignment.status = 'assigned' AND membership.user_id = ?`)
      .bind(submissionId, manifest.schema_version, canonicalManifest, storeVersion, identity.session.user.id, now, manifest.app_id, manifest.publisher_id, identity.session.user.id),
  ];
  for (const distribution of manifest.distributions) {
    statements.push(env.DB.prepare(`INSERT INTO submission_distribution_claim
      (submission_id, browser_family, channel, runtime_id)
      SELECT id, ?, ?, ? FROM app_submission WHERE id = ?`)
      .bind(distribution.browser_family, distribution.channel, distribution.runtime_id, submissionId));
  }
  statements.push(
    env.DB.prepare("UPDATE app_assignment SET status = 'submitted' WHERE app_id = ? AND status = 'assigned' AND EXISTS (SELECT 1 FROM app_submission WHERE id = ?)")
      .bind(manifest.app_id, submissionId),
    env.DB.prepare(`INSERT INTO operator_audit_event
      (id, actor_user_id, action, target_type, target_id, occurred_at, reason)
      SELECT ?, ?, 'integration_declaration_registered', 'app_submission', id, ?, 'publisher_registered_manifest_and_runtime'
      FROM app_submission WHERE id = ?`)
      .bind(auditId, identity.session.user.id, now, submissionId),
  );

  try {
    const results = await env.DB.batch(statements);
    if ((results[0].meta.changes ?? 0) !== 1) {
      return Response.json({ message: "App Assignment is no longer available for registration." }, { status: 409 });
    }
  } catch {
    return Response.json({ message: "App or Distribution conflicts with an existing Integration Declaration." }, { status: 409 });
  }

  logEvent("info", { event: "integration_declaration_registered", correlationId, environment: env.APP_ENV, outcome: "disconnected", submissionId, appId: manifest.app_id });
  return Response.json({ submissionId, status: "disconnected" }, { status: 201 });
}
