import { ManifestValidationError, validatedManifest } from "@serp-apps-pass/contracts";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";

import { getHumanIdentityFromHeaders } from "@/auth/identity";
import { hasSameOrigin } from "@/auth/request";
import { getDb } from "@/db/get-db";
import { appAssignments, publisherMemberships, publishers } from "@/db/schema";
import { logEvent } from "@/observability/log";
import { inspectReviewPackage, MAX_REVIEW_PACKAGE_BYTES, ReviewPackageError, sha256Hex } from "@/apps/review-package";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  const { env } = getCloudflareContext();
  if (!hasSameOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("publisher")) return Response.json({ message: "Publisher role required." }, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REVIEW_PACKAGE_BYTES + 100_000) {
    return Response.json({ message: "Submission is larger than the 10 MB Review Package limit." }, { status: 413 });
  }
  const body = await request.formData().catch(() => null);
  if (!body) return Response.json({ message: "Submission must use multipart form data." }, { status: 400 });
  let manifestInput: unknown;
  try {
    manifestInput = JSON.parse(String(body.get("manifest") ?? ""));
  } catch {
    return Response.json({ message: "App manifest must be valid JSON." }, { status: 400 });
  }
  let manifest;
  try {
    manifest = validatedManifest(manifestInput);
  } catch (error) {
    const message = error instanceof ManifestValidationError ? error.message : "Invalid App manifest.";
    return Response.json({ message }, { status: 400 });
  }
  const ownershipEvidence = String(body.get("ownershipEvidence") ?? "").trim();
  if (ownershipEvidence.length < 20 || ownershipEvidence.length > 2000) {
    return Response.json({ message: "Ownership evidence must be between 20 and 2000 characters." }, { status: 400 });
  }
  const packageValue = body.get("reviewPackage");
  if (!(packageValue instanceof File) || !packageValue.name.toLowerCase().endsWith(".zip")) {
    return Response.json({ message: "The exact installable extension Review Package is required as a .zip file." }, { status: 400 });
  }
  const packageBytes = new Uint8Array(await packageValue.arrayBuffer());
  const safePackageFilename = packageValue.name.replace(/[^a-zA-Z0-9._ -]/gu, "_").slice(0, 120) || "extension.zip";
  let packageInspection;
  try {
    packageInspection = inspectReviewPackage(packageBytes);
  } catch (error) {
    return Response.json({ message: error instanceof ReviewPackageError ? error.message : "Review Package could not be inspected." }, { status: 400 });
  }

  const assignment = await getDb()
    .select({ appId: appAssignments.appId, publisherId: publishers.id, publisherName: publishers.name, status: appAssignments.status })
    .from(appAssignments)
    .innerJoin(publishers, eq(publishers.id, appAssignments.publisherId))
    .innerJoin(publisherMemberships, eq(publisherMemberships.publisherId, publishers.id))
    .where(and(eq(publisherMemberships.userId, identity.session.user.id), eq(appAssignments.appId, manifest.app_id)))
    .get();

  if (!assignment || assignment.status !== "assigned" || assignment.publisherId !== manifest.publisher_id || assignment.publisherName !== manifest.publisher_name) {
    return Response.json({ message: "Manifest identities do not match an active Apps Pass-generated App Assignment." }, { status: 409 });
  }

  const submissionId = crypto.randomUUID();
  const objectKey = `${env.APP_ENV}/submissions/${submissionId}/extension.zip`;
  const packageSha256 = await sha256Hex(packageBytes);
  const auditId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const canonicalManifest = JSON.stringify(manifest);
  const storedObject = await env.REVIEW_PACKAGES.put(objectKey, packageBytes, {
    httpMetadata: { contentType: "application/zip", contentDisposition: `attachment; filename="${safePackageFilename}"` },
    customMetadata: { submissionId, appId: manifest.app_id },
    sha256: packageSha256,
  });
  if (!storedObject) return Response.json({ message: "Review Package could not be stored." }, { status: 503 });
  const statements = [
    env.DB.prepare("INSERT INTO app_submission (id, app_id, publisher_id, schema_version, manifest_json, ownership_evidence, status, submitted_by_user_id, submitted_at) SELECT ?, assignment.app_id, assignment.publisher_id, ?, ?, ?, 'pending', ?, ? FROM app_assignment assignment JOIN publisher_membership membership ON membership.publisher_id = assignment.publisher_id WHERE assignment.app_id = ? AND assignment.publisher_id = ? AND assignment.status = 'assigned' AND membership.user_id = ?")
      .bind(submissionId, manifest.schema_version, canonicalManifest, ownershipEvidence, identity.session.user.id, now, manifest.app_id, manifest.publisher_id, identity.session.user.id),
    env.DB.prepare(`INSERT INTO app_submission_package
      (submission_id, object_key, original_filename, media_type, size_bytes, sha256, object_etag, extension_manifest_json, inspection_json, uploaded_at)
      SELECT id, ?, ?, 'application/zip', ?, ?, ?, ?, ?, ? FROM app_submission WHERE id = ?`)
      .bind(objectKey, safePackageFilename, packageBytes.byteLength, packageSha256, storedObject.etag, JSON.stringify(packageInspection.manifest), JSON.stringify(packageInspection.inspection), now, submissionId),
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
      await env.REVIEW_PACKAGES.delete(objectKey);
      return Response.json({ message: "App Assignment is no longer available for submission." }, { status: 409 });
    }
  } catch {
    await env.REVIEW_PACKAGES.delete(objectKey);
    return Response.json({ message: "App or Distribution conflicts with an existing pending Submission." }, { status: 409 });
  }

  logEvent("info", { event: "app_submission_created", correlationId, environment: env.APP_ENV, outcome: "pending", submissionId, appId: manifest.app_id, packageBytes: packageBytes.byteLength });
  return Response.json({ submissionId, status: "pending", packageSha256, packageInspection: packageInspection.inspection }, { status: 201 });
}
