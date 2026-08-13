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

## Trigger-rich migrations

Wrangler `4.122.0` returned `incomplete input` while applying trigger-rich migrations through the normal remote migration query path. This affected `0017_earnings_allocation_ledger.sql` and later migrations `0019` through `0023`. Each unchanged file first passed against both persistent local D1 and a fresh empty local D1. Staging was checked after every failed normal-path attempt and showed no partial schema or migration record.

The first attempt to apply `0019` through `0023` also returned Cloudflare error `7403`, “not authorized.” Before changing any credential or configuration, the Operator verified the authenticated account and email with `wrangler whoami`, confirmed D1 write permission, listed the exact staging database, and retried a read-only migrations list. Those checks succeeded and the authorization error did not recur, so it was treated as a transient control-plane failure rather than worked around with different credentials.

For an individually reviewed migration, the bounded staging fallback is:

```sh
pnpm --filter @serp-apps-pass/web exec wrangler d1 execute \
  apps-pass-staging --env staging --remote \
  --file migrations/<reviewed-migration>.sql
```

After each transactional import succeeded, the Operator verified its expected tables, columns, and triggers and confirmed every new financial table was empty. Only then was that exact migration filename inserted idempotently into `d1_migrations`. A final migrations list confirmed no pending work. For `0019` through `0023`, the verification covered all five new tables, the added Transfer projection columns, 22 new triggers, and zero Settlement, Transfer Attempt, connected-account Payout, Transfer Event, or Payout Event rows.

This is not a blanket alternative to the migrations command. Always try the normal migration command first. Do not use the fallback for another migration without first proving no partial state, reviewing the exact SQL, applying it to a fresh local database, and defining schema-specific verification queries. Record the migration name only after those checks pass. Never edit a migration after it has been applied.
