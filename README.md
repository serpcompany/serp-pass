# SERP Apps Pass private-pilot MVP

This branch converts the completed extension-inclusion proof into a minimal, trustworthy private-pilot product: invited Publisher submission, real Subscriber purchase, authenticated App activation, entitlement, auditable Publisher Earning, and Operator-controlled Stripe Connect settlement.

The target and acceptance boundary are in [PRD.md](./PRD.md). The architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md), delivery order in [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md), money invariants in [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md), and threats in [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md).

The completed proof remains executable local software, not a visual mockup, but it is not the launchable subscription product. Its PRD, architecture, freeze, evaluation, and plan are preserved under [docs/prototype/](./docs/prototype/).

Implementation is in progress on `mvp/private-pilot`. Slices 1–3 are deployed at [serp-apps-pass-staging.serpcompany.workers.dev](https://serp-apps-pass-staging.serpcompany.workers.dev): one Next.js/OpenNext Worker, an isolated staging D1 database, reviewed migrations, Better Auth roles, authenticated Publisher submission and review, a public manifest contract, and a real independently built extension recognized by its approved runtime identity. Production has not been deployed. Stripe is deliberately unconfigured: no account, credentials, Product, Price, webhook, Checkout, Connect account, or payment has been created or selected.

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
pnpm mvp:extension:build
pnpm mvp:extension:test
pnpm mvp:extension:test-staging
```

The staging inclusion command performs the one-time real Publisher journey when needed and is read-only/repeatable after approval. It never contacts Stripe.

The exact Publisher handoff, including what the IDs and JSON file mean, is in [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md).

The account-independent Subscriber billing projection can be exercised locally without any Stripe account:

```sh
pnpm mvp:billing:test
```

This uses a local-only signed fixture boundary, not Stripe. Its exact authority rules and remaining sandbox work are documented in [docs/mvp/BILLING_PROJECTION.md](./docs/mvp/BILLING_PROJECTION.md).

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

## Local walkthrough

This is a disposable local proof. It uses local Wrangler D1 state and a project-owned Chromium profile; it does not contact preview or production infrastructure.

Install dependencies, build every discovered extension, reset the disposable database, and apply the schema-only migration:

```sh
pnpm install
pnpm extensions:build
pnpm db:reset
pnpm db:migrate
```

Start the local authority Worker in one terminal and leave it running:

```sh
pnpm operator:serve
```

In another terminal, import all three manifests through the identical interface and activate the deterministic local Subscription:

```sh
pnpm operator:import-app examples/serp-reference/apppass.json
pnpm operator:import-app examples/invited-publisher-reference/apppass.json
pnpm operator:import-app examples/post-freeze-reference/apppass.json
pnpm operator:activate-local-subscription
pnpm operator:state
```

Inspect the project browser before starting it, as the status command distinguishes a reusable owner from a stopped browser:

```sh
pnpm dev:browser:status
pnpm dev:browser
```

The default browser is headless for automation. For a visible manual session, stop only the recorded project owner and restart with the supported override:

```sh
pnpm dev:browser:stop
EXTENSION_DEV_HEADLESS=0 pnpm dev:browser
pnpm dev:browser:open -- chrome-extension://jgbkpnjlggkmeoomfpdjfmfjcdfdmjcl/popup.html
```

Select the opened extension tab if it is not already selected. In the popup:

1. Select **Begin link** and copy the displayed request ID.
2. Approve it from the second terminal:

   ```sh
   pnpm operator:approve-link <request-id>
   ```

3. Select **Finish link**.
4. Select **Check access** and confirm the result is `{"status":"active","features":["premium"]}`.

The single automated browser proof command resets local D1, migrates it, imports every discovered manifest, activates the local Subscription, and exercises every loaded extension:

```sh
pnpm proof:browser
```

Run the complete verification suite, typechecking, and diff validation with:

```sh
pnpm proof:test && pnpm typecheck && git diff --check
```

Stop the Worker with `Ctrl-C` in its terminal. Stop only the project-owned browser and optionally delete the disposable local database state with:

```sh
pnpm dev:browser:stop
pnpm db:reset
```

The browser profile is preserved when stopped. D1 records, browser state, generated extension output, and other local runtime artifacts are ignored and disposable.

## Current documents

- [PRD.md](./PRD.md) — binding private-pilot outcome and acceptance criteria.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target system, modules, trust domains, and environment path.
- [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md) — binding vertical-slice order and promotion gates.
- [docs/mvp/MONEY_MODEL.md](./docs/mvp/MONEY_MODEL.md) — earnings-ledger and settlement invariants.
- [docs/mvp/SECURITY.md](./docs/mvp/SECURITY.md) — threat model and required evidence.
- [docs/mvp/PUBLISHER_INTEGRATION.md](./docs/mvp/PUBLISHER_INTEGRATION.md) — the concrete extension integration and Submission handoff.
- [docs/mvp/BILLING_PROJECTION.md](./docs/mvp/BILLING_PROJECTION.md) — replay-safe paid-through projection and the explicit Stripe-adapter boundary.
- [docs/research/SETAPP_PRODUCT_REFERENCE.md](./docs/research/SETAPP_PRODUCT_REFERENCE.md) — non-binding reference for bundle positioning, website structure, branding patterns, and later pricing experiments.
- [CONTEXT.md](./CONTEXT.md) — canonical domain language.
- [docs/prototype/](./docs/prototype/) — preserved local proof contract, architecture, freeze, plan, and evaluation.
- [docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md) — preserved, non-binding launchable-product intent.
- [AGENTS.md](./AGENTS.md) — instructions for contributors and coding agents.
- [examples/README.md](./examples/README.md) — what the example extension submissions represent.
- [tests/README.md](./tests/README.md) — what the proof tests do and do not establish.
