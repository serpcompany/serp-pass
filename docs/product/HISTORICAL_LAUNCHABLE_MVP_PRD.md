# SERP Apps Pass MVP PRD

> **Historical, non-binding product intent.** This document preserves an earlier launchable-product direction for comparison. It controls neither the completed extension-inclusion proof nor the current private-pilot MVP. The current binding product contract is [the root PRD](../../PRD.md).

Historical status: **Formerly binding; now non-binding**
Date: **2026-08-13**
Product: **SERP Apps Pass**

## 1. Product statement

SERP Apps Pass is one subscription that grants a Subscriber access to every approved App in the Pass. Apps may be owned by SERP or by an invited Publisher.

The MVP exists to prove one thing in production-like conditions:

> One paid Subscriber can use the same Subscription to unlock two independently owned browser extensions through one standardized integration.

The MVP is not a marketplace. Discovery, merchandising, self-service publisher onboarding, and automated revenue sharing are separate products that may be added after the entitlement loop has real usage.

## 2. Binding terminology

- **Publisher** — a person or organization that owns one or more Apps.
- **App** — a registered browser extension approved for inclusion in the Pass.
- **Subscriber** — a person whose Subscription may grant access.
- **Subscription** — the billing-backed record that determines paid access.
- **Pass** — the bundle of all approved Apps available through one active Subscription.
- **App link** — a Subscriber-approved association between an App installation and the Subscriber.
- **App session** — an opaque, revocable, App-and-installation-scoped credential issued after linking.
- **Entitlement** — the current decision that an App session is active, inactive, or revoked.
- **Distribution** — an allowlisted browser-store/runtime identity for an App.

## 3. MVP users

### Subscriber

Can sign in, purchase the one Subscription, approve an App link, manage billing through the payment provider, and unlock approved Apps.

### Operator

Controls billing, the database, App registration, App suspension, and Subscriber/App-session revocation. Operator actions may use a CLI for the MVP.

### Invited Publisher

Receives the public SDK contract and an operator-issued App ID, integrates one extension, and submits its public runtime/store identity for manual approval. The Publisher receives no platform secret and no database access.

## 4. Required customer experience

Only two first-party page experiences are required.

### `/`

A single responsive page containing:

- What the Pass unlocks.
- The single price and billing cadence.
- Sign-in and hosted-checkout entry.
- Current subscription status when signed in.
- A link to the payment provider's hosted billing portal when subscribed.
- Minimal links to terms, privacy, and refund policy.

There is no separate `/account` area in the MVP. The signed-in state on `/` is sufficient.

### `/activate/[requestId]`

Opened by a participating extension. It:

- Requires Subscriber sign-in.
- Shows the App asking to connect.
- Allows approve or deny.
- Shows a terminal success, denied, expired, or already-used state.

Checkout and billing management use payment-provider-hosted pages. Authentication-provider callbacks and API routes are implementation routes, not additional product surfaces.

## 5. End-to-end flows

### Purchase

1. The visitor signs in using an emailed one-time link or code.
2. The application creates a hosted checkout for the single Pass price.
3. The payment provider redirects the Subscriber back to `/`.
4. A signed billing webhook updates normalized Subscription state in D1.
5. The UI and entitlement authority trust the D1 Subscription record, not the browser redirect.

### Link an extension

1. The SDK creates or loads a random installation ID and a one-time proof key.
2. The SDK sends its operator-issued App ID, public runtime ID, installation ID, and proof challenge to the authority.
3. The authority verifies that the App and Distribution are approved and returns a short-lived activation URL.
4. The SDK opens `/activate/[requestId]` in a normal browser tab.
5. The signed-in Subscriber approves the App link.
6. The SDK exchanges its one-time proof for an opaque App-session token.
7. Only the hash of that token is stored by the authority.

### Check access

1. The extension calls the entitlement endpoint with its App-session token.
2. The authority verifies the token, App, Distribution, installation, App status, and Subscription state.
3. The authority returns one of the public states defined in section 7.
4. The extension unlocks premium UI only for `active`.

### Cancellation and revocation

- Cancellation at period end retains access through the paid-through time.
- Expired or unpaid Subscription state returns `inactive` on the next check.
- Revoking one App session affects only that installation.
- Suspending an App makes all of that App's sessions return `revoked` without affecting other Apps.

## 6. Minimum backend capabilities

The MVP requires these logical operations; exact route filenames may follow framework conventions.

### Billing

- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/billing/webhook`

Webhook processing must verify the provider signature and store the provider event ID under a unique constraint before applying state. Replaying the same event must be safe.

### App linking

- `POST /api/app-pass/link-requests`
- `POST /api/app-pass/link-requests/:id/approve`
- `POST /api/app-pass/link-requests/:id/exchange`

Link requests expire after ten minutes, are single-use, and are bound to the submitted proof challenge.

### Entitlements

- `POST /api/app-pass/entitlements/check`

The request uses an App-session bearer token. The response must not expose billing-provider objects or internal Subscriber data.

### Operator actions

A protected local/CI CLI is sufficient for:

- Registering a Publisher.
- Registering an App and Distribution.
- Approving or suspending an App.
- Revoking an App session.

No admin dashboard is required.

## 7. Public SDK contract

The initial SDK targets Chromium Manifest V3 extensions and exposes a small framework-neutral TypeScript interface:

```ts
type Entitlement =
  | { status: "active"; features: string[]; checkedAt: string }
  | { status: "inactive"; reason: "no_subscription" | "expired" | "unpaid" }
  | { status: "unauthenticated"; reason: "not_linked" | "session_expired" }
  | { status: "revoked"; reason: "session_revoked" | "app_suspended" }
  | { status: "temporarily_unavailable"; retryAfterSeconds?: number };

type AppPassClient = {
  beginLink(): Promise<{ verificationUrl: string; expiresAt: string }>;
  finishLink(): Promise<void>;
  check(): Promise<Entitlement>;
  unlink(): Promise<void>;
};
```

Example integration:

```ts
const pass = createAppPass({
  appId: "app_example",
  runtimeId: chrome.runtime.id,
});

const entitlement = await pass.check();

if (entitlement.status === "active") {
  enablePremiumFeatures();
} else {
  showAppPassPrompt(entitlement);
}
```

The extension contains no private secret. Client-only premium gates can be modified by a determined user; any valuable server-backed feature must also verify entitlement on its server.

## 8. Publisher submission standard

For the private pilot, a Publisher sends an `apppass.json` file and review instructions directly to the Operator. Self-service submission is excluded.

```json
{
  "$schema": "https://pass.serp.co/schema/app-manifest-v1.json",
  "schema_version": 1,
  "app_id": "app_example",
  "publisher_id": "pub_example",
  "name": "Example Extension",
  "distributions": [
    {
      "browser_family": "chromium",
      "channel": "chrome_web_store",
      "runtime_id": "public-extension-runtime-id",
      "store_url": "https://chromewebstore.google.com/detail/example/public-extension-runtime-id"
    }
  ],
  "features": ["premium"],
  "support_url": "https://example.com/support",
  "privacy_url": "https://example.com/privacy"
}
```

The Operator issues `app_id` and `publisher_id`. The runtime ID and store URL are public allowlist identities, not authentication secrets.

## 9. Technical architecture

### Runtime and application

- TypeScript.
- Next.js App Router.
- One full-stack Next.js deployment on Cloudflare Workers using OpenNext.
- Static assets served through Workers Static Assets.
- No separate Cloudflare Pages application.

### Data and authentication

- Cloudflare D1 as the system of record.
- Drizzle ORM and committed SQL migrations.
- Better Auth for human authentication using email one-time links or codes.
- Extension App sessions are separate opaque credentials and do not use human Better Auth sessions.

### Billing

- A small provider-neutral billing interface in domain code.
- Stripe is the default first adapter unless replaced before implementation.
- One recurring price and one currency at launch.
- Hosted checkout and hosted billing portal.

### Operational visibility

- Cloudflare Workers Logs enabled.
- Structured `console.error` for failed webhooks, linking failures, and entitlement-authority exceptions.
- Do not log bearer tokens, proof keys, authentication codes, full webhook payloads, or payment details.
- No Sentry, custom tracing system, Tail Worker, or alerting project in the MVP.

## 10. Minimum D1 records

In addition to Better Auth's required tables:

- `publishers`
- `apps`
- `app_distributions`
- `subscriptions`
- `billing_events`
- `link_requests`
- `app_links`
- `app_sessions`

Important constraints include unique provider event IDs, unique App IDs, unique channel/runtime-ID pairs, hashed unique App-session tokens, and one terminal exchange per link request.

The MVP does not require usage, accrual, payout, review-history, or analytics tables.

## 11. Security and correctness boundaries

- Payment state changes only through verified webhooks or explicit test fixtures outside production.
- Billing events are replay-safe.
- App-session tokens are high-entropy, opaque, stored hashed, revocable, and scoped to one App installation.
- Link requests are high-entropy, short-lived, single-use, and proof-bound.
- App runtime IDs are validated against approved Distributions.
- Server responses use explicit states; a temporary authority failure must not be reported as an inactive Subscription.
- Secrets live in Cloudflare secrets or local ignored environment files.
- D1 writes use unique constraints and idempotent operations rather than assuming interactive transactions.

## 12. Explicitly post-MVP

The following are excluded until this PRD is deliberately revised:

- Public marketplace, catalog, search, categories, detail pages, ratings, or reviews.
- Separate `/account` product area.
- Partner or Publisher dashboard.
- Self-service App submission and automated store ownership verification.
- Automated publisher revenue allocation or payouts.
- Usage-weighted compensation, fraud scoring, or a financial ledger.
- Multiple plans, add-ons, coupons, team subscriptions, or regional pricing.
- Custom checkout or billing-management UI.
- Firefox, Safari, or native applications.
- Sentry, application-performance monitoring, tracing, alerting, or a data warehouse.
- Marketing automation, product analytics, affiliate tracking, and referral systems.
- Polished operator administration UI.

For the invited Publisher pilot, compensation is handled by a written agreement and a manually approved payment outside this application's code.

## 13. MVP acceptance criteria

The MVP is launchable when all of the following pass against a deployed preview using provider test mode and a real D1 database:

1. One Subscriber signs in and completes hosted checkout.
2. A verified webhook creates or updates the normalized Subscription.
3. Replaying that webhook does not duplicate or corrupt state.
4. One SERP-owned extension and one invited-Publisher extension are registered under different Publishers.
5. The Subscriber approves and links one installation of each extension.
6. Both extensions receive `active` from the same Subscription using separate App-session tokens.
7. A token issued to one App cannot be used as another App's session.
8. Expiry or unpaid state makes both extensions return `inactive`.
9. Revoking one App session leaves the other extension active.
10. Suspending one App makes that App return `revoked` without changing the other App.
11. An authority failure produces `temporarily_unavailable`, not a false inactive decision.
12. The state persists across Worker restarts and can be inspected through D1/operator tooling.

Passing these criteria proves the product. A marketplace or payout system is not required to declare the MVP successful.

## 14. Launch inputs still to supply

These values do not block scaffolding but must be fixed before a production launch:

- Production hostname; working assumption: `pass.serp.co`.
- Monthly price, currency, and whether an annual option is deliberately added.
- Billing provider; working assumption: Stripe.
- Transactional email provider and sender domain.
- First SERP App, its Chromium runtime ID, and repository.
- Invited Publisher, first external App, runtime ID, and repository.
- Subscriber terms, privacy policy, refund policy, and invited-Publisher agreement.
- Cancellation grace and payment-recovery policy beyond paid-through access.

## 15. Implementation order

1. Scaffold Next.js/OpenNext, D1/Drizzle, local configuration, and the two packages: web authority and extension SDK.
2. Implement the schema and operator App-registration CLI.
3. Implement Better Auth and the signed-in state on `/`.
4. Implement the billing adapter, hosted checkout/portal, and replay-safe webhook synchronization.
5. Implement proof-bound App linking and opaque App sessions.
6. Implement entitlement checks and the Chromium SDK.
7. Integrate the two pilot extensions.
8. Validate every acceptance criterion locally, then on a deployed preview.

Each step must stay within the boundaries above. Any proposed feature outside them requires a PRD change before implementation.
