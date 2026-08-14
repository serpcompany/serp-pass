import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentityFromHeaders } from "@/auth/identity";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const identity = await getHumanIdentityFromHeaders(request.headers);
  if (!identity) return Response.json({ message: "Sign-in required." }, { status: 401 });
  if (!identity.roles.includes("operator")) return Response.json({ message: "Operator role required." }, { status: 403 });

  const { env } = getCloudflareContext();
  const { submissionId } = await context.params;
  const record = await env.DB.prepare("SELECT object_key, original_filename, sha256 FROM app_submission_package WHERE submission_id = ?")
    .bind(submissionId).first<{ object_key: string; original_filename: string; sha256: string }>();
  if (!record) return Response.json({ message: "Review Package not found." }, { status: 404 });
  const object = await env.REVIEW_PACKAGES.get(record.object_key);
  if (!object) return Response.json({ message: "Review Package storage is inconsistent." }, { status: 503 });

  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${record.original_filename}"`,
      "x-review-package-sha256": record.sha256,
      "etag": object.httpEtag,
      "x-content-type-options": "nosniff",
    },
  });
}
