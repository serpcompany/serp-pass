# SERP Apps Pass context

## Proven question

Yes: locally, a compatible Chromium extension can be submitted, validated, registered, linked, and entitled without modifying authority code, database migrations, or seed data.

This repository is a completed, single-context, disposable integration proof. The root `PRD.md` records its scope, `docs/prototype/PLAN.md` records the completed acceptance sequence, and `ARCHITECTURE.md` explains which parts are demonstrated interfaces versus prototype substitutions. Earlier launchable-product ideas under `docs/product/` are historical and non-binding.

## Actors

- **Operator** — assigns public `publisher_id` and `app_id` values, reviews a submitted manifest, and runs the trusted import command. The import constitutes approval for this prototype.
- **Publisher** — owns an App and may place only its assigned public identifiers in its manifest. It cannot claim, replace, or redefine an existing Publisher or App.
- **Subscriber** — links an App installation and receives access from the local test Subscription.

## Domain boundary

- `apppass.json` is the versioned submission contract.
- `pnpm operator:import-app <path-to-apppass.json>` is the sole participating registration boundary.
- D1 is the system of record and is accessed through Drizzle.
- Migrations define schema only; imported manifests create participating Publisher, App, and Distribution records.
- Runtime IDs are public allowlist identities, not credentials.
- The shared SDK handles linking and entitlement checks without a platform or Publisher secret.
- Conflicting defining data or runtime identity ownership rejects the complete import with no partial writes.

## Evidence boundary

The initial SERP and invited-Publisher fixtures established the import path. A third extension created after the authority and migrations were frozen passed through the same path; the result is recorded in `docs/prototype/EVALUATION.md`.
