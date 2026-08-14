# SERP Apps Pass private-pilot MVP

This branch converts the completed extension-inclusion proof into a minimal, trustworthy private-pilot product: curated Publisher application and review, real Subscriber purchase, authenticated App activation, entitlement, and an auditable Publisher Earning. Paying a real Publisher is a controlled pilot operation after the staging MVP is confirmed.

The target and acceptance boundary are in [PRD.md](./PRD.md). The architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md), delivery order in [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md), current criterion-by-criterion evidence in [docs/mvp/ACCEPTANCE_MATRIX.md](./docs/mvp/ACCEPTANCE_MATRIX.md), money invariants in [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md), and threats in [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md).

**Trying the MVP as a human?** Start with [docs/mvp/HUMAN_EVALUATION_GUIDE.md](./docs/mvp/HUMAN_EVALUATION_GUIDE.md). It explains the roles, staged flow, exact pages, optional agent-assisted walkthrough, expected results, and a PASS/FAIL/UNCLEAR scorecard.

The completed proof remains executable local software, not a visual mockup, but it is not the launchable subscription product. Its PRD, architecture, freeze, evaluation, and plan are preserved under [docs/prototype/](./docs/prototype/).

Implementation is integrated on `main`. Curated Publisher Application/Product Acceptance, generated App identity, runtime connection verification, deployed Subscriber billing, real extension activation, paid-through entitlement, and two real-receipt `$7/$2/$1` test Allocations work on [serp-apps-pass-staging.serpcompany.workers.dev](https://serp-apps-pass-staging.serpcompany.workers.dev). The already-linked John Doe extension now receives `active` from a signed-event-derived Stripe test Subscription and has one accrued `$7` Publisher Earning. Stripe test account `acct_1MwbFJI9EPtyKcIs` (**SERP Pass**) handles Subscriber billing only. The local Operator/Publisher journey tests the optional immutable payment-recording boundary, but paying a fictional Publisher is not a staging gate. Connect is dormant post-MVP evidence. Production has not been created or deployed.

## Product surfaces

- `/` — public Pass overview and starting point
- `/apps` — real approved-App catalog
- `/submit` — public Publisher Application and curated admission process
- `/docs` — beginner-oriented extension integration guide
- `/account` — Subscriber sign-in, Subscription, and billing
- `/publisher` — authenticated integration, connection, Earning, and Payment workspace
- `/operator` — protected Product Acceptance, connection inspection, allocation, and payment controls

## MVP stack walkthrough

Install dependencies and apply the local D1 migrations:

```sh
pnpm install
pnpm mvp:db:migrate
```

For local Next development, copy `apps/web/.dev.vars.example` to the ignored `apps/web/.dev.vars`, replace the placeholder with `openssl rand -hex 32`, then run:

```sh
pnpm mvp:dev
```

For the production-shaped local workerd path, build and preview the OpenNext Worker. The preview also reads the ignored `.dev.vars` file:

```sh
pnpm --filter @serp-apps-pass/web build:worker
pnpm --filter @serp-apps-pass/web exec wrangler dev --port 8788 --persist-to ../../.wrangler/mvp-state
```

Open `http://localhost:8788/account` and create a disposable pilot account. The visible workflow creates a Better Auth user and human session in local D1, grants only the Subscriber role, survives a page reload, and signs out. It does not create a Subscription or contact Stripe.

Every new account starts as a Subscriber. To bootstrap the first trusted Operator, create that account through `/account`, then run exactly one environment-specific command:

```sh
pnpm mvp:operator:bootstrap -- --local operator@example.com
# or, deliberately against staging:
pnpm mvp:operator:bootstrap -- --staging operator@example.com
```

The command requires the trusted local shell or authenticated SERP Cloudflare CLI; there is no public bootstrap endpoint. A developer first applies at `/submit` with their contact, public listing, ownership attestation, product case, and permissions/privacy explanation. That Application grants no role or App authority. The Operator inspects it at `/operator` and either declines it or preliminarily accepts it. Acceptance—not the applicant—generates immutable Publisher and App IDs plus a one-time invitation code. The signed-in accepted Publisher enters that code at `/publisher/invitation`. Codes expire after seven days, are bound to the accepted email, are consumed once, and are stored only as hashes.

The Publisher then installs the supplied SDK, configures it with the generated App ID, rebuilds or publishes the extension, and registers its versioned `apppass.json`, public version, and Chromium Distribution identity from `/publisher`. The SDK reads the actual identity from `chrome.runtime.id`. Registration remains disconnected and catalog-ineligible until that exact extension origin calls `verifyConnection()`. A successful call creates durable connection evidence and makes the accepted App eligible for the catalog and Subscriber linking; no source/ZIP upload or second human technical approval is required or claimed by this MVP.

The real invited-Publisher source project is [`apps/invited-publisher-extension`](./apps/invited-publisher-extension/). Build and verify its actual unpacked Chromium package with:

```sh
pnpm mvp:contracts:test
pnpm mvp:sdk:test
pnpm mvp:extension:build
pnpm mvp:extension:test
pnpm mvp:extension:test-staging
```

The staging inclusion command performs the real Publisher integration/connection journey when needed and is read-only/repeatable after connection. It never contacts Stripe.

The exact Publisher handoff, including what the IDs and JSON file mean, is in [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md).

For a human-in-the-loop rehearsal, use the standalone [John Doe Focus Timer](./apps/john-doe-focus-timer-extension/) and paste the [fresh-agent walkthrough prompt](./docs/walkthroughs/JOHN_DOE_FRESH_AGENT_PROMPT.md) into a new task. The agent acts as the invited developer while you retain the Operator review decision and any optional Stripe test Checkout. This is a staged example of an external Publisher handoff, not evidence of an independent Publisher relationship.

The real activation/entitlement journey runs through the repo-owned extension browser and local workerd:

```sh
pnpm dev:browser:status
pnpm mvp:activation:test
```

The check leaves the shared browser running. The standalone extension test builds into a disposable directory, so it cannot overwrite the live dev-browser bundle or change its authority configuration. Together they prove a real extension-origin request, authenticated Subscriber approve/deny UX, one-time proof exchange, hash-only App-session storage, normalized paid-through decisions, cross-App rejection, expiry, scoped revocation, App suspension, relinking, and a truthful `temporarily_unavailable` state. Its paid-through setup is the local signed fixture boundary; it does not access Stripe or represent a real purchase.

The account-independent Subscriber billing and money boundaries can be exercised locally without any Stripe account:

```sh
pnpm mvp:billing:test
pnpm mvp:stripe-adapter:test
pnpm postmvp:connect:test
pnpm mvp:earnings:test
```

The first command uses the local normalized fixture boundary. The second uses Stripe's official SDK to generate and verify real Stripe-format signatures and current Event shapes without accessing an account. `postmvp:connect:test` preserves the dormant Connect projection experiment at its API and database boundaries; it is not an MVP dependency or active Publisher UI. `mvp:earnings:test` proves Allocation plus the optional local Publisher Payment recording boundary; only Allocation and accrued Earning are required for staging acceptance. None performs a Stripe API request.

The approved real-provider staging journey is deliberately separate:

```sh
pnpm mvp:stripe-checkout:test-staging
pnpm mvp:stripe-checkout:test-redirect-boundary
```

These commands create test-mode Customers and Subscriptions, use Stripe-hosted test Checkout and Portal, reconcile signed Events, and exercise the real extension. They require the isolated `serp-appspass` Stripe CLI profile and mutate only the documented sandbox. Exact resource IDs, evidence, credential expiry, and remaining gates are in [docs/mvp/STRIPE_SANDBOX_STATE.md](./docs/mvp/STRIPE_SANDBOX_STATE.md).

An authenticated Operator can inspect `/api/operator/billing/audit?subscriberUserId=<id>` to reconcile counts and obtain the allowlisted journey trace linking Checkout, billing, App-session, Allocation, Earning, and Publisher Payment records. The response includes `x-apps-pass-correlation-id`; search Workers Logs for the matching `operator_journey_trace` event. The trace never returns extension credentials, proof material, raw/payload hashes, idempotency keys, personal email, hosted URLs, installation identifiers, payment credentials, or KYC data.

Run the automated rendered-browser journey against a running local preview or the deployed staging Worker:

```sh
pnpm --filter @serp-apps-pass/web test:auth-browser
APP_ORIGIN=https://serp-apps-pass-staging.serpcompany.workers.dev pnpm --filter @serp-apps-pass/web test:auth-browser
APP_ORIGIN=https://serp-apps-pass-staging.serpcompany.workers.dev pnpm --filter @serp-apps-pass/web test:publisher-boundary
APP_ORIGIN=https://serp-apps-pass-staging.serpcompany.workers.dev pnpm --filter @serp-apps-pass/web test:operator-bootstrap
APP_ORIGIN=https://serp-apps-pass-staging.serpcompany.workers.dev pnpm --filter @serp-apps-pass/web test:auth-rate-limit
```

Current environment evidence and known limitations are recorded in [docs/mvp/STATUS.md](./docs/mvp/STATUS.md).

## Preserved proof walkthrough

Every participating extension enters through:

```sh
pnpm operator:import-app <path-to-apppass.json>
```

Migrations contain schema only. The trusted Operator import validates the versioned manifest, registers the assigned public Publisher and App identities atomically, and constitutes approval for this prototype.

## Historical proof

The disposable pre-MVP authority, example submissions, and contract tests remain under `src/`, `scripts/`, `examples/`, and `tests/*.proof.test.ts` as historical evidence. They are not the current application, SDK integration, or browser topology. Their design contract is preserved in [`docs/prototype/PRD.md`](./docs/prototype/PRD.md).

`pnpm proof:test` runs the still-relevant importer, entitlement, and generic discovery contracts. The retired multi-fixture Chromium topology is isolated behind `pnpm proof:test:historical-browser`; it is not expected to run while the repo-owned browser is configured for the real MVP Publisher extension.

## Current documents

- [PRD.md](./PRD.md) — binding private-pilot outcome and acceptance criteria.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target system, modules, trust domains, and environment path.
- [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md) — binding vertical-slice order and promotion gates.
- [docs/mvp/ACCEPTANCE_MATRIX.md](./docs/mvp/ACCEPTANCE_MATRIX.md) — PRD criteria mapped to passed, partial, and externally blocked evidence.
- [docs/mvp/HUMAN_EVALUATION_GUIDE.md](./docs/mvp/HUMAN_EVALUATION_GUIDE.md) — human walkthrough and evaluation scorecard for deployed staging.
- [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md) — earnings-ledger and settlement invariants.
- [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md) — threat model and required evidence.
- [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md) — the concrete extension integration and Submission handoff.
- [docs/mvp/BILLING_PROJECTION.md](./docs/mvp/BILLING_PROJECTION.md) — replay-safe paid-through projection and the explicit Stripe-adapter boundary.
- [docs/mvp/STRIPE_SANDBOX_APPROVAL.md](./docs/mvp/STRIPE_SANDBOX_APPROVAL.md) — approved test-mode billing actions, exact-account guard, validation, and rollback.
- [docs/mvp/STRIPE_SANDBOX_STATE.md](./docs/mvp/STRIPE_SANDBOX_STATE.md) — current test objects, real-provider evidence, credential boundary, and known failed acceptance artifact.
- [docs/mvp/STRIPE_CONNECT_APPROVAL.md](./docs/mvp/STRIPE_CONNECT_APPROVAL.md) — superseded Connect experiment packet retained as post-MVP history.
- [docs/mvp/D1_MIGRATIONS.md](./docs/mvp/D1_MIGRATIONS.md) — reviewed staging migration procedure and the bounded trigger-rich migration fallback.
- [docs/mvp/D1_RECOVERY.md](./docs/mvp/D1_RECOVERY.md) — destructive Time Travel guardrails and the disposable remote recovery rehearsal.
- [docs/research/SETAPP_PRODUCT_REFERENCE.md](./docs/research/SETAPP_PRODUCT_REFERENCE.md) — non-binding reference for bundle positioning, website structure, branding patterns, and later pricing experiments.
- [CONTEXT.md](./CONTEXT.md) — canonical domain language.
- [docs/prototype/](./docs/prototype/) — preserved local proof contract, architecture, freeze, plan, and evaluation.
- [docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md) — preserved, non-binding launchable-product intent.
- [AGENTS.md](./AGENTS.md) — instructions for contributors and coding agents.
- [examples/README.md](./examples/README.md) — what the example extension submissions represent.
- [tests/README.md](./tests/README.md) — what the proof tests do and do not establish.
