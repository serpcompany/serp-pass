# D1 recovery runbook

Status: **private-pilot staging procedure; production use requires a separate approval**

Cloudflare D1 Time Travel is the point-in-time recovery mechanism for the private pilot. It is automatically available on production-backend D1 databases and restores a database in place. It does not currently clone or fork a database. A restore is destructive, cancels in-flight queries, and returns the previous bookmark so the operation can be undone.

Official reference: [Cloudflare D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/).

## Guardrails

1. Identify the environment, database name, and UUID independently. Never infer a production target from a binding name or copy a command between environments.
2. Confirm `wrangler whoami`, the Cloudflare account, D1 write permission, and `wrangler d1 info <database>`. The database must report the production storage backend.
3. Stop application mutations or put the environment into a documented maintenance state. Time Travel cancels in-flight queries; this MVP does not yet have a maintenance-mode switch.
4. Record the current Worker version, current D1 bookmark, migration list, health result, and domain reconciliation counts before restoring.
5. Choose the target timestamp/bookmark from an incident timeline. A successful migration command is not a valid recovery point by itself.
6. Require a second human to compare the exact database name, UUID, target bookmark, and intended incident boundary before a real staging or production restore.
7. Run the restore with JSON output and preserve the returned `previous_bookmark`. That bookmark is the immediate undo path.
8. Verify schema/migration compatibility, health, auth/session behavior, Subscription reconciliation, App authority, ledger balance, and Stripe reconciliation before reopening mutations.

## Command shape

Read-only preparation:

```sh
pnpm --filter @serp-apps-pass/web exec wrangler whoami
pnpm --filter @serp-apps-pass/web exec wrangler d1 info <exact-database-name>
pnpm --filter @serp-apps-pass/web exec wrangler d1 time-travel info <exact-database-name> --json
pnpm --filter @serp-apps-pass/web exec wrangler d1 migrations list <exact-database-name> --remote
```

After the target has been independently reviewed, the destructive command is:

```sh
pnpm --filter @serp-apps-pass/web exec wrangler d1 time-travel restore \
  <exact-database-name> \
  --bookmark <reviewed-target-bookmark> \
  --json
```

Do not discard the returned `previous_bookmark`. If validation shows the chosen recovery point was wrong, repeat the same independently reviewed restore process using that previous bookmark.

Time Travel retention depends on the Workers plan. Confirm the current Cloudflare retention window during incident response; do not encode an assumed 7- or 30-day window into application behavior.

## Rehearsal evidence — 2026-08-13

The Operator rehearsed the provider recovery mechanism against a deliberately disposable APAC database, never against `apps-pass-staging`:

- database: `serp-apps-pass-recovery-rehearsal-20260813`;
- UUID: `88746acd-3841-4813-8d8d-f19e8f465261`;
- storage backend: production/Time Travel capable;
- pre-incident row: `rehearsal = before-incident`;
- captured target bookmark: `00000000-0000000a-000050c6-a6b3aa8d4283c6a9fb2c46bb3256c5bb`;
- simulated incident: the same row changed to `after-incident` and was read back remotely;
- restore result returned previous bookmark `00000000-ffffffff-000050c6-7dcfd14d4b922fc8e3673d5ba712a35e`;
- post-restore remote read returned `before-incident`;
- no Apps Pass schema, account, personal, Subscription, or financial data was copied into the rehearsal database;
- the disposable database was permanently deleted after verification, and a remote list confirmed it was absent.

This proves Cloudflare authentication, APAC D1 creation, bookmark capture, an actual destructive Time Travel restore, post-restore data verification, and cleanup. It does **not** prove that the current staging application can remain writable during recovery, that every Apps Pass invariant has been reconciled after a real incident, or that production recovery is approved.
