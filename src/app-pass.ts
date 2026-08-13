import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  appDistributions,
  appLinks,
  apps,
  appSessions,
  linkRequests,
  subscribers,
  subscriptions,
} from "./db/schema";
import { randomToken, sha256 } from "./crypto";

export class AppPassRequestError extends Error {}

function requiredString(value: unknown, field: string, minimumLength = 1) {
  if (typeof value !== "string" || value.length < minimumLength) {
    throw new AppPassRequestError(`${field} is invalid`);
  }
  return value;
}

export async function createLinkRequest(database: D1Database, input: unknown) {
  if (!input || typeof input !== "object") throw new AppPassRequestError("Request body is invalid");
  const body = input as Record<string, unknown>;
  const appId = requiredString(body.appId, "appId");
  const runtimeId = requiredString(body.runtimeId, "runtimeId", 32);
  const installationId = requiredString(body.installationId, "installationId", 8);
  const proofChallenge = requiredString(body.proofChallenge, "proofChallenge", 20);
  const db = drizzle(database);
  const identity = await db.select({ appStatus: apps.status }).from(appDistributions)
    .innerJoin(apps, eq(appDistributions.appId, apps.id))
    .where(and(
      eq(appDistributions.appId, appId),
      eq(appDistributions.runtimeId, runtimeId),
    )).get();
  if (!identity || identity.appStatus !== "approved") {
    throw new AppPassRequestError("App or runtime identity is not approved");
  }
  const now = Date.now();
  const requestId = `linkreq_${randomToken(18)}`;
  const expiresAt = now + 10 * 60_000;
  await db.insert(linkRequests).values({
    id: requestId,
    appId,
    runtimeId,
    installationId,
    proofChallenge,
    expiresAt,
    createdAt: now,
  });
  return { requestId, expiresAt: new Date(expiresAt).toISOString() };
}

export async function activateLocalSubscription(database: D1Database, input: unknown) {
  if (!input || typeof input !== "object") throw new AppPassRequestError("Request body is invalid");
  const body = input as Record<string, unknown>;
  const subscriberId = requiredString(body.subscriberId, "subscriberId");
  const email = requiredString(body.email, "email");
  const subscriptionId = requiredString(body.subscriptionId, "subscriptionId");
  const db = drizzle(database);
  const now = Date.now();
  await db.insert(subscribers).values({ id: subscriberId, email, createdAt: now })
    .onConflictDoUpdate({ target: subscribers.id, set: { email } });
  await db.insert(subscriptions).values({
    id: subscriptionId,
    subscriberId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptions.subscriberId,
    set: { status: "active", updatedAt: now },
  });
  return { subscriberId, subscriptionId, status: "active" } as const;
}

export async function approveLinkRequest(database: D1Database, requestId: string, subscriberId: string) {
  const db = drizzle(database);
  const request = await db.select().from(linkRequests).where(eq(linkRequests.id, requestId)).get();
  if (!request) throw new AppPassRequestError("Link request not found");
  if (request.expiresAt <= Date.now()) throw new AppPassRequestError("Link request expired");
  if (request.exchangedAt) throw new AppPassRequestError("Link request already used");
  const subscriber = await db.select({ id: subscribers.id }).from(subscribers)
    .where(eq(subscribers.id, subscriberId)).get();
  if (!subscriber) throw new AppPassRequestError("Subscriber not found");
  await db.update(linkRequests).set({ subscriberId, approvedAt: Date.now() })
    .where(eq(linkRequests.id, requestId));
  return { requestId, subscriberId, approved: true };
}

export async function expireLinkRequest(database: D1Database, requestId: string) {
  const db = drizzle(database);
  const updated = await db.update(linkRequests).set({ expiresAt: 0 })
    .where(eq(linkRequests.id, requestId)).returning({ id: linkRequests.id });
  if (updated.length !== 1) throw new AppPassRequestError("Link request not found");
  return { requestId, expired: true };
}

export async function exchangeLinkRequest(database: D1Database, requestId: string, input: unknown) {
  if (!input || typeof input !== "object") throw new AppPassRequestError("Request body is invalid");
  const proofKey = requiredString((input as Record<string, unknown>).proofKey, "proofKey", 20);
  const db = drizzle(database);
  const request = await db.select().from(linkRequests).where(eq(linkRequests.id, requestId)).get();
  if (!request?.subscriberId || !request.approvedAt) throw new AppPassRequestError("Link request is not approved");
  if (request.expiresAt <= Date.now()) throw new AppPassRequestError("Link request expired");
  if (request.exchangedAt) throw new AppPassRequestError("Link request already used");
  if (await sha256(proofKey) !== request.proofChallenge) throw new AppPassRequestError("Proof does not match");

  let link = await db.select().from(appLinks).where(and(
    eq(appLinks.appId, request.appId),
    eq(appLinks.subscriberId, request.subscriberId),
    eq(appLinks.installationId, request.installationId),
  )).get();
  if (!link) {
    link = {
      id: `link_${randomToken(18)}`,
      appId: request.appId,
      subscriberId: request.subscriberId,
      installationId: request.installationId,
      createdAt: Date.now(),
    };
    await db.insert(appLinks).values(link);
  }
  const claimed = await db.update(linkRequests).set({ exchangedAt: Date.now() }).where(and(
    eq(linkRequests.id, requestId),
    isNull(linkRequests.exchangedAt),
  )).returning({ id: linkRequests.id });
  if (claimed.length !== 1) throw new AppPassRequestError("Link request already used");

  const token = `aps_${randomToken(32)}`;
  await db.insert(appSessions).values({
    id: `session_${randomToken(18)}`,
    appLinkId: link.id,
    tokenHash: await sha256(token),
    createdAt: Date.now(),
  });
  return { token };
}

export async function checkEntitlement(
  database: D1Database,
  token: string,
  claimedAppId: string,
  claimedRuntimeId: string,
) {
  const db = drizzle(database);
  const session = await db.select().from(appSessions)
    .where(eq(appSessions.tokenHash, await sha256(token))).get();
  if (!session) return null;
  const link = await db.select().from(appLinks).where(eq(appLinks.id, session.appLinkId)).get();
  if (!link || link.appId !== claimedAppId) return null;
  const app = await db.select().from(apps).where(eq(apps.id, link.appId)).get();
  const distribution = await db.select({ appId: appDistributions.appId }).from(appDistributions).where(and(
    eq(appDistributions.appId, link.appId),
    eq(appDistributions.runtimeId, claimedRuntimeId),
  )).get();
  if (!app || !distribution) return null;
  if (session.revokedAt) return { status: "revoked", reason: "session_revoked" } as const;
  if (app.status === "suspended") return { status: "revoked", reason: "app_suspended" } as const;
  const subscription = await db.select().from(subscriptions)
    .where(eq(subscriptions.subscriberId, link.subscriberId)).get();
  if (!subscription || subscription.status !== "active") {
    return { status: "inactive", reason: "no_subscription" } as const;
  }
  return { status: "active", features: app.features } as const;
}

export async function revokeAppSession(database: D1Database, sessionId: string) {
  const db = drizzle(database);
  const updated = await db.update(appSessions).set({ revokedAt: Date.now() })
    .where(eq(appSessions.id, sessionId)).returning({ id: appSessions.id });
  if (updated.length !== 1) throw new AppPassRequestError("App session not found");
  return { sessionId, revoked: true };
}

export async function setAppStatus(database: D1Database, appId: string, status: "approved" | "suspended") {
  const db = drizzle(database);
  const updated = await db.update(apps).set({ status }).where(eq(apps.id, appId)).returning({ id: apps.id });
  if (updated.length !== 1) throw new AppPassRequestError("App not found");
  return { appId, status };
}

export async function prototypeState(database: D1Database) {
  const db = drizzle(database);
  const [subscriberRows, subscriptionRows, requestRows, linkRows, sessionRows] = await Promise.all([
    db.select({ id: subscribers.id, email: subscribers.email }).from(subscribers),
    db.select({
      id: subscriptions.id,
      subscriberId: subscriptions.subscriberId,
      status: subscriptions.status,
    }).from(subscriptions),
    db.select({
      id: linkRequests.id,
      appId: linkRequests.appId,
      runtimeId: linkRequests.runtimeId,
      subscriberId: linkRequests.subscriberId,
      expiresAt: linkRequests.expiresAt,
      approvedAt: linkRequests.approvedAt,
      exchangedAt: linkRequests.exchangedAt,
    }).from(linkRequests),
    db.select({
      id: appLinks.id,
      appId: appLinks.appId,
      subscriberId: appLinks.subscriberId,
      installationId: appLinks.installationId,
    }).from(appLinks),
    db.select({
      id: appSessions.id,
      appId: appLinks.appId,
      tokenHash: appSessions.tokenHash,
      revokedAt: appSessions.revokedAt,
    }).from(appSessions).innerJoin(appLinks, eq(appSessions.appLinkId, appLinks.id)),
  ]);
  return {
    subscribers: subscriberRows,
    subscriptions: subscriptionRows,
    linkRequests: requestRows,
    links: linkRows,
    sessions: sessionRows,
  };
}
