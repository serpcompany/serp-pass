# Repository guidance

Read [PRD.md](./PRD.md) before planning or changing this repository. It is the binding MVP contract.

- Keep the MVP smaller than a marketplace: no public catalog, publisher dashboard, automated payouts, or analytics product unless the PRD changes first.
- Keep billing-provider concepts behind an adapter. Domain code decides entitlements from normalized subscription state.
- Never embed a platform or publisher secret in a browser extension.
- Treat extension runtime IDs as public allowlist identities, not credentials.
- Use D1 through Drizzle and make billing webhook processing replay-safe.
- Distinguish local validation, deployed preview, and production rollout in every handoff.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `serpcompany/serp-appspass`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard five-label workflow. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and system-wide ADRs under `docs/adr/`. See `docs/agents/domain.md`.
