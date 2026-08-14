import { validatedManifest } from "@serp-apps-pass/contracts";

const APP_ID = /^app_[a-z0-9][a-z0-9_]{2,59}$/;

export class AppConnectionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "AppConnectionError";
  }
}

type ConnectionInput = { appId?: unknown; runtimeId?: unknown };

export async function verifyAppConnection(db: CloudflareEnv["DB"], input: unknown, extensionRuntimeId: string) {
  if (!input || typeof input !== "object") throw new AppConnectionError("Connection request is invalid.");
  const body = input as ConnectionInput;
  if (typeof body.appId !== "string" || !APP_ID.test(body.appId)) throw new AppConnectionError("App identity is invalid.");
  if (typeof body.runtimeId !== "string" || body.runtimeId !== extensionRuntimeId) {
    throw new AppConnectionError("Runtime origin does not match the declared Distribution.");
  }

  const declaration = await db.prepare(`SELECT submission.id, submission.manifest_json, claim.browser_family, claim.channel,
      assignment.status AS assignment_status, publisher.status AS publisher_status
    FROM app_submission submission
    JOIN submission_distribution_claim claim ON claim.submission_id = submission.id
    JOIN app_assignment assignment ON assignment.app_id = submission.app_id AND assignment.publisher_id = submission.publisher_id
    JOIN publisher ON publisher.id = submission.publisher_id
    WHERE submission.app_id = ? AND claim.browser_family = 'chromium' AND claim.runtime_id = ?
      AND submission.status IN ('pending', 'approved')
      AND assignment.status IN ('submitted', 'approved')
    ORDER BY submission.submitted_at DESC LIMIT 1`)
    .bind(body.appId, body.runtimeId)
    .first<{
      id: string;
      manifest_json: string;
      browser_family: "chromium";
      channel: "unpacked" | "chrome_web_store";
      assignment_status: "submitted" | "approved";
      publisher_status: "invited" | "active" | "suspended";
    }>();
  if (!declaration) throw new AppConnectionError("Registered App Distribution not found.", 404);
  if (declaration.publisher_status !== "active") throw new AppConnectionError("Publisher is not active.", 409);

  const manifest = validatedManifest(JSON.parse(declaration.manifest_json));
  const now = Math.floor(Date.now() / 1000);
  const auditId = `connection:${manifest.app_id}:${body.runtimeId}`;

  try {
    await db.batch([
      db.prepare(`INSERT INTO app_connection_verification
        (app_id, submission_id, browser_family, channel, runtime_id, first_connected_at, last_connected_at, connection_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(app_id, browser_family, runtime_id) DO UPDATE SET
          submission_id = excluded.submission_id,
          channel = excluded.channel,
          last_connected_at = excluded.last_connected_at,
          connection_count = app_connection_verification.connection_count + 1`)
        .bind(manifest.app_id, declaration.id, declaration.browser_family, declaration.channel, body.runtimeId, now, now),
      db.prepare(`INSERT INTO app (id, publisher_id, approved_submission_id, name, features_json, status, approved_at)
        SELECT app_id, publisher_id, id, ?, ?, 'approved', ? FROM app_submission WHERE id = ?
        ON CONFLICT(id) DO NOTHING`)
        .bind(manifest.name, JSON.stringify(manifest.features), now, declaration.id),
      db.prepare(`INSERT INTO app_distribution (app_id, browser_family, channel, runtime_id, status, approved_at)
        VALUES (?, ?, ?, ?, 'approved', ?)
        ON CONFLICT(app_id, channel, runtime_id) DO NOTHING`)
        .bind(manifest.app_id, declaration.browser_family, declaration.channel, body.runtimeId, now),
      db.prepare("UPDATE app_submission SET status = 'approved', reviewed_at = ?, review_reason = 'connection_verified' WHERE id = ? AND status = 'pending'")
        .bind(now, declaration.id),
      db.prepare("UPDATE app_assignment SET status = 'approved' WHERE app_id = ? AND status = 'submitted'")
        .bind(manifest.app_id),
      db.prepare(`INSERT OR IGNORE INTO operator_audit_event
        (id, actor_user_id, action, target_type, target_id, occurred_at, reason)
        VALUES (?, NULL, 'app_connection_verified', 'app', ?, ?, 'accepted_runtime_connected')`)
        .bind(auditId, manifest.app_id, now),
    ]);
  } catch {
    throw new AppConnectionError("App or runtime identity conflicts with existing authority state.", 409);
  }

  const connected = await db.prepare(`SELECT app.status AS app_status, distribution.status AS distribution_status,
      verification.first_connected_at, verification.last_connected_at, verification.connection_count
    FROM app_connection_verification verification
    JOIN app ON app.id = verification.app_id
    JOIN app_distribution distribution ON distribution.app_id = verification.app_id
      AND distribution.browser_family = verification.browser_family
      AND distribution.runtime_id = verification.runtime_id
    WHERE verification.app_id = ? AND verification.runtime_id = ?`)
    .bind(manifest.app_id, body.runtimeId)
    .first<{
      app_status: "approved" | "suspended";
      distribution_status: "approved" | "suspended";
      first_connected_at: number;
      last_connected_at: number;
      connection_count: number;
    }>();
  if (!connected) throw new AppConnectionError("Connection could not be recorded.", 409);

  return {
    appId: manifest.app_id,
    runtimeId: body.runtimeId,
    status: connected.app_status === "approved" && connected.distribution_status === "approved" ? "connected" as const : "suspended" as const,
    firstConnectedAt: new Date(connected.first_connected_at * 1000).toISOString(),
    lastConnectedAt: new Date(connected.last_connected_at * 1000).toISOString(),
    connectionCount: connected.connection_count,
  };
}
