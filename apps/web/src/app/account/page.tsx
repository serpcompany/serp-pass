import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getHumanIdentity } from "@/auth/identity";
import { readSubscriberSubscription } from "@/billing/read";
import { readStripeHostedBillingConfig } from "@/billing/stripe/config";
import { AuthPanel } from "./auth-panel";

export const dynamic = "force-dynamic";

function paidThroughLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export default async function AccountPage() {
  const identity = await getHumanIdentity();
  const { env } = getCloudflareContext();
  const subscription = identity ? await readSubscriberSubscription(identity.session.user.id, env.APP_ENV) : null;
  const stripeConfigured = readStripeHostedBillingConfig(env) !== null;
  const canStartCheckout = !subscription || (subscription.access === "inactive" && ["canceled", "incomplete_expired"].includes(subscription.status));
  return (
    <main>
      <Link className="back-link" href="/">← Apps Pass</Link>
      <AuthPanel />
      {identity && (
        <section className="account-card">
          <span className={`status ${subscription?.access === "active" ? "active" : ""}`}>
            {subscription?.access === "active" ? "Apps Pass access active" : "Apps Pass access inactive"}
          </span>
          <h2>Subscription</h2>
          {!subscription ? (
            <p className="muted">No normalized Subscription exists for this account. A Checkout return page will never change this state by itself.</p>
          ) : (
            <>
              <p><strong>Paid through {subscription.entitledUntil ? paidThroughLabel(subscription.entitledUntil) : "—"}</strong></p>
              <p className="muted">Provider state: {subscription.status} · {subscription.mode} mode</p>
              {subscription.status === "canceled" && subscription.access === "active" && (
                <p>Canceled; access remains active through the paid-through date.</p>
              )}
              {subscription.status === "past_due" && subscription.access === "active" && (
                <p>Renewal failed; previously paid access remains active through the paid-through date.</p>
              )}
            </>
          )}
          {!stripeConfigured ? (
            <p className="muted">Stripe sandbox access is not configured. Checkout and billing management remain deliberately unavailable.</p>
          ) : canStartCheckout ? (
            <form action="/api/billing/checkout" method="post">
              <button type="submit">Subscribe through Stripe Checkout</button>
            </form>
          ) : (
            <form action="/api/billing/portal" method="post">
              <button type="submit">Manage billing in Stripe</button>
            </form>
          )}
        </section>
      )}
      <aside>
        <strong>What this proves:</strong> Better Auth can create and read a human session through the same OpenNext Worker and local D1 database used by the MVP.
      </aside>
    </main>
  );
}
