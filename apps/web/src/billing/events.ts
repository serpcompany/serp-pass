export type BillingMode = "test" | "live";
export type SubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";

type SharedData = {
  subscriberUserId: string;
  customerId: string;
  subscriptionId: string;
};

export type NormalizedBillingEvent =
  | {
      id: string;
      type: "invoice.paid";
      createdAt: number;
      mode: BillingMode;
      data: SharedData & { invoiceId: string; amountPaid: number; currency: string; periodStart: number; periodEnd: number };
    }
  | {
      id: string;
      type: "invoice.payment_failed";
      createdAt: number;
      mode: BillingMode;
      data: SharedData & { invoiceId: string; periodEnd: number };
    }
  | {
      id: string;
      type: "subscription.updated";
      createdAt: number;
      mode: BillingMode;
      data: SharedData & { status: SubscriptionStatus; cancelAtPeriodEnd: boolean; currentPeriodEnd: number };
    };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== "string" || value.length < 1 || value.length > 255) throw new Error(`${name} is invalid`);
  return value;
}

function requiredInteger(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${name} is invalid`);
  return value as number;
}

export function parseNormalizedBillingEvent(input: unknown): NormalizedBillingEvent {
  const event = record(input);
  const data = record(event?.data);
  if (!event || !data) throw new Error("Billing event must be an object");
  const id = requiredString(event.id, "id");
  const createdAt = requiredInteger(event.createdAt, "createdAt");
  if (event.mode !== "test" && event.mode !== "live") throw new Error("mode is invalid");
  const shared = {
    subscriberUserId: requiredString(data.subscriberUserId, "subscriberUserId"),
    customerId: requiredString(data.customerId, "customerId"),
    subscriptionId: requiredString(data.subscriptionId, "subscriptionId"),
  };
  if (event.type === "invoice.paid") {
    const currency = requiredString(data.currency, "currency").toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) throw new Error("currency is invalid");
    return { id, type: event.type, createdAt, mode: event.mode, data: {
      ...shared,
      invoiceId: requiredString(data.invoiceId, "invoiceId"),
      amountPaid: requiredInteger(data.amountPaid, "amountPaid"),
      currency,
      periodStart: requiredInteger(data.periodStart, "periodStart"),
      periodEnd: requiredInteger(data.periodEnd, "periodEnd"),
    } };
  }
  if (event.type === "invoice.payment_failed") {
    return { id, type: event.type, createdAt, mode: event.mode, data: {
      ...shared,
      invoiceId: requiredString(data.invoiceId, "invoiceId"),
      periodEnd: requiredInteger(data.periodEnd, "periodEnd"),
    } };
  }
  if (event.type === "subscription.updated") {
    const statuses: SubscriptionStatus[] = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"];
    if (!statuses.includes(data.status as SubscriptionStatus) || typeof data.cancelAtPeriodEnd !== "boolean") throw new Error("subscription state is invalid");
    return { id, type: event.type, createdAt, mode: event.mode, data: {
      ...shared,
      status: data.status as SubscriptionStatus,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: requiredInteger(data.currentPeriodEnd, "currentPeriodEnd"),
    } };
  }
  throw new Error("Billing event type is unsupported");
}
