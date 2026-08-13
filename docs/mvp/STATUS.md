# Private-pilot delivery status

Updated: **2026-08-13**

## Current slice

Slices 1 and 2 are complete. Slice 3, Publisher inclusion, is next.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes human auth, role denials, Operator bootstrap, one-time Publisher invitation, replay rejection, and D1 rate limiting at `localhost:8788`. |
| Cloudflare staging | deployed and passed | [`serp-apps-pass-staging.serpcompany.workers.dev`](https://serp-apps-pass-staging.serpcompany.workers.dev), Worker version `a83aad1a-b727-435a-85b4-b5b0f839f30e`, isolated `apps-pass-staging` D1 in APAC, health `200 ready`, all Slice 1–2 browser journeys and the D1 rate-limit proof passed. |
| Production | not created or deployed | Production D1 still has a non-routable placeholder UUID; no production secret or Worker deployment exists. |
| Stripe | unconfigured | No Stripe account was selected; no credentials, Product, Price, webhook, Checkout, Connect account, or payment exists. |

## What Slice 1 proves

- Next.js App Router and route handlers run through OpenNext on Cloudflare Workers.
- Drizzle reads and writes a reviewed, migrated D1 schema.
- Better Auth creates a D1-backed human session, restores it after browser reload, and revokes it on sign-out.
- Staging uses HTTPS secure cookies and a staging-only Cloudflare secret.
- Auth and health requests produce structured, credential-free Worker events.

## What Slice 2 proves

- Public signup grants only the Subscriber role; a claimed email address cannot grant Publisher or Operator authority.
- The trusted CLI explicitly bootstraps a named existing Operator account and records an audit event.
- An Operator can create a seven-day invitation for one normalized Publisher email.
- Only the invited signed-in account can exchange the raw code; D1 stores its SHA-256 hash, not the code.
- Acceptance assigns Publisher authority and consumes the invitation atomically; another Subscriber receives a replay rejection.
- Anonymous and Subscriber requests cannot create Publisher invitations, and cross-origin mutation is rejected.
- Better Auth sign-in limits use an atomic D1 counter: three invalid attempts are ordinary credential failures and the fourth receives `429` plus a retry interval.
- A staging human session remained valid across migrations and a Worker deployment.

## What it does not prove

- Email ownership or password recovery. Email/password currently avoids choosing an email provider during the composition spike.
- Publisher Submission, App approval, real extension linking, entitlement, billing, earnings, Transfer, or Payout behavior.
- Production readiness or permission to use Stripe.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret name: `BETTER_AUTH_SECRET` (value never written to the repository or command output)

No production Cloudflare resource was created by this slice.
