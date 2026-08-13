# Private-pilot delivery status

Updated: **2026-08-13**

## Current slice

Slices 1–3 are complete. Slice 4, Subscriber billing, is in progress. Its normalized projection and official Stripe signature/Event adapter pass against local workerd/D1, while hosted Checkout/Portal routes and durable attempt state are deployed inertly without Stripe configuration. Stripe account `acct_1MwbFJI9EPtyKcIs` (currently **SERP Pass**) is the intended isolated sandbox, but it has not been accessed or configured. Account selection is not authorization to mutate it.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes human auth, role denials, Operator bootstrap, one-time Publisher invitation, normalized billing, official Stripe-format webhook projection, replay/integrity rejection, and D1 rate limiting at `localhost:8788`. A fresh empty local state applies all 14 migrations successfully. |
| Cloudflare staging | deployed and passed | [`serp-apps-pass-staging.serpcompany.workers.dev`](https://serp-apps-pass-staging.serpcompany.workers.dev), Worker version `ac86d731-d113-4e9c-a488-01ba80c275ba`, isolated `apps-pass-staging` D1 in APAC, health `200 ready`, all Slice 1–3 journeys pass, and partial Slice 4 routes/schema are deployed with zero billing state and no Stripe secret or Price configuration. |
| Production | not created or deployed | Production D1 still has a non-routable placeholder UUID; no production secret or Worker deployment exists. |
| Stripe | selected but untouched | Intended isolated account: `acct_1MwbFJI9EPtyKcIs`, currently **SERP Pass**. It has not been accessed. No credentials, Product, Price, webhook, Checkout, Connect account, or payment exists. Every Stripe action remains approval-gated. |

## Partial Slice 4 evidence

- Reviewed local migrations define mode-scoped Billing Customers, one current normalized Pass Subscription per Customer, Invoices, processed Billing Events, and one immutable Cash Receipt per paid Invoice.
- A local-only HMAC adapter verifies the exact raw body and cannot run on staging or production; it is deliberately not named or presented as the Stripe webhook.
- The real `/api/stripe/webhook` route uses pinned official `stripe@22.5.0` / API `2026-07-29.dahlia`, verifies Stripe-format signatures against the raw body, binds Events to test/live mode and the configured Pass Price, and projects current Checkout, Invoice, and Subscription shapes.
- A durable Checkout Attempt allows only one creating/open attempt per Subscriber and stores Stripe identifiers and an idempotency key, never the hosted URL. Checkout completion/expiry is ordered and replay-safe but cannot grant access.
- Checkout and Portal additionally require an exact expected platform Account ID and verify the API credential's current Stripe Account before mutation; a secret or Price from another account is insufficient to enable hosted billing.
- Exact duplicate Event IDs are replay-safe, while reuse of an Event ID with a changed raw payload is rejected as an integrity conflict. Provider Invoice IDs already bound to another Subscription are also rejected atomically.
- Failed renewal and cancellation never extend paid-through access. Cancellation does not erase access already paid through a future date.
- `/account` shows the normalized state; Checkout redirects do not participate in the decision.
- A scoped Operator audit reports Customer, Subscription, Event, Invoice, and Cash Receipt counts and flags paid-Invoice/receipt inconsistencies. Subscriber access is rejected with `403`.
- Browser/workerd commands: `pnpm mvp:billing:test` and `pnpm mvp:stripe-adapter:test`. The Stripe-adapter check uses official generated signatures and Dahlia payload shapes but performs no Stripe API request.
- Staging has all four billing migrations with zero Checkout Attempts, Billing Events, normalized Subscriptions, or Cash Receipts. The local fixture route returns `404`, the real Stripe webhook returns `503 unconfigured`, and unauthenticated Checkout/Portal routes return `401`.
- The deployed bundle contains none of the ignored local fake Stripe/Auth values. The only staging secret remains `BETTER_AUTH_SECRET`.
- Detailed boundary: [BILLING_PROJECTION.md](./BILLING_PROJECTION.md).

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
- A real Stripe-hosted purchase or Portal session. No Stripe account has been accessed, so real API idempotency, Product/Price binding, and webhook delivery remain unproved.
- Real App linking, paid entitlement, earnings, Transfer, or Payout behavior.
- Production readiness or permission to use Stripe.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret name: `BETTER_AUTH_SECRET` (value never written to the repository or command output)

No production Cloudflare resource was created by this slice.
