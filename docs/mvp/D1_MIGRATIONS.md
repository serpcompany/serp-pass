# D1 migration runbook

This runbook applies to the private-pilot staging database only. Production remains unprovisioned and requires a separate approval gate.

## Normal path

1. Review the exact SQL migration and confirm it contains no seed or fixture data.
2. Apply all migrations to a fresh local D1 database.
3. Apply them to the persistent local development database and run the affected vertical-slice checks.
4. List staging migrations before mutation.
5. Run `pnpm --filter @serp-apps-pass/web db:migrate:staging`.
6. Verify the migration record, expected schema objects, and application invariants before deploying the Worker.

Do not treat a successful command as sufficient evidence. Record local and staging results separately.

## Trigger-rich migration 0017

Wrangler `4.122.0` returned `incomplete input` while applying `0017_earnings_allocation_ledger.sql` through the normal remote migration query path. The unchanged file passed against both persistent local D1 and a fresh empty local D1. Staging showed no partial schema or migration record after the failure.

For this reviewed migration only, the staging fallback was:

```sh
pnpm --filter @serp-apps-pass/web exec wrangler d1 execute \
  apps-pass-staging --env staging --remote \
  --file migrations/0017_earnings_allocation_ledger.sql
```

After the transactional import succeeded, the Operator verified every expected table and trigger and confirmed all new tables were empty. Only then was the exact migration filename inserted idempotently into `d1_migrations`; a final migrations list confirmed no pending work.

This is not a blanket alternative to the migrations command. Do not use it for another migration without first proving rollback/no-partial-state, reviewing the exact SQL, applying it to a fresh local database, and defining schema-specific verification queries. Never edit the migration after it has been applied.
