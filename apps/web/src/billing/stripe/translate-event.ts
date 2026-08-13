import type Stripe from "stripe";

import type { BillingMode, NormalizedBillingEvent, SubscriptionStatus } from "../events";

const SUBSCRIBER_METADATA_KEY = "apps_pass_subscriber_user_id";
const subscriptionStatuses: ReadonlySet<string> = new Set([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export class StripeEventRejected extends Error {}

function objectId(value: { id: string } | string | null, name: string) {
  const id = typeof value === "string" ? value : value?.id;
  if (!id) throw new StripeEventRejected(`${name} is missing`);
  return id;
}

function subscriberId(metadata: Stripe.Metadata | null | undefined) {
  const id = metadata?.[SUBSCRIBER_METADATA_KEY];
  if (!id) throw new StripeEventRejected("Subscriber metadata is missing");
  return id;
}

function eventMode(event: Stripe.Event): BillingMode {
  return event.livemode ? "live" : "test";
}

function requireMode(event: Stripe.Event, expectedMode: BillingMode) {
  const mode = eventMode(event);
  if (mode !== expectedMode) throw new StripeEventRejected("Stripe Event mode does not match the application environment");
  return mode;
}

function invoiceContext(invoice: Stripe.Invoice, passPriceId: string) {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details" || !parent.subscription_details) {
    throw new StripeEventRejected("Invoice is not associated with a Subscription");
  }
  const passLines = invoice.lines.data.filter((line) => {
    const price = line.pricing?.price_details?.price;
    return price ? objectId(price, "Invoice Price") === passPriceId : false;
  });
  if (passLines.length === 0) throw new StripeEventRejected("Invoice does not contain the configured Pass Price");
  const periodStarts = passLines.map((line) => line.period.start);
  const periodEnds = passLines.map((line) => line.period.end);
  if ([...periodStarts, ...periodEnds].some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new StripeEventRejected("Invoice line period is invalid");
  }
  const periodStart = Math.min(...periodStarts);
  const periodEnd = Math.max(...periodEnds);
  if (periodEnd <= periodStart) throw new StripeEventRejected("Invoice line period does not extend access");
  return {
    subscriberUserId: subscriberId(parent.subscription_details.metadata),
    customerId: objectId(invoice.customer, "Invoice Customer"),
    subscriptionId: objectId(parent.subscription_details.subscription, "Invoice Subscription"),
    periodStart,
    periodEnd,
  };
}

function subscriptionContext(subscription: Stripe.Subscription, passPriceId: string) {
  const passItems = subscription.items.data.filter((item) => objectId(item.price, "Subscription Price") === passPriceId);
  if (passItems.length !== 1) throw new StripeEventRejected("Subscription must contain exactly one configured Pass Price item");
  const currentPeriodEnd = Math.max(...passItems.map((item) => item.current_period_end));
  return {
    subscriberUserId: subscriberId(subscription.metadata),
    customerId: objectId(subscription.customer, "Subscription Customer"),
    subscriptionId: subscription.id,
    currentPeriodEnd,
  };
}

function normalizeSubscriptionStatus(status: string): SubscriptionStatus {
  if (!subscriptionStatuses.has(status)) throw new StripeEventRejected("Subscription status is unsupported");
  return status as SubscriptionStatus;
}

export function translateStripeEvent(
  event: Stripe.Event,
  expectedMode: BillingMode,
  passPriceId: string,
): NormalizedBillingEvent | null {
  const mode = requireMode(event, expectedMode);
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const shared = invoiceContext(invoice, passPriceId);
    if (event.type === "invoice.paid") {
      if (invoice.status !== "paid" || invoice.amount_paid < 0) throw new StripeEventRejected("Paid Invoice state is invalid");
      return {
        id: event.id,
        type: event.type,
        createdAt: event.created,
        mode,
        data: {
          ...shared,
          invoiceId: invoice.id,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          periodStart: shared.periodStart,
          periodEnd: shared.periodEnd,
        },
      };
    }
    return {
      id: event.id,
      type: event.type,
      createdAt: event.created,
      mode,
      data: { ...shared, invoiceId: invoice.id, periodEnd: shared.periodEnd },
    };
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const context = subscriptionContext(subscription, passPriceId);
    return {
      id: event.id,
      type: "subscription.updated",
      createdAt: event.created,
      mode,
      data: {
        ...context,
        status: normalizeSubscriptionStatus(subscription.status),
        cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at != null,
      },
    };
  }

  return null;
}

export { SUBSCRIBER_METADATA_KEY };
