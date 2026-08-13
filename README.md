# SERP Apps Pass private-pilot MVP

This branch converts the completed extension-inclusion proof into a minimal, trustworthy private-pilot product: invited Publisher submission, real Subscriber purchase, authenticated App activation, entitlement, auditable Publisher Earning, and Operator-controlled Stripe Connect settlement.

The target and acceptance boundary are in [PRD.md](./PRD.md). The architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md), delivery order in [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md), current criterion-by-criterion evidence in [docs/mvp/ACCEPTANCE_MATRIX.md](./docs/mvp/ACCEPTANCE_MATRIX.md), money invariants in [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md), and threats in [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md).

The completed proof remains executable local software, not a visual mockup, but it is not the launchable subscription product. Its PRD, architecture, freeze, evaluation, and plan are preserved under [docs/prototype/](./docs/prototype/).

Implementation is in progress on `mvp/private-pilot`. Slices 1–3 and the bounded, inert staging foundations for Subscriber billing, extension activation, Connect readiness, and earnings allocation are deployed at [serp-apps-pass-staging.serpcompany.workers.dev](https://serp-apps-pass-staging.serpcompany.workers.dev). The system uses one Next.js/OpenNext Worker, an isolated staging D1 database, reviewed migrations, Better Auth roles, authenticated Publisher submission and review, a public manifest contract, and a real independently built extension recognized by its approved runtime identity. Production has not been deployed. Stripe account `acct_1MwbFJI9EPtyKcIs`, currently named **SERP Pass**, is the intended isolated sandbox, but it has not been accessed or configured. No credentials, Product, Price, webhook, Checkout, Connect account, or payment exists; account selection is not mutation approval.

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

The command requires the trusted local shell or authenticated SERP Cloudflare CLI; there is no public bootstrap endpoint. Visit `/operator`, enter the intended Publisher email, Operator-issued Publisher ID and first App ID, and copy the returned invitation code once. The signed-in Publisher enters it at `/publisher/invitation`. Codes expire after seven days, are bound to that email, are consumed once, and are stored only as hashes.

The Publisher then submits the complete `apppass.json` plus ownership evidence from `/publisher`. The Operator records a review reason and approves or rejects it from `/operator`. Approval—not submission—creates the canonical App and Distribution used by the authority.

The real invited-Publisher source project is [`apps/invited-publisher-extension`](./apps/invited-publisher-extension/). Build and verify its actual unpacked Chromium package with:

```sh
pnpm mvp:contracts:test
pnpm mvp:sdk:test
pnpm mvp:extension:build
pnpm mvp:extension:test
pnpm mvp:extension:test-staging
```

The staging inclusion command performs the one-time real Publisher journey when needed and is read-only/repeatable after approval. It never contacts Stripe.

The exact Publisher handoff, including what the IDs and JSON file mean, is in [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md).

The real activation/entitlement journey runs through the repo-owned extension browser and local workerd:

```sh
pnpm dev:browser:status
pnpm mvp:activation:test
```

The check leaves the shared browser running. The standalone extension test builds into a disposable directory, so it cannot overwrite the live dev-browser bundle or change its authority configuration. Together they prove a real extension-origin request, authenticated Subscriber approve/deny UX, one-time proof exchange, hash-only App-session storage, normalized paid-through decisions, cross-App rejection, expiry, scoped revocation, App suspension, relinking, and a truthful `temporarily_unavailable` state. Its paid-through setup is the local signed fixture boundary; it does not access Stripe or represent a real purchase.

The account-independent Subscriber billing projection can be exercised locally without any Stripe account:

```sh
pnpm mvp:billing:test
pnpm mvp:stripe-adapter:test
pnpm mvp:connect:test
pnpm mvp:earnings:test
```

The first command uses the local normalized fixture boundary. The second uses Stripe's official SDK to generate and verify real Stripe-format signatures and current Event shapes without accessing an account. Neither performs a Stripe API request. The exact authority rules and remaining sandbox work are documented in [docs/mvp/BILLING_PROJECTION.md](./docs/mvp/BILLING_PROJECTION.md).

An authenticated Operator can inspect `/api/operator/billing/audit?subscriberUserId=<id>` to reconcile counts and obtain the allowlisted journey trace linking Checkout, billing, App-session, Allocation, Earning, Settlement, and Transfer records. The response includes `x-apps-pass-correlation-id`; search Workers Logs for the matching `operator_journey_trace` event. The trace never returns extension credentials, proof material, raw/payload hashes, idempotency keys, personal email, hosted URLs, installation identifiers, or payment/KYC data.

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
- [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md) — earnings-ledger and settlement invariants.
- [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md) — threat model and required evidence.
- [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md) — the concrete extension integration and Submission handoff.
- [docs/mvp/BILLING_PROJECTION.md](./docs/mvp/BILLING_PROJECTION.md) — replay-safe paid-through projection and the explicit Stripe-adapter boundary.
- [docs/mvp/STRIPE_SANDBOX_APPROVAL.md](./docs/mvp/STRIPE_SANDBOX_APPROVAL.md) — approved test-mode billing actions, exact-account guard, validation, and rollback.
- [docs/mvp/STRIPE_CONNECT_APPROVAL.md](./docs/mvp/STRIPE_CONNECT_APPROVAL.md) — bounded approval and remaining inputs for Express onboarding, connected webhooks, one test Transfer, and reversal.
- [docs/mvp/D1_MIGRATIONS.md](./docs/mvp/D1_MIGRATIONS.md) — reviewed staging migration procedure and the bounded trigger-rich migration fallback.
- [docs/mvp/D1_RECOVERY.md](./docs/mvp/D1_RECOVERY.md) — destructive Time Travel guardrails and the disposable remote recovery rehearsal.
- [docs/research/SETAPP_PRODUCT_REFERENCE.md](./docs/research/SETAPP_PRODUCT_REFERENCE.md) — non-binding reference for bundle positioning, website structure, branding patterns, and later pricing experiments.
- [CONTEXT.md](./CONTEXT.md) — canonical domain language.
- [docs/prototype/](./docs/prototype/) — preserved local proof contract, architecture, freeze, plan, and evaluation.
- [docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md) — preserved, non-binding launchable-product intent.
- [AGENTS.md](./AGENTS.md) — instructions for contributors and coding agents.
- [examples/README.md](./examples/README.md) — what the example extension submissions represent.
- [tests/README.md](./tests/README.md) — what the proof tests do and do not establish.
