# Extension-inclusion proof evaluation

Status: **Passed locally**

Evaluation date: **2026-08-13**

Cloudflare preview and production were not attempted. This document records a disposable local integration proof, not a production-readiness claim.

## Immutable evidence chain

- Frozen authority implementation: `36db65e10d4969f5a1901b7e3c5fb71038a23405`
- Freeze record: `97a4a62308c4362ba8d548d649c7c39abbeb5cc8`
- Decisive post-freeze fixture: `examples/post-freeze-reference/`
- Decisive fixture commit: `8b92a5ff4105dc40f8126755a1d3d400ca4abbac`

The recorded and post-proof SHA-256 value for every migration was identical:

```text
6818aeb86b66d124c49ea1682cfe2a74a8a2d21974be36355711012e62d04b3b  migrations/0001_schema.sql
```

The complete tracked diff after the freeze and before this documentation handoff contained only:

```text
examples/post-freeze-reference/apppass.json
examples/post-freeze-reference/extension/manifest.base.json
```

No authority, migration, SDK, generic harness, test, package, workspace, lock, configuration, existing fixture, or seed/state setup file changed during the decisive proof.

## Observed results

- **Schema-empty start:** Applying the schema-only migration to a reset local D1 produced zero Publishers, Apps, or Distributions.
- **Identical registration path:** The SERP, invited-Publisher, and post-freeze manifests were each imported with `pnpm operator:import-app <path-to-apppass.json>`.
- **Idempotent re-import:** Exact re-import of the post-freeze manifest returned `unchanged` and caused no duplicate or logical change.
- **D1 registration:** State inspection showed all three Publishers, Apps, and distinct Chromium runtime identities derived from their submitted manifests.
- **Generic build and loading:** The unchanged extension builder discovered all three fixture directories. After restarting the project-owned browser so its launch-time allowlist included the newly created path, the unchanged lifecycle loaded all three unpacked extensions.
- **Shared-SDK linking:** The unchanged browser acceptance exercised every discovered extension through the same shared SDK and proof-bound linking flow.
- **Active entitlements:** All three independent App sessions received `{"status":"active","features":["premium"]}` from the same deterministic local Subscription.
- **Scoped session protections:** Automated tests verified expiring and single-use proof exchange, opaque App-session tokens stored only as hashes, cross-App token rejection, scoped session revocation, and App suspension without changing another App's authority state.
- **Generic extra-submission proof:** With the three retained fixtures present, the unchanged test harness created a transient synthetic fourth submission with generated identities, discovered, built, loaded, imported, linked, and entitled it, then removed it. This passed without fixture enumeration or source changes.
- **Verification:** The unchanged suite passed all 21 tests with the explicit spec reporter. Typechecking and Git diff checks passed, and no transient synthetic directory remained.

## Limitations and non-production status

- Validation was local only; no Cloudflare preview, remote D1, or production deployment was attempted.
- The Subscriber and active Subscription are deterministic local fixtures, not production identity or billing integrations.
- The trusted local Operator import constitutes approval; Publisher self-service, ownership verification, review operations, and manifest update workflows are outside this proof.
- The extensions are unpacked Chromium fixtures, not store-distributed releases.
- The authority endpoints, browser lifecycle, state inspection, and test credentials are prototype mechanisms and were not hardened, scaled, monitored, or security-audited for production.
- Stripe, Better Auth, checkout, Publisher UI, marketplace UX, payouts, analytics, and production operations remain explicitly outside the evaluated boundary.

## Architectural conclusion

The product hypothesis passed: a previously unknown compatible Chromium extension can be included after the authority is frozen by adding only its assigned versioned manifest and extension source, then using unchanged generic registration, build, linking, and entitlement paths.

The minimum core is:

1. the entitlement authority;
2. the D1 domain model;
3. the versioned manifest validator/importer; and
4. the shared Chromium SDK.

A marketplace website, billing provider, Publisher dashboard, payouts, production authentication, and other launchable-product capabilities are later layers. They are not prerequisites for extension inclusion and were not validated by this proof.
