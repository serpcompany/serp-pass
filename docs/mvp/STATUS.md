# Private-pilot delivery status

Updated: **2026-08-13**

## Current slice

Slices 1–3 are complete. Slice 4, Subscriber billing, is the next implementation slice. Stripe remains a hard approval boundary: no Stripe account may be selected or touched until the user explicitly chooses an isolated test-mode setup.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes human auth, role denials, Operator bootstrap, one-time Publisher invitation, replay rejection, and D1 rate limiting at `localhost:8788`. |
| Cloudflare staging | deployed and passed | [`serp-apps-pass-staging.serpcompany.workers.dev`](https://serp-apps-pass-staging.serpcompany.workers.dev), Worker version `c734a619-422b-48a0-9f31-8bd51a6d9509`, isolated `apps-pass-staging` D1 in APAC, health `200 ready`, all Slice 1–3 browser journeys and the D1 rate-limit proof passed. |
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

## What Slice 3 proves

- An Operator issues immutable public Publisher and App IDs together with a one-time Publisher invitation.
- Only the invited Publisher Membership can submit against its App Assignment; an Operator without that membership receives `403`, and a mismatched public identity receives `409`.
- The versioned public manifest contract rejects unknown fields and produces one canonical whole-document representation without runtime code generation in Workers.
- A Submission remains pending until an Operator records an explicit review reason and approves or rejects it.
- Rejection releases the Distribution claim and restores the App Assignment so the Publisher can correct and resubmit.
- Approval creates canonical App and Distribution authority records, while the public identity route returns only approved state.
- `apps/invited-publisher-extension` is an independently built Manifest V3 source project importing the shared SDK—not the preserved prototype shell.
- Chromium loads that source with stable runtime ID `deigfiokgenocbkifhkognjkhfljcfgi`; staging recognizes it as approved under `app_invited_pilot_real` and `pub_invited_pilot_real`.
- The same rendered-browser flow passes locally and against deployed staging; the fixed real-extension staging check is safely repeatable once approved.

## What it does not prove

- Email ownership or password recovery. Email/password currently avoids choosing an email provider during the composition spike.
- A separately owned external repository consuming a published SDK package. The real reference extension has its own source/build boundary but currently consumes the private workspace SDK; package distribution and an invited developer handoff remain before the external pilot.
- Subscriber billing, real App linking, entitlement, earnings, Transfer, or Payout behavior.
- Production readiness or permission to use Stripe.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret name: `BETTER_AUTH_SECRET` (value never written to the repository or command output)

No production Cloudflare resource was created by this slice.
