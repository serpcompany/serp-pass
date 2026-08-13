# SERP Apps Pass

This repository currently asks one narrow question: can a compatible Chromium extension be submitted, validated, registered, linked, and entitled without changing authority code, migrations, or seed data?

The binding contract is the corrective [extension-inclusion proof PRD](./PRD.md). Its exact acceptance sequence and authority-freeze rule are in [docs/prototype/PLAN.md](./docs/prototype/PLAN.md). Earlier launchable-product ideas are preserved under [docs/product/](./docs/product/) as non-binding historical intent.

## Current status

Corrective documentation setup is in progress on `prototype/apps-pass-integration-proof`, based directly on `fe65faa`. Implementation has not started on this branch.

## Proof interface

Every participating extension must enter through:

```sh
pnpm operator:import-app <path-to-apppass.json>
```

Migrations contain schema only. The trusted Operator import validates the versioned manifest, registers the assigned public Publisher and App identities atomically, and constitutes approval for this prototype. The decisive test is a third extension created only after the authority and migrations are frozen.

## Documents

- [PRD.md](./PRD.md) — binding extension-inclusion proof contract.
- [docs/prototype/PLAN.md](./docs/prototype/PLAN.md) — binding execution order, acceptance sequence, and freeze rule.
- [CONTEXT.md](./CONTEXT.md) — current actors, terminology, and domain boundary.
- [docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md) — preserved, non-binding launchable-product intent.
- [AGENTS.md](./AGENTS.md) — short instructions for contributors and coding agents.
