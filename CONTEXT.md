# SERP Apps Pass context

## Current question

Can a compatible Chromium extension be submitted, validated, registered, linked, and entitled without modifying authority code, database migrations, or seed data?

This repository is currently a single-context, disposable integration proof. The root `PRD.md` defines the binding product scope, and `docs/prototype/PLAN.md` defines the binding immediate-delivery sequence. Earlier launchable-product ideas under `docs/product/` are historical and non-binding.

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

## Proof boundary

The initial SERP and invited-Publisher fixtures establish the import path. A third extension created after the authority and migrations are frozen decides whether the inclusion hypothesis passes.
