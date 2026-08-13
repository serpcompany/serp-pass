import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/get-db";
import { billingCustomers, normalizedSubscriptions } from "@/db/schema";

export function billingModeForEnvironment(environment: CloudflareEnv["APP_ENV"]) {
  return environment === "production" ? "live" as const : "test" as const;
}

export async function readSubscriberSubscription(subscriberUserId: string, environment: CloudflareEnv["APP_ENV"]) {
  const mode = billingModeForEnvironment(environment);
  const subscription = await getDb()
    .select({ provider: normalizedSubscriptions.provider, mode: normalizedSubscriptions.mode, status: normalizedSubscriptions.status, cancelAtPeriodEnd: normalizedSubscriptions.cancelAtPeriodEnd, entitledUntil: normalizedSubscriptions.entitledUntil })
    .from(normalizedSubscriptions)
    .innerJoin(billingCustomers, eq(billingCustomers.id, normalizedSubscriptions.billingCustomerId))
    .where(and(eq(billingCustomers.subscriberUserId, subscriberUserId), eq(normalizedSubscriptions.mode, mode)))
    .get();
  if (!subscription) return null;
  return {
    ...subscription,
    access: subscription.entitledUntil && subscription.entitledUntil.getTime() > Date.now() ? "active" as const : "inactive" as const,
  };
}
