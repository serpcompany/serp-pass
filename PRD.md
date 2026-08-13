# SERP Apps Pass extension-inclusion proof PRD

Status: **Approved corrective contract**
Date: **2026-08-13**
Branch: `prototype/apps-pass-integration-proof`
Base: `fe65faa`

## 1. Product question

> Can a compatible Chromium extension be submitted, validated, registered, linked, and entitled without modifying authority code, database migrations, or seed data?

This disposable, local-only proof exists solely to answer that question. Earlier launchable-product ideas are preserved as [non-binding historical product intent](./docs/product/HISTORICAL_LAUNCHABLE_MVP_PRD.md).

## 2. Binding terminology and authority

- **Operator** — the trusted SERP actor that assigns public identifiers and imports a submitted manifest.
- **Publisher** — the organization that owns an App.
- **App** — a compatible Chromium extension registered for this proof.
- **Distribution** — an allowlisted public Chromium runtime identity for an App.
- **Subscriber** — a person represented by the local test identity.
- **Subscription** — the normalized local record used to decide access.
- **App link** — the Subscriber-approved association between an App installation and the Subscriber.
- **App session** — an opaque, revocable credential scoped to one App installation.
- **Entitlement** — the authority decision returned to an App session.

`publisher_id` and `app_id` are Operator-issued public identifiers. A Publisher may place its assigned identifiers in `apppass.json`, but the manifest cannot claim, replace, or redefine an existing Publisher or App. A successful trusted Operator import constitutes approval for this prototype.

Runtime IDs are public allowlist identities, not credentials. No platform or Publisher secret may be embedded in an extension.

## 3. Primary interface

The sole participating registration path is:

```sh
pnpm operator:import-app <path-to-apppass.json>
```

No fixture loader, direct SQL registration, migration seed, or extension-specific authority path may participate in acceptance.

## 4. Versioned manifest contract

- Publish an explicit App Pass manifest schema version and validate every import against it.
- `$schema` and `schema_version` must identify the same supported version.
- Version 1 must carry the assigned `publisher_id` and `app_id`, Publisher and App defining data, features, and at least one supported Chromium Distribution.
- The manifest must not control approval state; invoking the trusted import command is the approval boundary.
- Validate the entire document before writing.
- Reject malformed JSON, unsupported versions, missing or unknown required fields, invalid field types, invalid identifiers, unsupported browser/channel combinations, duplicate Distributions, and invalid Chromium runtime IDs.
- Report an actionable error and make no database change after any validation failure.

## 5. Registration semantics

- Use D1 through Drizzle.
- Database migrations contain schema only. They contain no participating Publisher, App, Distribution, or fixture identity and no seed data that bypasses import.
- One successful import atomically registers the Publisher when its assigned identifier is unused, the App, and all declared Distributions.
- For version 1, defining data is the canonical validated Publisher fields, App fields, and Distribution fields declared by the schema. Authority-owned operational fields such as approval state and timestamps are not defining data.
- An exact re-import succeeds as a no-op without duplicates or logical changes.
- If an existing `publisher_id` or `app_id` is presented with conflicting defining data, reject the entire import. The manifest cannot replace or redefine the record.
- If a channel/runtime-ID pair is already assigned to another App, reject the entire import.
- Every conflict must fail with no partial writes.
- Non-exact update and replacement workflows are outside this proof.

## 6. Required proof fixtures

- One SERP-owned fixture and one invited-Publisher fixture must use the same versioned manifest and the same `operator:import-app` command.
- Both must link through the same shared SDK.
- Both must receive `active` from the same local test Subscription using separate App sessions.
- No authority behavior may branch on a fixture name, assigned App ID, assigned Publisher ID, or known runtime ID.

## 7. Decisive post-freeze extension

After the schema, importer, authority, shared SDK, and initial two-fixture tests pass, record the authority source revision and migration checksums as frozen. Only then create a third compatible extension fixture with previously unused Operator-issued Publisher, App, and runtime identifiers.

The proof passes only if the third extension is imported through the same command, appears in D1, links through the shared SDK, and receives `active` from the existing local test Subscription without editing authority source, migrations, or seed data after the freeze.

## 8. Success boundary

The exact binding acceptance sequence and freeze gate are in [docs/prototype/PLAN.md](./docs/prototype/PLAN.md). All steps must pass locally. Passing the two known fixtures is necessary but insufficient; the post-freeze third extension is decisive.

## 9. Explicit non-goals

- Stripe integration or test-mode validation.
- Better Auth polish or production authentication.
- Landing-page, checkout, account, or billing-portal UX.
- Marketplace, public catalog, Publisher dashboard, automated onboarding, payouts, or analytics.
- Cloudflare preview infrastructure or deployment.
- Production infrastructure or rollout.
- General manifest update or version-migration workflows beyond exact idempotent re-import.
- Store-ownership verification, Firefox, Safari, or native applications.
- Archiving or tagging the proof.

## 10. Reuse gate

No implementation from `prototype/apps-pass-e2e` may be copied wholesale. Only after the import boundary passes may later work selectively reuse its shared SDK behavior, proof-bound linking, opaque App sessions, entitlement decisions, D1/Drizzle schema concepts, deterministic local Subscription, browser harness concepts, safe state inspection, and focused tests.

Seeded participating records, fixed fixture enumeration, unvalidated manifest parsing, hard-coded identities, and checkpoint claims that the earlier product hypothesis passed are discarded.
