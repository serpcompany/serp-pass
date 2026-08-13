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
  app-pass-sdk/                compiled extension-facing client and Entitlement contract
  app-pass-contracts/          versioned App Submission schema and validator

docs/
  mvp/                         binding delivery, money, security, operations
  prototype/                   completed local-proof evidence
  research/                    primary-source platform research
```

Neither package may expose internal database or Stripe types. `app-pass-contracts` owns the public Submission document. `app-pass-sdk` owns the extension-facing Entitlement response and is packed as self-contained JavaScript plus TypeScript declarations.

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

Implemented Slice 3 flow:

```mermaid
sequenceDiagram
    participant O as SERP Operator
    participant W as Apps Pass Worker
    participant P as Invited Publisher
    participant D as Staging D1
    participant E as Publisher extension

    O->>W: Create email-bound invitation and assign public IDs
    W->>D: Publisher, App Assignment, hashed invitation
    P->>W: Accept invitation and submit apppass.json plus evidence
    W->>D: Validate canonical contract and store pending Submission
    O->>W: Approve or reject with review reason
    W->>D: Create approved App and Distribution only on approval
    E->>W: Present App ID and chrome.runtime.id
    W->>D: Read approved canonical identity
    W-->>E: Approved identity or not found
```

The Submission contract lives in `packages/app-pass-contracts`. It contains the JSON Schema, generated Worker-safe validator, canonicalization, and public manifest types. The extension client lives in `packages/app-pass-sdk`; its packed `0.1.0` pilot artifact has no runtime or workspace dependency. The real pilot integration lives in `apps/invited-publisher-extension`; its public Chrome manifest key stabilizes `chrome.runtime.id`, while its `apppass.json` binds that runtime identity to the Operator-issued App and Publisher IDs. None of these public artifacts contains a secret.

The monorepo reference extension uses a workspace link for live development. That is not the distribution proof. A separate clean-project check packs the SDK, installs the tarball with npm, imports its compiled module, exercises the public client, and bundles an extension entry without monorepo resolution. The SDK remains non-publishable until the Operator chooses and approves a registry; a pilot Publisher receives the exact tarball and checksum privately.

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

Implemented Slice 5 flow:

```mermaid
sequenceDiagram
    participant E as Publisher extension
    participant W as Apps Pass Worker
    participant S as Subscriber browser
    participant D as Environment D1

    E->>W: App ID + runtime ID + installation ID + proof challenge
    W->>D: Verify approved Distribution; store expiring request
    W-->>E: Activation URL
    S->>W: Open URL with Better Auth session
    W-->>S: Canonical Publisher and App identity
    S->>W: Approve or deny
    W->>D: Bind decision to Subscriber
    E->>W: Exchange one-time proof key
    W->>D: Create App Link and hashed, scoped App Session
    E->>W: Check using opaque token + App/runtime claims
    W->>D: Read session, App, Distribution, and paid-through Subscription
    W-->>E: active / inactive / revoked / unauthenticated / temporarily unavailable
```

The extension request must originate from the exact `chrome-extension://<runtime-id>` origin registered in the approved Distribution. The activation page is a human Better Auth surface; its cookies never enter the extension. The App-session token is returned once to the extension and stored only as a SHA-256 hash in D1. A Checkout redirect never affects this decision: only the normalized environment-specific `entitled_until` projection can produce `active`.

### Earnings ledger

Interface:

- record a paid Cash Receipt exactly once;
- post one balanced Allocation Run;
- release an eligible Publisher Earning;
- reconcile Transfer, reversal, and Payout events.

The module hides immutable ledger entries, balance validation, hold rules, Stripe idempotency keys, and correction entries. Stripe executes money movement but does not calculate Publisher earnings.

### Connect readiness projection

The Connect boundary consumes signature-verified `account.updated` Events and stores only operational readiness fields: Account identity, mode, details-submitted state, charges enabled, transfers capability, payouts enabled, due-requirement count, and disabled reason. It does not store KYC answers or raw webhook bodies.

```mermaid
sequenceDiagram
    participant P as Invited Publisher
    participant S as Stripe-hosted onboarding
    participant W as Apps Pass Worker
    participant D as Environment D1

    P->>W: Request or resume onboarding
    W->>S: Create/reuse Express Account and one-time Account Link
    S-->>P: Hosted onboarding
    P->>W: Return or refresh redirect
    Note over W: Redirect alone never marks readiness
    S->>W: Signed account.updated Event
    W->>D: Replay-safe, monotonic readiness projection
    P->>W: Load private Publisher area
    W-->>P: Onboarding, charges, transfers, payouts, requirements
```

Only the Event projection is implemented before Stripe approval. Account creation and Account Link generation remain behind the exact-account guard and require a separately authorized test-mode integration.

## Request surfaces

The exact route filenames may follow Next.js conventions, but the externally meaningful surfaces are:

- Better Auth handlers for human sessions;
- `POST /api/billing/checkout`;
- `POST /api/billing/portal`;
- `POST /api/stripe/webhook` using the raw body;
- `POST /api/stripe/connect-webhook` using the raw body and its distinct signing secret;
- `POST /api/publisher/submissions`;
- `POST /api/publisher/connect/onboarding`;
- `POST /api/app-pass/link-requests`;
- `POST /api/app-pass/link-requests/:id/exchange`;
- authenticated `/activate/:id` approval and denial;
- `POST /api/app-pass/entitlements/check`;
- protected Operator use cases exposed primarily through the CLI.
- `POST /api/operator/allocations` and `POST /api/operator/settlements` as protected same-origin Operator use cases.

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
