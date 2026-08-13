import { and, asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import { appDistributions, apps, publishers } from "./db/schema";
import { validatedManifest } from "./manifest";

export class ImportConflictError extends Error {}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function importApp(database: D1Database, input: unknown) {
  const manifest = validatedManifest(input);
  const db = drizzle(database);
  const existingPublisher = await db.select({
    id: publishers.id,
    name: publishers.name,
  }).from(publishers).where(eq(publishers.id, manifest.publisher_id)).get();

  if (existingPublisher && existingPublisher.name !== manifest.publisher_name) {
    throw new ImportConflictError(`Publisher ${manifest.publisher_id} has conflicting defining data`);
  }

  const existingApp = await db.select({
    id: apps.id,
    publisherId: apps.publisherId,
    name: apps.name,
    features: apps.features,
  }).from(apps).where(eq(apps.id, manifest.app_id)).get();

  if (existingApp) {
    const existingDistributions = await db.select({
      browser_family: appDistributions.browserFamily,
      channel: appDistributions.channel,
      runtime_id: appDistributions.runtimeId,
    }).from(appDistributions).where(eq(appDistributions.appId, manifest.app_id)).orderBy(
      asc(appDistributions.browserFamily),
      asc(appDistributions.channel),
      asc(appDistributions.runtimeId),
    );
    const appMatches = existingApp.publisherId === manifest.publisher_id
      && existingApp.name === manifest.name
      && sameJson(existingApp.features, manifest.features)
      && sameJson(existingDistributions, manifest.distributions);
    if (!appMatches) {
      throw new ImportConflictError(`App ${manifest.app_id} has conflicting defining data`);
    }
    return { result: "unchanged", publisherId: manifest.publisher_id, appId: manifest.app_id } as const;
  }

  for (const distribution of manifest.distributions) {
    const owner = await db.select({ appId: appDistributions.appId }).from(appDistributions).where(and(
      eq(appDistributions.channel, distribution.channel),
      eq(appDistributions.runtimeId, distribution.runtime_id),
    )).get();
    if (owner && owner.appId !== manifest.app_id) {
      throw new ImportConflictError(
        `Runtime identity ${distribution.channel}/${distribution.runtime_id} already belongs to ${owner.appId}`,
      );
    }
  }

  const now = Date.now();
  const statements: BatchItem<"sqlite">[] = [];
  if (!existingPublisher) {
    statements.push(db.insert(publishers).values({
      id: manifest.publisher_id,
      name: manifest.publisher_name,
      createdAt: now,
    }));
  }
  statements.push(db.insert(apps).values({
    id: manifest.app_id,
    publisherId: manifest.publisher_id,
    name: manifest.name,
    features: manifest.features,
    status: "approved",
    createdAt: now,
  }));
  for (const distribution of manifest.distributions) {
    statements.push(db.insert(appDistributions).values({
      appId: manifest.app_id,
      browserFamily: distribution.browser_family,
      channel: distribution.channel,
      runtimeId: distribution.runtime_id,
      createdAt: now,
    }));
  }
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  return { result: "imported", publisherId: manifest.publisher_id, appId: manifest.app_id } as const;
}
