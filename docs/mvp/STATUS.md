# Private-pilot delivery status

Updated: **2026-08-13**

## Current slice

Slices 1–3 are complete. Slice 4, Subscriber billing, remains approval-gated after its account-independent implementation. Slice 5, real activation and entitlement, is implemented and deployed. Slice 6 has deployed, inert Connect-readiness and connected-account Payout projections with account-independent signed-Event/browser proofs. Slice 7 now has deployed, empty allocation, Settlement, Transfer, reversal, and Payout-projection schemas plus local end-to-end evidence. Real Stripe purchase, Express Account creation, hosted onboarding, Transfer execution, and bank Payout remain approval-gated. Stripe account `acct_1MwbFJI9EPtyKcIs` (currently **SERP Pass**) is the intended isolated sandbox, but it has not been accessed or configured. Account selection is not authorization to mutate it.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes human auth, role denials, Operator bootstrap, one-time Publisher invitation, normalized billing, official Stripe-format billing and Connect projections, real extension activation/entitlement, immutable allocation posting, Settlement release simulation, Transfer reversal, Payout projection, replay/integrity rejection, and D1 rate limiting at `localhost:8788`. All 23 migrations apply locally and to a fresh empty D1. |
| Cloudflare staging | deployed and passed | [`serp-apps-pass-staging.serpcompany.workers.dev`](https://serp-apps-pass-staging.serpcompany.workers.dev), Worker version `700fdbff-f638-4fa1-a198-2195363257ae`, isolated `apps-pass-staging` D1 in APAC, health `200 ready`, all 23 migrations recorded with none pending, all Slice 1–3 journeys, and the unpaid Slice 5 activation/session path pass. Partial Slices 4, 6, and 7 remain inert: both Stripe webhook routes return `503 unconfigured`; no Stripe Account ID, secret, Price, connected Account, processed Connect Event, Allocation Run, Publisher Earning, Settlement, Transfer Attempt, Payout, Transfer Event, or Payout Event exists. |
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
- The SDK is a self-contained, compiled, typed `0.1.0` pilot tarball with no runtime/workspace dependency. `pnpm mvp:sdk:test` proves npm installation, module import, public-client behavior, and extension bundling from an empty temporary project. It remains `private: true`, so no package registry publication is implied or possible by accident.
- Chromium loads that source with stable runtime ID `deigfiokgenocbkifhkognjkhfljcfgi`; staging recognizes it as approved under `app_invited_pilot_real` and `pub_invited_pilot_real`.
- The same rendered-browser flow passes locally and against deployed staging; the fixed real-extension staging check is safely repeatable once approved.

## Local Slice 5 evidence

- `app_link_request`, `app_link`, and `app_session` are separate reviewed records linked to the real Better Auth user, approved App, and runtime Distribution; no prototype Subscriber or manually active prototype Subscription is used.
- The independently built Publisher extension creates its proof challenge from its actual `chrome-extension://deigfiokgenocbkifhkognjkhfljcfgi` origin, receives an expiring activation URL, and stores its installation and opaque App-session token in `chrome.storage.local`.
- `/activate/[requestId]` shows the canonical Publisher/App identity and accepts one authenticated Subscriber approve/deny decision. The human cookie is never embedded in the extension.
- Exchange is proof-bound, runtime-origin-bound, expiring, and single-use. D1 stores the App-session token only as a SHA-256 hash.
- Entitlement reads the environment-specific normalized `entitled_until`: linked but unpaid is `inactive`; a signed local paid Invoice becomes `active`; Checkout return state is irrelevant.
- Cross-App claims return `401`; one session can be revoked without changing another; App suspension returns `revoked`; reapproval restores a non-revoked session; the extension can deliberately relink after revocation.
- Authority failure becomes `temporarily_unavailable`, not a false inactive decision. Denied, expired, exchanged, and already-used requests have distinct terminal UX.
- `pnpm mvp:activation:test` connects to the repo-owned persistent browser over CDP, exercises the real extension and rendered website, and leaves the browser alive.

## Deployed Slice 5 evidence

- Migration `0015_app_activation.sql` is applied to staging and all 15 migrations report no pending work.
- The real extension creates an activation request from its stable runtime origin, a staging Better Auth Subscriber approves it, and proof exchange creates a D1-backed App Link and hash-only App session.
- The extension receives `inactive` because staging has no normalized paid-through Subscription; the local billing fixture route remains `404` and cannot manufacture staging access.
- A fresh real App session was created before the Worker-only redeploy. The exact stored App-session token hash remained present and its entitlement remained `inactive` after deployment of Worker version `c4edf729-284f-4d99-bbdc-6ff20c002044`.
- Local and staging SDK storage are namespaced by authority origin as well as App ID, preventing dev-browser environment crossover. The historical proof explicitly selects its preserved non-MVP API prefix.
- The only staging secret is still `BETTER_AUTH_SECRET`; the deployed build contains none of the ignored local Stripe fixture values.

## Partial Slice 6 evidence

- Migration `0016_publisher_connect_projection.sql` stores exactly one mode-scoped Express Account projection per Publisher plus append-only, payload-hashed processed Connect Events. It stores operational readiness only, not raw webhook payloads or KYC fields. Migration `0021_connected_account_payout_projection.sql` adds a separate connected-account Payout projection and signed Event record.
- The dedicated `/api/stripe/connect-webhook` verifies official Stripe-generated signatures for connected-account `account.updated` and Payout Events, rejects live/test crossover, unknown Publisher metadata, cross-Publisher Account reuse, mismatched connected-account identity, and changed-payload Event replay. Platform billing and Transfer Events remain on `/api/stripe/webhook`; each endpoint requires its own signing secret in staging.
- Older Events are durably recorded without regressing newer readiness. A Publisher sees details-submitted, charges, transfers, bank-payout, due-requirement, and disabled states separately.
- `/publisher?connect=returned` remains `Connect not started` until signed Stripe state exists; a redirect cannot assert readiness.
- `pnpm mvp:connect:test` passes against local workerd without any Stripe API request. The inert projection code is deployed to staging, where zero connected Accounts, Connect Events, Payouts, and Payout Events exist because Stripe remains unconfigured.

## Partial Slice 7 evidence

- Migrations `0017` and `0018` define Allocation Runs, receipt allocations, Publisher Earnings, and signed ledger entries. Migrations `0019` through `0023` add Settlement intent, idempotent Transfer Attempts, signed platform Transfer Events, connected-account Payouts, full-reversal evidence, and guarded financial state transitions. D1 triggers enforce receipt capacity, balanced posting, immutable financial definitions, and evidence-backed release and reversal.
- The authenticated Operator allocation route accepts only explicit, versioned allocations. It does not invent a revenue-share formula. A canonical request hash makes exact replay a no-op and changed-payload reuse an integrity conflict.
- One local browser/workerd journey starts from a signed paid-Invoice fixture, posts a balanced Allocation atomically, and shows the Publisher a `$7.00 USD` accrued Earning. The Operator can release it only after the hold and projected Connect readiness pass. The deliberately local executor creates an unmistakable `tr_local_...` simulation; exact retry is idempotent and a changed reason conflicts.
- Signed platform `transfer.created` and full `transfer.reversed` Events are replay-safe and identity-bound. Full reversal atomically reverses the Transfer Attempt, Settlement, and Earning. Partial reversal deliberately stops for manual policy work rather than inventing a correction ledger.
- Signed connected-account Payout Events are projected independently, order-safely, and shown separately from the Publisher's Earning and Stripe Transfer. This prevents “Transfer sent” from being mislabeled as “money reached the bank.”
- Unbalanced allocation, receipt over-allocation, cross-mode/currency use, inactive Publishers, non-Operator callers, and direct mutation of posted rows are rejected.
- `pnpm mvp:earnings:test` passes locally without a Stripe API request. Staging has the reviewed protected routes and empty financial schema. Anonymous Settlement release receives `401`; no Stripe Transfer executor can run without an explicit staging-only enable flag and matching Account configuration.
- Wrangler `4.122.0` could not parse trigger-rich migrations `0017` and `0019` through `0023` through its normal remote path. After proving no partial state, the exact reviewed files were imported transactionally, schema-specific checks passed, and their migration names were recorded. A transient Cloudflare `7403` occurred before the `0019`–`0023` import; authenticated-account, permission, database-list, and read-only migration checks succeeded without changing credentials, and the error did not recur. The bounded fallback and diagnostic boundary are documented in [D1_MIGRATIONS.md](./D1_MIGRATIONS.md).

## What it does not prove

- Email ownership or password recovery. Email/password currently avoids choosing an email provider during the composition spike.
- A separately owned external repository or invited Publisher consuming the supplied SDK. A clean temporary project now installs and bundles the packed artifact without workspace access, but no registry has been selected, no package has been published, and no external Publisher has independently reviewed the handoff.
- A real Stripe-hosted purchase or Portal session. No Stripe account has been accessed, so real API idempotency, Product/Price binding, and webhook delivery remain unproved.
- A real Stripe-paid entitlement, Earning, Transfer, or Payout. App linking, paid-through entitlement behavior, allocation posting, Settlement state, Transfer/reversal projection, and Payout projection are real locally, but their Cash Receipt and provider Events are deliberately signed local fixtures until Stripe test actions are explicitly authorized.
- Production readiness or permission to use Stripe.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret name: `BETTER_AUTH_SECRET` (value never written to the repository or command output)

No production Cloudflare resource was created by this slice.
