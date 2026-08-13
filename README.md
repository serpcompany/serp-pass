# SERP Apps Pass

This repository answers one narrow question: can a compatible Chromium extension be submitted, validated, registered, linked, and entitled without changing authority code, migrations, or seed data?

The local extension-inclusion proof passed. A third extension created after the authority freeze entered through the same manifest importer, loaded through the same generic browser harness, linked through the shared SDK, and received an active entitlement from the existing local Subscription. Cloudflare preview and production were not attempted.

The binding contract is the [extension-inclusion proof PRD](./PRD.md). The acceptance sequence is in [docs/prototype/PLAN.md](./docs/prototype/PLAN.md), the immutable evidence boundary is in [docs/prototype/FREEZE.md](./docs/prototype/FREEZE.md), and the results are in [docs/prototype/EVALUATION.md](./docs/prototype/EVALUATION.md). Earlier launchable-product ideas under [docs/product/](./docs/product/) remain non-binding historical intent.

## Proof interface

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
pnpm phase2:browser-acceptance
```

Run the complete verification suite, typechecking, and diff validation with:

```sh
pnpm exec tsx --test --test-concurrency=1 --test-reporter=spec tests/*.test.ts && pnpm typecheck && git diff --check
```

Stop the Worker with `Ctrl-C` in its terminal. Stop only the project-owned browser and optionally delete the disposable local database state with:

```sh
pnpm dev:browser:stop
pnpm db:reset
```

The browser profile is preserved when stopped. D1 records, browser state, generated extension output, and other local runtime artifacts are ignored and disposable.

## Documents

- [PRD.md](./PRD.md) — binding extension-inclusion proof contract.
- [docs/prototype/PLAN.md](./docs/prototype/PLAN.md) — binding execution order and acceptance sequence.
- [docs/prototype/FREEZE.md](./docs/prototype/FREEZE.md) — frozen authority revision, migration checksum, and immutable scope.
- [docs/prototype/EVALUATION.md](./docs/prototype/EVALUATION.md) — observed proof results and architectural conclusion.
- [CONTEXT.md](./CONTEXT.md) — actors, terminology, and domain boundary.
- [docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md) — preserved, non-binding launchable-product intent.
- [AGENTS.md](./AGENTS.md) — instructions for contributors and coding agents.
