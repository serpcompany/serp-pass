# Repository guidance

Read [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTEXT.md](./CONTEXT.md), and [docs/mvp/DELIVERY_PLAN.md](./docs/mvp/DELIVERY_PLAN.md) before planning or changing this branch.

The current branch builds a trustworthy private-pilot MVP. The completed local proof is historical evidence under `docs/prototype/`; do not relabel its fake Subscriber, deterministic Subscription, unauthenticated Operator routes, example popup shell, browser harness, or proof tests as production mechanisms.

- Follow the delivery slices in order. A created table, endpoint, or mocked test does not complete a slice.
- Treat exact-package/R2 review as a historical optional experiment. The binding MVP admits an accepted product after SDK connection verification and does not certify Publisher code or local feature enforcement.
- Keep human sessions and App sessions separate.
- Treat Checkout redirects as UX only; verified Stripe events project billing authority into D1.
- Keep Cash Receipt, Publisher Earning, Publisher Payment, historical Stripe Transfer, and bank Payout distinct.
- Never automate an allocation formula or Publisher payment policy that the PRD leaves for explicit approval.
- Keep local, staging, and production D1/Stripe state physically separate.
- Never embed or log platform secrets, App-session tokens, proof keys, account-link URLs, raw webhooks, or sensitive payment/identity data.
- Use reviewed SQL migrations and report local Next, local workerd preview, deployed staging, and production independently.
- Do not deploy production or use live Stripe money without the explicit live gate in the PRD.

## Prototype browser

The existing project-owned Chromium lifecycle is proof tooling only. Run `pnpm dev:browser:status` before using it, reuse the recorded owner, and stop only through `pnpm dev:browser:stop`. A real MVP extension integration must live in its own extension source rather than the shared prototype shell.
