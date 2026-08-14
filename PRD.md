# SERP Apps Pass private-pilot MVP

Status: **Binding implementation contract; not approved for live money**

Date: **2026-08-13**

Branch: `main`

## 1. Product outcome

SERP Apps Pass is one subscription that grants a Subscriber access to every approved App in the Pass. Apps may be owned by SERP or by an invited Publisher.

The private-pilot MVP is complete only when this loop works on deployed Cloudflare staging:

> An invited Publisher submits a real SDK-enabled Chromium extension, a Subscriber buys the Pass through Stripe Checkout, the Subscriber links the extension and receives active access, the payment creates an auditable Publisher Earning, and an Operator records evidence that SERP paid that Earning through an approved external payment method.

The local extension-inclusion proof is preserved under [`docs/prototype/`](./docs/prototype/). It established useful interfaces but is not the MVP implementation.

## 2. Actors

### Subscriber

Creates an account, purchases the Pass, approves App links, sees Subscription status, opens Stripe's billing portal, and uses premium App features while entitled.

### Publisher

Is invited by SERP, supplies product and Distribution facts, integrates the SDK into an extension using the generated App ID, submits the manifest, and sees App, Earning, and Publisher Payment status relevant to that Publisher. Payment-account credentials are exchanged with SERP outside Apps Pass.

### Operator

Invites Publishers, reviews and approves or declines App submissions, suspends Apps, revokes App sessions, posts Publisher allocations, records completed Publisher Payments, reconciles Stripe billing events, and controls production rollout. Apps Pass generates immutable Publisher and App IDs; the Operator does not invent them.

## 3. Required end-to-end journeys

### Publisher inclusion

1. The Operator creates an email-bound invitation from the prospective Publisher's supplied contact and company information; Apps Pass generates immutable `publisher_id` and `app_id` values.
2. The Publisher signs in through the invitation.
3. The Publisher configures the public SDK with the generated App ID; the SDK reads the installed extension's actual identity from `chrome.runtime.id`; the Publisher rebuilds the extension.
4. The Publisher submits the versioned `apppass.json` product and Distribution facts plus ownership evidence through the authenticated pilot area.
5. The system validates the complete manifest and records a pending Submission without approving the App.
6. The Operator inspects the submitted product facts, runtime identity, and ownership evidence and explicitly approves or declines the Submission.
7. The approved Publisher, App, and Distribution become eligible for linking.

### Purchase

1. A Subscriber signs in.
2. The application creates one hosted Stripe Checkout Session for the configured recurring Price.
3. Stripe redirects the Subscriber back to the application for confirmation UX only.
4. A signature-verified Stripe webhook records the Stripe Event and projects Customer, Subscription, Invoice, and paid-through state into D1.
5. Only the D1 projection used by the entitlement authority grants access.
6. Replayed or out-of-order events do not duplicate or corrupt state.

### Link and check access

1. The extension creates an installation identifier and one-time proof challenge through the SDK.
2. The authority validates the approved App and Distribution and returns an expiring activation URL.
3. The signed-in Subscriber opens `/activate/[requestId]`, reviews the App identity, and approves or denies it.
4. The extension exchanges the proof once for an opaque App-session token.
5. The authority stores only the token hash and scopes the session to the App and installation.
6. Entitlement returns `active` only while the App, Distribution, session, and paid-through Subscription state all permit access.

### Cancellation and failure

- Cancellation at period end retains access through the last successfully paid `entitled_until` value.
- A failed renewal does not extend `entitled_until`.
- An expired paid-through time returns `inactive` even if a stale browser session exists.
- Session revocation affects only that installation.
- App suspension revokes that App without affecting another App.
- An authority failure returns `temporarily_unavailable`, never a false `inactive` response.

### Earnings and settlement

1. A paid Stripe Invoice creates a recorded Cash Receipt exactly once.
2. The Operator creates a balanced Allocation Run for eligible Cash Receipts.
3. The run explicitly records the distributable amount, reserve, platform amount, and Publisher Earning amounts; no hidden usage formula exists.
4. Posted ledger entries are immutable. Corrections use compensating entries.
5. A Publisher Earning becomes payable only after its configured hold passes.
6. SERP completes payment outside Apps Pass using the separately agreed Publisher payment method.
7. The Operator records one immutable, idempotent Publisher Payment containing the exact Earning amount, method, completion time, and opaque provider confirmation reference.
8. Apps Pass never stores bank credentials, payment-account credentials, or a Publisher email address as the payment reference. Recording evidence never initiates money movement.

## 4. Product surfaces

### Public and Subscriber

- `/` — public Pass explanation, Subscriber journey, approved-App preview, and clear entry points.
- `/apps` — public catalog of approved Apps and their availability.
- `/account` — sign-in, Checkout entry, normalized Subscription status, and billing-portal entry.
- `/activate/[requestId]` — authenticated App-link approval or denial.

### Invited Publisher

- `/submit` — public explanation of the invitation, integration, Submission, review, and payment process.
- `/docs` — public private-pilot integration guide with SDK and manifest examples.
- `/publisher/invitation` — authenticated one-time invitation acceptance.
- `/publisher` — App Submission, approved App status, Earnings, and recorded Publisher Payment status.

The Publisher area is private and invitation-only. It is not a public marketplace or general developer portal.

### Operator

A protected CLI or minimal protected form is sufficient for invitations, identifier assignment, Submission approval, App suspension, session revocation, allocation posting, completed-payment recording, and reconciliation. There is no polished Operator dashboard requirement.

## 5. Required implementation shape

- TypeScript and pnpm workspace.
- One Next.js App Router application deployed through OpenNext to Cloudflare Workers.
- D1 as the system of record, accessed through Drizzle with reviewed committed SQL migrations.
- Physically separate local, staging, and production D1 databases.
- Better Auth for human Subscriber, Publisher, and Operator sessions after the exact pinned stack passes a deployed staging spike.
- Opaque App sessions remain separate from human sessions.
- Stripe-hosted Checkout and Customer Portal for Subscriber billing.
- Platform-owned Stripe subscriptions. Stripe does not calculate Publisher shares or pay Publishers in the private-pilot MVP.
- Publisher payments completed outside Apps Pass and recorded through an audited provider-neutral boundary.
- Cloudflare Workers Logs with structured, secret-safe events.
- No additional backend service unless a demonstrated constraint requires it.

## 6. Data requirements

The MVP requires durable records for:

- human users, sessions, accounts, and verification state;
- Operator invitations and role assignments;
- Publishers and Publisher Memberships;
- App Submissions, Apps, and Distributions;
- Subscribers and normalized Subscriptions;
- Stripe Customers, Subscriptions, Invoices, and processed Events;
- Link Requests, App Links, and App Sessions;
- Cash Receipts, Allocation Runs, ledger entries, Publisher Earnings, and immutable Publisher Payment evidence;
- append-only Operator audit events for money movement and authority changes.

Every external Stripe object is stored with its mode (`test` or `live`). Test and live identifiers may never share a database environment.

## 7. Security and correctness requirements

- Verify Stripe signatures against the raw request body.
- Store every processed Stripe Event ID under a unique constraint before applying its transition.
- Make Checkout creation, allocation posting, and Publisher Payment recording idempotent.
- Require an authenticated role and CSRF-safe method for every human state change.
- Keep Operator mutation surfaces unavailable to unauthenticated public traffic.
- Validate Publisher ownership evidence before approval; the exact pilot evidence is recorded per Submission.
- Never embed platform, Stripe, or Publisher secrets in an extension.
- Store App-session tokens only as hashes and redact credentials, proof keys, account-link URLs, and personal/payment details from logs.
- Preserve an audit trail for App approval, suspension, allocation, Publisher Payment recording, and reconciliation.
- Treat Worker rollback and D1 migration/recovery as separate operations.

The detailed threat model is in [`docs/mvp/SECURITY.md`](./docs/mvp/SECURITY.md).

## 8. Observable acceptance criteria

The MVP is staging-complete only when all of the following have durable evidence:

1. The pinned Next.js/OpenNext/Better Auth/D1 combination runs on deployed Cloudflare staging.
2. Subscriber and invited-Publisher human sessions survive Worker restarts and enforce roles.
3. An invited Publisher can participate without a Stripe connected account or payment credentials stored in Apps Pass.
4. A real Chromium extension integrates the SDK in its own source, submits the standard manifest, is approved, and loads without prototype fixture enumeration.
5. A Subscriber completes Stripe test-mode hosted Checkout.
6. Signed, duplicate, delayed, and deliberately reordered webhook fixtures produce the correct normalized Subscription without double application.
7. The Subscriber approves the real extension and it receives `active` through its own App session.
8. Cancellation and failed renewal stop extending access; paid-through expiry produces `inactive`.
9. Cross-App token use, link replay, expired links, session revocation, and App suspension behave correctly.
10. The paid Invoice produces one Cash Receipt and a balanced, auditable Allocation Run.
11. One completed external Publisher payment is deliberately recorded once against the exact eligible Earning; exact retry is a no-op and conflicting evidence rejects.
12. The Publisher can distinguish an accrued Earning from a recorded Publisher Payment, while Apps Pass makes no claim that an unobserved bank deposit succeeded.
13. Structured staging logs allow an Operator to trace the Checkout, webhook, link, entitlement, allocation, and Publisher Payment using identifiers without exposing secrets.
14. D1 state persists across deployments and a documented backup/recovery rehearsal succeeds in staging.
15. Automated contract/integration checks and real Chromium browser checks are reported separately and pass.

## 9. Live-money gate

Staging completion does not authorize production deployment or live money.

Before one controlled live purchase and Publisher settlement, the Operator must explicitly approve:

- SERP's seller/merchant, tax, invoice, refund, dispute, and customer-support responsibilities;
- the pilot Publisher agreement and ownership evidence;
- the distributable basis, Publisher amount, reserve, hold, payment cadence, minimum, currency, approved payment methods, and negative-balance policy;
- Publisher agreement, tax-information collection, reporting, and supported-country policy;
- production hostname, price, email sender/provider, terms, privacy policy, and refund policy;
- production D1 creation/migration, secrets, rollback, recovery, and reconciliation runbooks.

The live smoke test must use a deliberately limited price and settlement amount, record the complete evidence chain, and include an agreed cancellation or refund path.

## 10. Explicit non-goals

- Public marketplace catalog, search, categories, ratings, reviews, or discovery.
- Public Publisher applications or automated Publisher approval.
- Automated extension ownership verification.
- Usage analytics or usage-weighted revenue allocation.
- Automatic allocation or automatic Transfer release.
- Multiple Pass plans, currencies, coupons, affiliates, teams, or seats.
- Custom payment UI, custom Publisher KYC UI, or storage of Publisher bank/payment-account credentials.
- Automated Publisher payouts or Stripe Connect; both are post-MVP options after the manual operating model is validated.
- A polished Operator dashboard.
- Firefox, Safari, or native Apps.
- Production Sentry, data warehouse, analytics suite, or microservices.
- General accounting software or tax calculation implemented in this application.

## 11. Delivery contract

Implementation follows [`docs/mvp/DELIVERY_PLAN.md`](./docs/mvp/DELIVERY_PLAN.md). Each vertical slice ends in a user-observable path, explicit failure evidence, and a decision about what prototype mechanism was replaced. A passing unit test or created table alone cannot complete a slice.
