# SERP Apps Pass private-pilot MVP

Status: **Binding implementation contract; not approved for live money**

Date: **2026-08-13**

Branch: `main`

## 1. Product outcome

SERP Apps Pass is one subscription that grants a Subscriber access to every approved App in the Pass. Apps may be owned by SERP or by an independently applying Publisher.

The private-pilot MVP is complete only when this loop works on deployed Cloudflare staging:

> A developer applies, SERP accepts the product, Apps Pass generates onboarding identities, the Publisher integrates the SDK, and the built or published extension proves that it can connect using the accepted App and runtime identities. A Subscriber then buys the Pass through Stripe Checkout, links the extension, and receives the authoritative Apps Pass status; the payment creates an auditable Publisher Earning. Paying a real Publisher and recording that payment belong to the first controlled Publisher settlement, not staging MVP acceptance.

The local extension-inclusion proof is preserved under [`docs/prototype/`](./docs/prototype/). It established useful interfaces but is not the MVP implementation.

## 2. Actors

### Subscriber

Creates an account, purchases the Pass, approves App links, sees Subscription status, opens Stripe's billing portal, and uses premium App features while entitled.

### Publisher Applicant

Submits contact, product, public listing or source URL, ownership, distribution, privacy, permissions, and quality information for preliminary SERP review. Applying creates no Publisher role, identifiers, App authority, catalog entry, or entitlement.

### Publisher

Has passed product review, accepts an email-bound onboarding invitation, integrates the SDK using the generated App ID, builds or publishes the integrated extension, and registers its public manifest and Distribution for connection verification. The Publisher sees App, Earning, and Publisher Payment status relevant to that Publisher. Payment-account credentials are exchanged with SERP outside Apps Pass.

### Operator

Reviews Publisher Applications, accepts or declines products, inspects connection status, suspends Apps, revokes App sessions, posts Publisher allocations, records completed Publisher Payments, reconciles Stripe billing events, and controls production rollout. Product acceptance generates immutable Publisher and App IDs plus an email-bound onboarding invitation; the Operator does not invent them.

## 3. Required end-to-end journeys

### Publisher inclusion

1. A developer submits a Publisher Application through the public site. Submission is never approval.
2. The Operator inspects the applicant, product, public listing, ownership attestation, permissions/privacy answers, and product-quality evidence, then declines, requests follow-up outside the MVP, or accepts it with a reason.
3. Only product acceptance generates immutable `publisher_id` and `app_id` values and one expiring, email-bound onboarding invitation.
4. The accepted Publisher signs in through that invitation.
5. The Publisher configures the public SDK with the generated App ID; the SDK reads the installed extension's actual identity from `chrome.runtime.id`; the Publisher builds or publishes the integrated extension.
6. The Publisher registers the versioned `apppass.json`, public store version, and Distribution identity.
7. Apps Pass validates the declaration and observes a successful SDK connection from the accepted App/runtime pair. A verified connection makes the App catalog- and linking-eligible; failed or absent connections remain visible as not connected.
8. The Operator may suspend an App at any time. Runtime-identity changes require a new declaration and connection verification.

The private-pilot admission path does not require source code, an extension ZIP, implementation inspection, or proof that local premium behavior honors `inactive`. Apps Pass guarantees its own entitlement decision and Publisher-earning eligibility, not control of arbitrary code already installed in a Subscriber's browser.

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

The staging MVP ends at the correctly attributed Publisher Earning. It must show that no Publisher Payment has been recorded and must not claim that money reached the Publisher.

During the first controlled real-Publisher settlement, SERP completes payment outside Apps Pass using the separately agreed Publisher payment method. The Operator may then record one immutable, idempotent Publisher Payment containing the exact Earning amount, method, completion time, and opaque provider confirmation reference. Apps Pass never stores bank credentials, payment-account credentials, or a Publisher email address as the payment reference. Recording evidence never initiates money movement.

## 4. Product surfaces

### Public and Subscriber

- `/` — public Pass explanation, Subscriber journey, approved-App preview, and clear entry points.
- `/apps` — public catalog of approved Apps and their availability.
- `/account` — sign-in, Checkout entry, normalized Subscription status, and billing-portal entry.
- `/activate/[requestId]` — authenticated App-link approval or denial.

### Invited Publisher

- `/submit` — public Publisher Application plus an explanation of product review, onboarding, integration verification, and payment.
- `/docs` — public private-pilot integration guide with SDK and manifest examples.
- `/publisher/invitation` — authenticated one-time onboarding acceptance available only after preliminary Application acceptance.
- `/publisher` — integration declaration, connection status, App status, Earnings, and recorded Publisher Payment status.

Applications are public; technical onboarding and the Publisher area are private. Applying never self-grants Publisher authority.

### Operator

A protected CLI or minimal protected form is sufficient for Application decisions, one-time invitation delivery, connection inspection, App suspension, session revocation, allocation posting, completed-payment recording, and reconciliation. There is no polished Operator dashboard requirement.

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
- Publisher Applications, preliminary decisions, Operator invitations, and role assignments;
- Publishers and Publisher Memberships;
- integration declarations, connection-verification evidence, Apps, and Distributions;
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
- Rate-limit public Applications and keep applicant data unavailable to other applicants and Publishers.
- Validate Publisher ownership evidence during product review and bind connection verification to the accepted App and browser runtime identity.
- Never embed platform, Stripe, or Publisher secrets in an extension.
- Store App-session tokens only as hashes and redact credentials, proof keys, account-link URLs, and personal/payment details from logs.
- Preserve an audit trail for App approval, suspension, allocation, Publisher Payment recording, and reconciliation.
- Treat Worker rollback and D1 migration/recovery as separate operations.

The detailed threat model is in [`docs/mvp/SECURITY.md`](./docs/mvp/SECURITY.md).

## 8. Observable acceptance criteria

The MVP is staging-complete only when all of the following have durable evidence:

1. The pinned Next.js/OpenNext/Better Auth/D1 combination runs on deployed Cloudflare staging.
2. Subscriber and accepted-Publisher human sessions survive Worker restarts and enforce roles.
3. A developer can apply without receiving Publisher authority; only a reasoned preliminary Operator acceptance generates identities and onboarding access.
4. An accepted Publisher can participate without a Stripe connected account or payment credentials stored in Apps Pass.
5. A real, independently built Chromium extension integrates the SDK in its own source, registers the standard manifest and Distribution, and proves a successful connection using the accepted App/runtime identity without prototype fixture enumeration.
6. A Subscriber completes Stripe test-mode hosted Checkout.
7. Signed, duplicate, delayed, and deliberately reordered webhook fixtures produce the correct normalized Subscription without double application.
8. The Subscriber approves the real extension and it receives `active` through its own App session.
9. Cancellation and failed renewal stop extending access; paid-through expiry produces `inactive`.
10. Cross-App token use, link replay, expired links, session revocation, and App suspension behave correctly.
11. The paid Invoice produces one Cash Receipt and a balanced, auditable Allocation Run.
12. The Publisher sees the correctly attributed accrued Earning separately from settlement state, while staging contains no fabricated Publisher Payment or claim that money reached the Publisher.
13. Structured staging logs allow an Operator to trace the Application, reviews, Checkout, webhook, link, entitlement, allocation, and Earning using identifiers without exposing secrets or private packages.
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
- Automated Publisher/Application approval or automatic catalog inclusion.
- Source, ZIP, dependency, malware, reproducible-build, or implementation review. Those may be introduced later by an approved risk policy.
- Certification that a Publisher's locally implemented features honor the Apps Pass entitlement response. The MVP verifies the platform decision and connection only.
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
