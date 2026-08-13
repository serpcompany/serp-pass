# SERP Apps Pass private-pilot architecture

Status: **target MVP architecture; implementation in progress**

This architecture deliberately keeps one deployable application while separating four trust domains: human identity, App inclusion, Subscriber entitlement, and Publisher money. The interfaces between them are explicit because confusing their states is a financial or access-control bug.

## System map

```mermaid
flowchart LR
    Subscriber["Subscriber browser"]
    Publisher["Invited Publisher browser"]
    Extension["Publisher-owned Chromium extension"]
    Operator["Protected Operator CLI"]
    App["Next.js / OpenNext Worker"]
    D1[("Environment-specific D1")]
    Billing["Stripe Billing"]
    Connect["Stripe Connect Express"]
    Logs["Cloudflare Workers Logs"]

    Subscriber -->|"human session, Checkout, activation"| App
    Publisher -->|"human session, manifest, onboarding"| App
    Extension -->|"App session, entitlement"| App
    Operator -->|"review, allocation, release"| App
    App --> D1
    App -->|"Checkout and Portal"| Billing
    Billing -->|"signed webhooks"| App
    App -->|"hosted onboarding and Transfers"| Connect
    Connect -->|"account, transfer, payout events"| App
    App --> Logs
```

There is one Worker deployment, not a collection of microservices. Internal modules remain separate because they own different invariants; they do not require separate network services.

## Repository target

```text
apps/
  web/                         Next.js App Router and OpenNext Worker
    app/                       pages and route handlers
    src/
      auth/                    human identity and roles
      apps/                    submissions, approval, distributions
      billing/                 Stripe event projection
      entitlements/            linking, App sessions, decisions
      earnings/                receipts, allocations, ledger, transfers
      operator/                protected use cases
      db/                      D1 client and schema composition

packages/
  app-pass-sdk/                extension-facing SDK
  app-pass-contracts/          only public versioned contracts shared by web and SDK

docs/
  mvp/                         binding delivery, money, security, operations
  prototype/                   completed local-proof evidence
  research/                    primary-source platform research
```

`app-pass-contracts` should exist only for genuinely public shared types such as the manifest and entitlement response. Internal database or Stripe types must not leak into it.

## Domain state flow

```mermaid
flowchart TD
    Event["Verified Stripe Event"] --> Projection["Billing projection"]
    Projection --> Receipt["Paid Cash Receipt"]
    Projection --> Subscription["Normalized Subscription with entitled_until"]
    Subscription --> Decision["Entitlement decision"]
    Receipt --> Allocation["Posted Allocation Run"]
    Allocation --> Earning["Publisher Earning"]
    Earning -->|"hold passed + Operator release"| Transfer["Stripe Transfer"]
    Transfer --> Payout["Observed connected-account Payout"]
```

The following are intentionally not synonyms:

- A successful Checkout redirect is not a paid Invoice.
- A paid Invoice is not directly an entitlement decision; it extends normalized paid-through state.
- A Cash Receipt is not a Publisher Earning until an Allocation Run is posted.
- A Publisher Earning is not a Stripe Transfer until deliberately released.
- A Stripe Transfer to a connected account is not a bank Payout.

## Deep module interfaces

### App inclusion

Interface:

- submit a complete versioned manifest;
- approve or reject a Submission;
- read the approved App and Distribution identity.

The module hides whole-document validation, ID assignment rules, ownership evidence, conflict detection, atomic writes, and audit events.

### Billing projection

Interface:

- ingest one raw, signature-verified Stripe Event;
- return whether it was newly applied, previously applied, or deliberately ignored;
- read normalized Subscription state.

The module hides out-of-order reconciliation, Stripe object mapping, idempotency, and paid-through transitions. Entitlement callers never receive Stripe objects.

### Entitlement authority

Interface:

- begin a proof-bound link;
- approve or deny it as an authenticated Subscriber;
- exchange it once for an App session;
- check access;
- revoke a session or suspend an App.

The module hides proof storage, token hashing, App/Distribution validation, Subscription lookup, and public decision mapping.

### Earnings ledger

Interface:

- record a paid Cash Receipt exactly once;
- post one balanced Allocation Run;
- release an eligible Publisher Earning;
- reconcile Transfer, reversal, and Payout events.

The module hides immutable ledger entries, balance validation, hold rules, Stripe idempotency keys, and correction entries. Stripe executes money movement but does not calculate Publisher earnings.

## Request surfaces

The exact route filenames may follow Next.js conventions, but the externally meaningful surfaces are:

- Better Auth handlers for human sessions;
- `POST /api/billing/checkout`;
- `POST /api/billing/portal`;
- `POST /api/stripe/webhook` using the raw body;
- `POST /api/publisher/submissions`;
- `POST /api/publisher/connect/onboarding`;
- `POST /api/app-pass/link-requests`;
- `POST /api/app-pass/link-requests/:id/exchange`;
- authenticated `/activate/:id` approval and denial;
- `POST /api/app-pass/entitlements/check`;
- protected Operator use cases exposed primarily through the CLI.

## Human and App credentials

Human sessions and App sessions are separate credential systems:

| Credential | Represents | Stored by client | Server storage | Used for |
| --- | --- | --- | --- | --- |
| Better Auth session | Human user | Secure browser cookie | Better Auth session record | Subscriber, Publisher, Operator UI |
| App-session token | One linked App installation | `chrome.storage.local` | Hash only | Entitlement checks |
| Stripe secret | SERP platform | Never in browsers/extensions | Cloudflare secret | Server-to-Stripe calls |

No App-session token grants access to human pages, and no human session cookie is embedded in an extension.

## Environments and promotion

```mermaid
flowchart LR
    Local["Local workerd + local D1 + Stripe fixtures"] --> Staging["Cloudflare staging + staging D1 + Stripe test mode"]
    Staging -->|"explicit live gate"| Production["Cloudflare production + production D1 + Stripe live mode"]
```

- Local, staging, and production use different databases and secrets.
- Stripe test and live identifiers are never stored together.
- Next development-server success is insufficient; every slice must pass OpenNext/workerd preview.
- Staging deployment is required for the exact Better Auth cookie, D1 binding, Stripe webhook, and extension-host-permission composition.
- Production is never an implicit consequence of merging or passing staging tests during the private pilot.

## Prototype reuse boundary

Candidates for deliberate porting:

- manifest schema and importer semantics;
- proof-bound linking;
- opaque, hashed, App-scoped sessions;
- explicit entitlement states;
- generic Chromium SDK interface;
- D1 domain concepts and focused proof scenarios.

Must be replaced rather than relabeled:

- hard-coded Subscriber and active Subscription;
- unauthenticated Operator HTTP routes;
- local approval commands acting as Subscriber UX;
- prototype explanatory Worker page;
- shared example-extension popup shell;
- local fixture identities and local browser lifecycle as product code;
- proof tests presented as production coverage.

## Operational minimum

- Structured events for auth failures, App review, Stripe ingestion, normalized Subscription transitions, link exchange, entitlement errors, Allocation posting, Transfer creation, reversals, and reconciliation.
- Stable correlation identifiers without logging tokens, secrets, proof keys, account-link URLs, or payment/identity payloads.
- D1 migration, Time Travel/recovery, Stripe reconciliation, Transfer retry, App suspension, and credential-rotation runbooks.
- Native Cloudflare Workers Logs and modest tracing are sufficient initially. Sentry is not a prerequisite.

See [`docs/mvp/SECURITY.md`](./docs/mvp/SECURITY.md), [`docs/mvp/MONEY_MODEL.md`](./docs/mvp/MONEY_MODEL.md), and [`docs/mvp/DELIVERY_PLAN.md`](./docs/mvp/DELIVERY_PLAN.md).
