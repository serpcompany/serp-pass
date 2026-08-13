# SERP Apps Pass private-pilot MVP

Status: **Binding implementation contract; not approved for live money**

Date: **2026-08-13**

Branch: `mvp/private-pilot`

## 1. Product outcome

SERP Apps Pass is one subscription that grants a Subscriber access to every approved App in the Pass. Apps may be owned by SERP or by an invited Publisher.

The private-pilot MVP is complete only when this loop works on deployed Cloudflare staging:

> An invited Publisher submits a real SDK-enabled Chromium extension, a Subscriber buys the Pass through Stripe Checkout, the Subscriber links the extension and receives active access, the payment creates an auditable Publisher Earning, and an Operator settles that Earning through Stripe Connect in test mode.

The local extension-inclusion proof is preserved under [`docs/prototype/`](./docs/prototype/). It established useful interfaces but is not the MVP implementation.

## 2. Actors

### Subscriber

Creates an account, purchases the Pass, approves App links, sees Subscription status, opens Stripe's billing portal, and uses premium App features while entitled.

### Publisher

Is invited by SERP, completes Stripe-hosted Connect onboarding, integrates the SDK into an extension, submits the assigned manifest, and sees App, Earning, Transfer, and Payout status relevant to that Publisher.

### Operator

Invites Publishers, assigns public IDs, reviews and approves App submissions, suspends Apps, revokes App sessions, posts Publisher allocations, releases eligible Earnings, reconciles Stripe events, and controls production rollout.

## 3. Required end-to-end journeys

### Publisher inclusion

1. The Operator creates an invitation and assigns `publisher_id` and `app_id` values.
2. The Publisher signs in through the invitation.
3. The Publisher starts Stripe Connect Express hosted onboarding.
4. The system checks connected-account readiness; returning from Stripe alone does not imply readiness.
5. The Publisher integrates the public SDK into a real Chromium extension and rebuilds it.
6. The Publisher submits the versioned `apppass.json` manifest through the authenticated pilot area.
7. The system validates the complete manifest and records a pending Submission without approving the App.
8. The Operator reviews ownership evidence and approves the Submission.
9. The approved Publisher, App, and Distribution become eligible for linking.

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
5. A Publisher Earning becomes transferable only after its configured hold and Connect readiness checks pass.
6. The Operator deliberately releases the Earning.
7. The system creates one idempotent Stripe Transfer and records its result.
8. Transfer status and connected-account bank Payout status remain distinct.

## 4. Product surfaces

### Public and Subscriber

- `/` — product explanation, configured price, sign-in, Checkout entry, Subscription status, and billing-portal entry.
- `/activate/[requestId]` — authenticated App-link approval or denial.

### Invited Publisher

- `/publisher` — Connect readiness, App Submission, approved App status, Earnings, Transfers, and Payout status.

The Publisher area is private and invitation-only. It is not a public marketplace or general developer portal.

### Operator

A protected CLI is sufficient for invitations, identifier assignment, Submission approval, App suspension, session revocation, allocation posting, transfer release, and reconciliation. There is no Operator dashboard requirement.

## 5. Required implementation shape

- TypeScript and pnpm workspace.
- One Next.js App Router application deployed through OpenNext to Cloudflare Workers.
- D1 as the system of record, accessed through Drizzle with reviewed committed SQL migrations.
- Physically separate local, staging, and production D1 databases.
- Better Auth for human Subscriber, Publisher, and Operator sessions after the exact pinned stack passes a deployed staging spike.
- Opaque App sessions remain separate from human sessions.
- Stripe-hosted Checkout and Customer Portal for Subscriber billing.
- Stripe Connect Express hosted onboarding for Publishers.
- Platform-owned subscriptions plus separate charges and transfers.
- Cloudflare Workers Logs with structured, secret-safe events.
- No additional backend service unless a demonstrated constraint requires it.

## 6. Data requirements

The MVP requires durable records for:

- human users, sessions, accounts, and verification state;
- Operator invitations and role assignments;
- Publishers and connected-account readiness;
- App Submissions, Apps, and Distributions;
- Subscribers and normalized Subscriptions;
- Stripe Customers, Subscriptions, Invoices, and processed Events;
- Link Requests, App Links, and App Sessions;
- Cash Receipts, Allocation Runs, ledger entries, Publisher Earnings, Transfers, reversals, and observed Payouts;
- append-only Operator audit events for money movement and authority changes.

Every external Stripe object is stored with its mode (`test` or `live`). Test and live identifiers may never share a database environment.

## 7. Security and correctness requirements

- Verify Stripe signatures against the raw request body.
- Store every processed Stripe Event ID under a unique constraint before applying its transition.
- Make Checkout creation, Connect onboarding, allocation posting, and Transfer creation idempotent.
- Require an authenticated role and CSRF-safe method for every human state change.
- Keep Operator mutation surfaces unavailable to unauthenticated public traffic.
- Validate Publisher ownership evidence before approval; the exact pilot evidence is recorded per Submission.
- Never embed platform, Stripe, or Publisher secrets in an extension.
- Store App-session tokens only as hashes and redact credentials, proof keys, account-link URLs, and personal/payment details from logs.
- Preserve an audit trail for App approval, suspension, allocation, release, Transfer, reversal, and reconciliation.
- Treat Worker rollback and D1 migration/recovery as separate operations.

The detailed threat model is in [`docs/mvp/SECURITY.md`](./docs/mvp/SECURITY.md).

## 8. Observable acceptance criteria

The MVP is staging-complete only when all of the following have durable evidence:

1. The pinned Next.js/OpenNext/Better Auth/D1 combination runs on deployed Cloudflare staging.
2. Subscriber and invited-Publisher human sessions survive Worker restarts and enforce roles.
3. An invited Publisher completes Stripe test-mode Connect onboarding and readiness is derived from Stripe state.
4. A real Chromium extension integrates the SDK in its own source, submits the standard manifest, is approved, and loads without prototype fixture enumeration.
5. A Subscriber completes Stripe test-mode hosted Checkout.
6. Signed, duplicate, delayed, and deliberately reordered webhook fixtures produce the correct normalized Subscription without double application.
7. The Subscriber approves the real extension and it receives `active` through its own App session.
8. Cancellation and failed renewal stop extending access; paid-through expiry produces `inactive`.
9. Cross-App token use, link replay, expired links, session revocation, and App suspension behave correctly.
10. The paid Invoice produces one Cash Receipt and a balanced, auditable Allocation Run.
11. One Publisher Earning is deliberately released through one idempotent Stripe test-mode Transfer.
12. The Publisher can distinguish accrued Earning, Transfer state, and bank Payout state.
13. Structured staging logs allow an Operator to trace the Checkout, webhook, link, entitlement, allocation, and Transfer using identifiers without exposing secrets.
14. D1 state persists across deployments and a documented backup/recovery rehearsal succeeds in staging.
15. Automated contract/integration checks and real Chromium browser checks are reported separately and pass.

## 9. Live-money gate

Staging completion does not authorize production deployment or live money.

Before one controlled live purchase and Publisher settlement, the Operator must explicitly approve:

- SERP's seller/merchant, tax, invoice, refund, dispute, and customer-support responsibilities;
- the pilot Publisher agreement and ownership evidence;
- the distributable basis, Publisher amount, reserve, hold, payout cadence, minimum, currency, and negative-balance policy;
- supported platform and Publisher countries under Stripe Connect;
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
- Custom payment UI, custom Publisher KYC UI, or custom bank-payout UI.
- A polished Operator dashboard.
- Firefox, Safari, or native Apps.
- Production Sentry, data warehouse, analytics suite, or microservices.
- General accounting software or tax calculation implemented in this application.

## 11. Delivery contract

Implementation follows [`docs/mvp/DELIVERY_PLAN.md`](./docs/mvp/DELIVERY_PLAN.md). Each vertical slice ends in a user-observable path, explicit failure evidence, and a decision about what prototype mechanism was replaced. A passing unit test or created table alone cannot complete a slice.
