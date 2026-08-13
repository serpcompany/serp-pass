# Extension-inclusion proof plan

Status: **Completed locally**
Branch: `prototype/apps-pass-integration-proof`
Base: `fe65faa`

The preserved [proof PRD](./PRD.md) records the question this plan tested. All twelve steps passed; the immutable evidence is recorded in [FREEZE.md](./FREEZE.md) and the observed result in [EVALUATION.md](./EVALUATION.md). This remains a disposable, local-only integration proof and must not be described as a launchable product or production implementation.

## Implementation constraints

- The primary and sole participating registration interface is `pnpm operator:import-app <path-to-apppass.json>`.
- Migrations are schema-only and contain no participating Publisher, App, Distribution, fixture identity, or registration seed.
- `publisher_id` and `app_id` are Operator-issued public identifiers. A submitted manifest may carry assigned identifiers but cannot claim, replace, or redefine existing records.
- The trusted Operator import constitutes approval for this prototype.
- Manifest validation is explicitly versioned and occurs completely before writes.
- Compare conflicts and exact re-imports using the canonical validated version 1 Publisher, App, and Distribution fields; exclude authority-owned approval state and timestamps.
- Exact re-import is idempotent.
- Malformed manifests, conflicting defining data, and conflicting runtime identities fail with no partial writes.
- The SERP and invited-Publisher fixtures use the same import path.

## Exact acceptance sequence

1. Create a fresh local D1 database by applying schema-only migrations.
2. Assert that `publishers`, `apps`, and `app_distributions` contain zero participating records.
3. Import the SERP fixture with:

   ```sh
   pnpm operator:import-app examples/serp-reference/apppass.json
   ```

4. Import the invited-Publisher fixture through the identical command shape.
5. Inspect D1 and verify both Publishers, Apps, and runtime identities were created from their manifests.
6. Re-import each exact manifest and verify success with no duplicate rows or logical changes.
7. Submit malformed and unsupported-version manifests; verify non-zero exits, actionable errors, and zero database changes.
8. Submit a manifest whose channel/runtime identity belongs to another App; verify rejection and zero partial writes.
9. Link both fixtures through the shared SDK and verify both receive `active` from one local test Subscription.
10. Freeze and record the authority source revision and migration checksums.
11. Create a third extension fixture only after that freeze.
12. Without editing authority source, migrations, or seed data:

    - Import it through `pnpm operator:import-app <path>`.
    - Verify its Publisher, App, and Distribution appear in D1.
    - Link it through the same shared SDK.
    - Verify it receives `active` from the existing local test Subscription.

All twelve steps must pass in order. The decisive evidence is the post-freeze third extension, not the two fixtures known while constructing the authority.

## Freeze rule

The freeze begins only after step 9 passes. Before creating or revealing the third fixture, record:

- the Git revision containing the authority source used in the proof; and
- a checksum for every applied database migration.

From that point through completion of step 12, authority source, database migrations, and seed data are immutable. Changes to fixture-only extension files and its assigned manifest are allowed. Any forbidden change invalidates the decisive test and requires returning to step 1 with a new recorded freeze.

## Verification boundary

Report local validation, deployed preview, and production separately. This plan authorizes local validation only. Cloudflare preview and production must remain not attempted.
