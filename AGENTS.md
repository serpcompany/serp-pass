# Repository guidance

Read [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [CONTEXT.md](./CONTEXT.md) before changing this repository.

This repository contains a **disposable local integration proof**, not a production Apps Pass implementation. The proof has already passed; [PRD.md](./PRD.md), [docs/prototype/PLAN.md](./docs/prototype/PLAN.md), [docs/prototype/FREEZE.md](./docs/prototype/FREEZE.md), and [docs/prototype/EVALUATION.md](./docs/prototype/EVALUATION.md) preserve the question, method, evidence boundary, and result.

- Keep prototype-only mechanisms visibly labeled. Do not present local Operator routes, the deterministic Subscriber or Subscription, the example-extension shell, or the proof tests as production-ready code.
- Treat `apppass.json`, `pnpm operator:import-app <path>`, and `@serp-apps-pass/sdk` as the three demonstrated interfaces.
- Keep migrations schema-only and never embed platform or Publisher secrets in extensions.
- Treat runtime IDs as public allowlist identities, not credentials.
- Do not add Stripe, authentication, Publisher self-service, payouts, or deployment merely to make the proof look more complete. Those require a new product decision.
- Report local validation, Cloudflare preview, and production separately.

## Project-owned browser

- Run `pnpm dev:browser:status` before browser automation.
- Reuse the project-owned browser recorded under `.extension-dev-browser/`; do not launch a competing persistent browser.
- Extension outputs are discovered generically under `examples/*/dist`.
- Stop only the recorded owner PID with `pnpm dev:browser:stop`.
