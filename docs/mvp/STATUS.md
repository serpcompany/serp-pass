# Private-pilot delivery status

Updated: **2026-08-13**

## Current slice

Slice 1, stack composition, is complete. Slice 2, identity and roles, is next.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes sign-up, session reload, and sign-out at `localhost:8788`. |
| Cloudflare staging | deployed and passed | [`serp-apps-pass-staging.serpcompany.workers.dev`](https://serp-apps-pass-staging.serpcompany.workers.dev), Worker version `85193ed6-58eb-498b-bce3-d42dcac0d2e8`, isolated `apps-pass-staging` D1 in APAC, health `200 ready`, rendered Chromium auth journey passed. |
| Production | not created or deployed | Production D1 still has a non-routable placeholder UUID; no production secret or Worker deployment exists. |
| Stripe | unconfigured | No Stripe account was selected; no credentials, Product, Price, webhook, Checkout, Connect account, or payment exists. |

## What Slice 1 proves

- Next.js App Router and route handlers run through OpenNext on Cloudflare Workers.
- Drizzle reads and writes a reviewed, migrated D1 schema.
- Better Auth creates a D1-backed human session, restores it after browser reload, and revokes it on sign-out.
- Staging uses HTTPS secure cookies and a staging-only Cloudflare secret.
- Auth and health requests produce structured, credential-free Worker events.

## What it does not prove

- Subscriber, Publisher, and Operator roles or invitations.
- Email ownership or password recovery. Email/password currently avoids choosing an email provider during the composition spike.
- Session survival through a Worker deployment; this is a Slice 2 acceptance check.
- Publisher Submission, App approval, real extension linking, entitlement, billing, earnings, Transfer, or Payout behavior.
- Production readiness or permission to use Stripe.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret name: `BETTER_AUTH_SECRET` (value never written to the repository or command output)

No production Cloudflare resource was created by this slice.
