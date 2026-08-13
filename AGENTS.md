# Repository guidance

Read [PRD.md](./PRD.md), [CONTEXT.md](./CONTEXT.md), and [docs/prototype/PLAN.md](./docs/prototype/PLAN.md) before planning or changing this repository. The root PRD is the binding extension-inclusion proof; the prototype plan is the binding immediate-delivery sequence. Documents under `docs/product/` are historical, non-binding product intent.

- Work only on `prototype/apps-pass-integration-proof`, based directly on `fe65faa`; preserve `prototype/apps-pass-e2e` unchanged at `b9e4bd4`.
- Make `pnpm operator:import-app <path-to-apppass.json>` the sole participating registration path.
- Keep migrations schema-only: no participating Publishers, Apps, Distributions, fixture identities, or registration seeds.
- Treat `publisher_id` and `app_id` as Operator-issued public identifiers. A manifest may carry assigned identifiers but cannot claim, replace, or redefine an existing Publisher or App.
- The trusted Operator import constitutes approval for this prototype.
- Require versioned whole-manifest validation, idempotent exact re-import, and atomic rejection of malformed manifests, conflicting defining data, and conflicting runtime identities.
- Never embed a platform or publisher secret in a browser extension.
- Treat extension runtime IDs as public allowlist identities, not credentials.
- Use D1 through Drizzle.
- Freeze the authority revision and migration checksums before creating the decisive third fixture; then follow the plan without authority, migration, or seed edits.
- Treat Stripe, Better Auth polish, landing-page UX, Cloudflare preview, and production deployment as non-goals.
- Distinguish local validation, deployed preview, and production rollout in every handoff.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `serpcompany/serp-appspass`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard five-label workflow. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and system-wide ADRs under `docs/adr/`. See `docs/agents/domain.md`.
