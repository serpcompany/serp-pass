import type { Entitlement } from "@serp-apps-pass/contracts";

import { billingModeForEnvironment } from "@/billing/read";
import { randomOpaqueValue, sha256Base64Url, sha256Hex, timingSafeStringEqual } from "./crypto";

const APP_ID = /^app_[a-z0-9][a-z0-9_]{2,59}$/;
const RUNTIME_ID = /^[a-p]{32}$/;
const INSTALLATION_ID = /^installation_[A-Za-z0-9_-]{24}$/;
const PROOF_VALUE = /^[A-Za-z0-9_-]{43}$/;

export class EntitlementAuthorityError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "EntitlementAuthorityError";
  }
}

type LinkInput = {
  appId?: unknown;
  runtimeId?: unknown;
  installationId?: unknown;
  proofChallenge?: unknown;
};

function validatedLinkInput(input: unknown) {
  if (!input || typeof input !== "object") throw new EntitlementAuthorityError("Link request is invalid.");
  const body = input as LinkInput;
  if (typeof body.appId !== "string" || !APP_ID.test(body.appId)) throw new EntitlementAuthorityError("App identity is invalid.");
  if (typeof body.runtimeId !== "string" || !RUNTIME_ID.test(body.runtimeId)) throw new EntitlementAuthorityError("Runtime identity is invalid.");
  if (typeof body.installationId !== "string" || !INSTALLATION_ID.test(body.installationId)) throw new EntitlementAuthorityError("Installation identity is invalid.");
  if (typeof body.proofChallenge !== "string" || !PROOF_VALUE.test(body.proofChallenge)) throw new EntitlementAuthorityError("Proof challenge is invalid.");
  return body as Required<LinkInput>;
}

export async function createLinkRequest(db: CloudflareEnv["DB"], input: unknown, extensionRuntimeId: string, applicationOrigin: string) {
  const body = validatedLinkInput(input);
  if (body.runtimeId !== extensionRuntimeId) throw new EntitlementAuthorityError("Runtime origin does not match the claimed Distribution.");
  const approved = await db.prepare(`SELECT app.id
    FROM app JOIN app_distribution distribution ON distribution.app_id = app.id
    WHERE app.id = ? AND app.status = 'approved' AND distribution.runtime_id = ? AND distribution.status = 'approved'`)
    .bind(body.appId, body.runtimeId).first<{ id: string }>();
  if (!approved) throw new EntitlementAuthorityError("Approved App Distribution not found.", 404);

  const requestId = `linkreq_${randomOpaqueValue(18)}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 10 * 60;
  await db.prepare(`INSERT INTO app_link_request
    (id, app_id, runtime_id, installation_id, proof_challenge, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, 'requested', ?, ?)`)
    .bind(requestId, body.appId, body.runtimeId, body.installationId, body.proofChallenge, expiresAt, now).run();
  return {
    requestId,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    activationUrl: `${applicationOrigin}/activate/${encodeURIComponent(requestId)}`,
  };
}

export async function readActivation(db: CloudflareEnv["DB"], requestId: string) {
  const request = await db.prepare(`SELECT request.id, request.app_id, request.runtime_id, request.installation_id,
      request.status, request.subscriber_user_id, request.expires_at, request.decided_at, request.exchanged_at,
      app.name AS app_name, app.status AS app_status, publisher.name AS publisher_name,
      distribution.status AS distribution_status
    FROM app_link_request request
    JOIN app ON app.id = request.app_id
    JOIN publisher ON publisher.id = app.publisher_id
    LEFT JOIN app_distribution distribution ON distribution.app_id = request.app_id AND distribution.runtime_id = request.runtime_id
    WHERE request.id = ?`)
    .bind(requestId).first<{
      id: string; app_id: string; runtime_id: string; installation_id: string; status: "requested" | "approved" | "denied" | "exchanged";
      subscriber_user_id: string | null; expires_at: number; decided_at: number | null; exchanged_at: number | null;
      app_name: string; app_status: "approved" | "suspended"; publisher_name: string; distribution_status: "approved" | "suspended" | null;
    }>();
  if (!request) return null;
  const effectiveStatus = request.status === "requested" || request.status === "approved"
    ? request.expires_at <= Math.floor(Date.now() / 1000) ? "expired" as const : request.status
    : request.status;
  return { ...request, effectiveStatus };
}

export async function decideLinkRequest(db: CloudflareEnv["DB"], requestId: string, subscriberUserId: string, decision: "approve" | "deny") {
  const now = Math.floor(Date.now() / 1000);
  const status = decision === "approve" ? "approved" : "denied";
  const result = await db.prepare(`UPDATE app_link_request SET status = ?, subscriber_user_id = ?, decided_at = ?
    WHERE id = ? AND status = 'requested' AND expires_at > ?
      AND EXISTS (
        SELECT 1 FROM app JOIN app_distribution distribution ON distribution.app_id = app.id
        WHERE app.id = app_link_request.app_id AND app.status = 'approved'
          AND distribution.runtime_id = app_link_request.runtime_id AND distribution.status = 'approved'
      )`)
    .bind(status, subscriberUserId, now, requestId, now).run();
  if ((result.meta.changes ?? 0) !== 1) {
    const existing = await readActivation(db, requestId);
    if (!existing) throw new EntitlementAuthorityError("Link request not found.", 404);
    throw new EntitlementAuthorityError("Link request is expired, already decided, or no longer eligible.", 409);
  }
  return { requestId, status };
}

export async function exchangeLinkRequest(db: CloudflareEnv["DB"], requestId: string, proofKey: unknown, extensionRuntimeId: string) {
  if (typeof proofKey !== "string" || !PROOF_VALUE.test(proofKey)) throw new EntitlementAuthorityError("Proof key is invalid.");
  const request = await db.prepare(`SELECT id, app_id, runtime_id, installation_id, proof_challenge, subscriber_user_id, status, expires_at
    FROM app_link_request WHERE id = ?`)
    .bind(requestId).first<{
      id: string; app_id: string; runtime_id: string; installation_id: string; proof_challenge: string;
      subscriber_user_id: string | null; status: string; expires_at: number;
    }>();
  const now = Math.floor(Date.now() / 1000);
  if (!request) throw new EntitlementAuthorityError("Link request not found.", 404);
  if (request.runtime_id !== extensionRuntimeId) throw new EntitlementAuthorityError("Runtime origin does not match the Link Request.");
  if (request.status === "denied") throw new EntitlementAuthorityError("Link request was denied.", 409);
  if (request.status !== "approved" || !request.subscriber_user_id) throw new EntitlementAuthorityError("Link request is not approved.", 409);
  if (request.expires_at <= now) throw new EntitlementAuthorityError("Link request expired.", 409);
  if (!timingSafeStringEqual(await sha256Base64Url(proofKey), request.proof_challenge)) throw new EntitlementAuthorityError("Proof does not match.");

  const linkId = `link_${(await sha256Hex(`${request.app_id}:${request.subscriber_user_id}:${request.installation_id}`)).slice(0, 40)}`;
  const sessionId = `appsession_${randomOpaqueValue(18)}`;
  const token = `aps_${randomOpaqueValue(32)}`;
  const tokenHash = await sha256Hex(token);
  try {
    const results = await db.batch([
      db.prepare(`INSERT INTO app_link (id, app_id, subscriber_user_id, installation_id, created_at, last_linked_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(app_id, subscriber_user_id, installation_id) DO UPDATE SET last_linked_at = excluded.last_linked_at`)
        .bind(linkId, request.app_id, request.subscriber_user_id, request.installation_id, now, now),
      db.prepare(`INSERT INTO app_session (id, app_link_id, link_request_id, runtime_id, token_hash, created_at)
        SELECT ?, ?, id, runtime_id, ?, ? FROM app_link_request
        WHERE id = ? AND status = 'approved' AND expires_at > ?`)
        .bind(sessionId, linkId, tokenHash, now, requestId, now),
      db.prepare("UPDATE app_link_request SET status = 'exchanged', exchanged_at = ? WHERE id = ? AND status = 'approved' AND expires_at > ?")
        .bind(now, requestId, now),
    ]);
    if ((results[1].meta.changes ?? 0) !== 1 || (results[2].meta.changes ?? 0) !== 1) throw new Error("Link exchange did not claim exactly one request");
  } catch (error) {
    const latest = await db.prepare("SELECT status, expires_at FROM app_link_request WHERE id = ?")
      .bind(requestId).first<{ status: string; expires_at: number }>().catch(() => null);
    if (latest?.status === "exchanged" || (latest && latest.expires_at <= Math.floor(Date.now() / 1000))) {
      throw new EntitlementAuthorityError("Link request is expired or already exchanged.", 409);
    }
    throw error;
  }
  return { token };
}

export async function checkEntitlement(
  db: CloudflareEnv["DB"],
  environment: CloudflareEnv["APP_ENV"],
  token: string,
  claimedAppId: string,
  claimedRuntimeId: string,
): Promise<Entitlement | null> {
  if (!/^aps_[A-Za-z0-9_-]{43}$/.test(token) || !APP_ID.test(claimedAppId) || !RUNTIME_ID.test(claimedRuntimeId)) return null;
  const session = await db.prepare(`SELECT session.id, session.runtime_id, session.revoked_at,
      link.app_id, link.subscriber_user_id, app.status AS app_status, app.features_json,
      distribution.status AS distribution_status
    FROM app_session session
    JOIN app_link link ON link.id = session.app_link_id
    JOIN app ON app.id = link.app_id
    LEFT JOIN app_distribution distribution ON distribution.app_id = link.app_id AND distribution.runtime_id = session.runtime_id
    WHERE session.token_hash = ?`)
    .bind(await sha256Hex(token)).first<{
      id: string; runtime_id: string; revoked_at: number | null; app_id: string; subscriber_user_id: string;
      app_status: "approved" | "suspended"; features_json: string; distribution_status: "approved" | "suspended" | null;
    }>();
  if (!session || session.app_id !== claimedAppId || session.runtime_id !== claimedRuntimeId) return null;
  if (session.revoked_at) return { status: "revoked", reason: "session_revoked" };
  if (session.app_status !== "approved" || session.distribution_status !== "approved") return { status: "revoked", reason: "app_suspended" };

  const mode = billingModeForEnvironment(environment);
  const subscription = await db.prepare(`SELECT subscription.entitled_until
    FROM billing_customer customer JOIN normalized_subscription subscription ON subscription.billing_customer_id = customer.id
    WHERE customer.subscriber_user_id = ? AND customer.provider = 'stripe' AND customer.mode = ? AND subscription.mode = ?`)
    .bind(session.subscriber_user_id, mode, mode).first<{ entitled_until: number | null }>();
  if (!subscription?.entitled_until || subscription.entitled_until <= Math.floor(Date.now() / 1000)) {
    return { status: "inactive", reason: "no_subscription" };
  }
  const features = JSON.parse(session.features_json) as unknown;
  if (!Array.isArray(features) || !features.every((feature) => typeof feature === "string")) {
    throw new Error("Approved App features are invalid");
  }
  return { status: "active", features };
}
