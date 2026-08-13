# Use one OpenNext Worker for the private pilot

Status: **accepted**

The private-pilot UI, human auth, Stripe webhooks, App inclusion, entitlement authority, earnings ledger, and Operator use cases will ship in one Next.js/OpenNext Cloudflare Worker with one environment-specific D1 database. Their invariants remain separate internal modules, but independent services would add deployment and consistency failure modes before any observed scaling or ownership constraint justifies them.
