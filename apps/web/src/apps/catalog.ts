import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db/get-db";
import { appDistributions, apps, publishers } from "@/db/schema";

export type CatalogApp = {
  id: string;
  name: string;
  publisherName: string;
  status: "approved" | "suspended";
  features: string[];
  distributions: Array<{ browserFamily: string; channel: string; status: string }>;
};

function parseFeatures(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function readCatalogApps(): Promise<CatalogApp[]> {
  const rows = await getDb().select({
    id: apps.id,
    name: apps.name,
    publisherName: publishers.name,
    status: apps.status,
    featuresJson: apps.featuresJson,
    browserFamily: appDistributions.browserFamily,
    channel: appDistributions.channel,
    distributionStatus: appDistributions.status,
  }).from(apps)
    .innerJoin(publishers, eq(publishers.id, apps.publisherId))
    .leftJoin(appDistributions, eq(appDistributions.appId, apps.id))
    .orderBy(asc(apps.name));

  const catalog = new Map<string, CatalogApp>();
  for (const row of rows) {
    const app = catalog.get(row.id) ?? {
      id: row.id,
      name: row.name,
      publisherName: row.publisherName,
      status: row.status,
      features: parseFeatures(row.featuresJson),
      distributions: [],
    };
    if (row.browserFamily && row.channel && row.distributionStatus) {
      app.distributions.push({ browserFamily: row.browserFamily, channel: row.channel, status: row.distributionStatus });
    }
    catalog.set(row.id, app);
  }
  return [...catalog.values()];
}
