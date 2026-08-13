# Private-pilot delivery status

Updated: **2026-08-14**

## Current slice

Slices 1–3 are complete. Slice 4 has real Stripe test-mode Checkout, signed Event projection, replay evidence, one Cash Receipt per paid Invoice, and rendered Portal cancellation. Slice 5 joins that real paid-through Subscription to the actual unpacked Publisher extension on staging. Slice 6 has been simplified: Stripe bills Subscribers only, while Publisher payment instructions remain outside Apps Pass. Slice 7 has a real-receipt `$7/$2/$1` Allocation plus a locally verified, immutable external Publisher Payment record. Staging Payment evidence correctly remains absent until SERP actually completes a payment elsewhere. Stripe account `acct_1MwbFJI9EPtyKcIs` (**SERP Pass**) is the only configured sandbox. Production remains absent.

## Environment evidence

| Environment | State | Evidence |
| --- | --- | --- |
| Local Next | built | Next.js `16.2.11` typecheck and optimized build pass. Runtime use requires an ignored local `BETTER_AUTH_SECRET`. |
| Local workerd | passed | OpenNext `1.19.9` Worker reads migrated local D1; rendered Chromium passes human auth, role denials, Operator bootstrap, one-time Publisher invitation, normalized billing, real extension activation/entitlement, immutable allocation posting, Operator-only external Publisher Payment recording, replay/conflict/immutability checks, and D1 rate limiting at `localhost:8788`. Dormant Connect/Transfer projection tests remain historical evidence. All 25 migrations apply to the persistent local database. |
| Cloudflare staging | deployed and passed | Worker version `925f3175-4502-42e9-aa57-1a5b8df55c4a`, isolated APAC D1, health `200 ready`, and all 25 migrations current. Real Stripe Checkout/Portal/Event projection, real paid extension activation, real-receipt Allocation, Operator-only Payment route, and simplified Publisher UI pass. Connect onboarding and Stripe Transfers are disabled. The real `$7` Earning correctly remains accrued with zero Payment rows. |
| Production | not created or deployed | Production D1 still has a non-routable placeholder UUID; no production secret or Worker deployment exists. |
| Stripe | configured subscriber-billing sandbox | Exact account `acct_1MwbFJI9EPtyKcIs` (**SERP Pass**) was verified before mutation. One Product, `$10/month` Price, Portal configuration, platform webhook, and unused Connect webhook exist in test mode. Real test Customers/Subscriptions/Invoices/Events and one `$10` Apps Pass Allocation exist. No connected Account, Transfer, live object, real card, or bank account exists. Full inventory: [STRIPE_SANDBOX_STATE.md](./STRIPE_SANDBOX_STATE.md). |

## D1 recovery evidence

- Cloudflare Time Travel was exercised against a disposable APAC D1 database, not `apps-pass-staging`.
- A remote sentinel was written as `before-incident`, its bookmark captured, changed to `after-incident`, restored to the exact bookmark, and remotely verified as `before-incident`.
- The restore returned the previous bookmark required for an undo. The disposable database contained no Apps Pass or personal data and was permanently deleted after verification.
- [D1_RECOVERY.md](./D1_RECOVERY.md) records the destructive-operation guardrails, exact rehearsal evidence, and the remaining maintenance-mode/full-domain reconciliation gap.

## Slice 4 evidence

- Reviewed local migrations define mode-scoped Billing Customers, one current normalized Pass Subscription per Customer, Invoices, processed Billing Events, and one immutable Cash Receipt per paid Invoice.
- A local-only HMAC adapter verifies the exact raw body and cannot run on staging or production; it is deliberately not named or presented as the Stripe webhook.
- The real `/api/stripe/webhook` route uses pinned official `stripe@22.5.0` / API `2026-07-29.dahlia`, verifies Stripe-format signatures against the raw body, binds Events to test/live mode and the configured Pass Price, and projects current Checkout, Invoice, and Subscription shapes.
- A durable Checkout Attempt allows only one creating/open attempt per Subscriber and stores Stripe identifiers and an idempotency key, never the hosted URL. Checkout completion/expiry is ordered and replay-safe but cannot grant access.
- Checkout and Portal additionally require an exact expected platform Account ID and verify the API credential's current Stripe Account before mutation; a secret or Price from another account is insufficient to enable hosted billing.
- Exact duplicate Event IDs are replay-safe, while reuse of an Event ID with a changed raw payload is rejected as an integrity conflict. Provider Invoice IDs already bound to another Subscription are also rejected atomically.
- Failed renewal and cancellation never extend paid-through access. Cancellation does not erase access already paid through a future date.
- `/account` shows the normalized state; Checkout redirects do not participate in the decision.
- A scoped Operator audit reports Customer, Subscription, Event, Invoice, and Cash Receipt counts and flags paid-Invoice/receipt inconsistencies. Its protected journey trace follows the Subscriber's operational IDs through Checkout, billing, App links/sessions, Allocation, Earnings, Settlement, and Transfer without returning credential/proof/payload/idempotency material, email, hosted URLs, installation identifiers, or revoke reasons. The response returns a correlation ID; Workers Logs receive only that ID, the Subscriber ID, outcome, and relationship counts. Subscriber access is rejected with `403`.
- `pnpm mvp:operator-trace:test-staging` passed against the deployed Worker. Correlation ID `a2a844a02b27d4dc` matched the real-time `operator_journey_trace` Workers Log event; the event contained environment, outcome, Subscriber ID, and four relationship counts only.
- Browser/workerd commands: `pnpm mvp:billing:test` and `pnpm mvp:stripe-adapter:test`. The Stripe-adapter check uses official generated signatures and Dahlia payload shapes without an API request.
- `pnpm mvp:stripe-checkout:test-staging` performs real hosted Checkout and Portal interactions, exact-account/Price reconciliation, one-Cash-Receipt checks, signed scheduled cancellation, and real-extension entitlement.
- `pnpm mvp:stripe-checkout:test-redirect-boundary` proves the Checkout return remains inactive while the platform endpoint is disabled; exact provider Event resend activates access, and Invoice replay remains one Event/receipt.
- The first real purchase exposed and preserved a failed acceptance artifact: Invoice top-level period bounds did not represent its configured-Price service period. The adapter now uses configured-Price line periods, and fresh real purchases pass. Portal cancellation likewise required recognizing Dahlia's concrete `cancel_at` representation.
- Staging secret names are `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CONNECT_WEBHOOK_SECRET`; values are never written to Git or output. The account-scoped restricted test key expires 2026-11-11.
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
- The unpaid staging check still receives `inactive`, while the real Stripe-paid Subscriber now links the same extension and receives `active` directly from the shared authority.
- A fresh real App session was created before the Worker-only redeploy. The exact stored App-session token hash remained present and its entitlement remained `inactive` after deployment of Worker version `c4edf729-284f-4d99-bbdc-6ff20c002044`.
- Local and staging SDK storage are namespaced by authority origin as well as App ID, preventing dev-browser environment crossover. The historical proof explicitly selects its preserved non-MVP API prefix.
- Staging has separate Stripe API/platform-webhook/Connect-webhook secrets; the extension bundle contains none of them.

## Superseded Connect experiment

- Migration `0016_publisher_connect_projection.sql` stores exactly one mode-scoped Express Account projection per Publisher plus append-only, payload-hashed processed Connect Events. It stores operational readiness only, not raw webhook payloads or KYC fields. Migration `0021_connected_account_payout_projection.sql` adds a separate connected-account Payout projection and signed Event record.
- The dedicated `/api/stripe/connect-webhook` verifies official Stripe-generated signatures for connected-account `account.updated` and Payout Events, rejects live/test crossover, unknown Publisher metadata, cross-Publisher Account reuse, mismatched connected-account identity, and changed-payload Event replay. Platform billing and Transfer Events remain on `/api/stripe/webhook`; each endpoint requires its own signing secret in staging.
- Older Events are durably recorded without regressing newer readiness. The former Publisher-facing Connect readiness display has been removed from the active MVP; the dormant projection is inspectable only through its post-MVP test and database state.
- Migration `0024_publisher_connect_onboarding.sql` adds one immutable-country, idempotent onboarding record per Publisher and mode. An authenticated Publisher can request onboarding for only a Publisher Membership they own; cross-origin and wrong-role requests reject. Staging fixes the approved synthetic Publisher to `US` and preserves a safe `creating` row after Stripe rejected Account creation pending platform Connect signup.
- The real executor creates an Express Account with only the Transfers capability and generates single-use hosted Account Links. It is disabled unless an explicit enable flag, a mode-correct key, and the exact expected platform Account ID all pass. Account Link URLs are never stored or logged.
- A historical onboarding redirect creates no readiness state. A later signed Event must match the Account created for that Publisher; mismatched Accounts reject.
- `pnpm postmvp:connect:test` passes against local workerd without any Stripe API request. It preserves only the dormant API/database projection experiment, not an active Publisher UI. Migration `0024`, onboarding, and dedicated webhook code remain deployed but dormant. The active staging configuration removes the onboarding enable flag, and there are zero connected Accounts, Connect Events, Payouts, and Payout Events. This experiment is not an MVP completion dependency.

## Slice 7 evidence

- Migrations `0017` and `0018` define Allocation Runs, receipt allocations, Publisher Earnings, and signed ledger entries. Migrations `0019` through `0023` add Settlement intent, idempotent Transfer Attempts, signed platform Transfer Events, connected-account Payouts, full-reversal evidence, and guarded financial state transitions. D1 triggers enforce receipt capacity, balanced posting, immutable financial definitions, and evidence-backed release and reversal.
- The authenticated Operator allocation route accepts only explicit, versioned allocations. It does not invent a revenue-share formula. A canonical request hash makes exact replay a no-op and changed-payload reuse an integrity conflict.
- One local browser/workerd journey starts from a signed paid-Invoice fixture, posts a balanced Allocation atomically, and shows the Publisher a `$7.00 USD` accrued Earning. Staging additionally posts real Cash Receipt `receipt:test:in_1U3znNI9EPtyKcIs6md4w0SV` through Allocation Run `alloc_staging_real_10usd_20260814`: `$7.00` Publisher Earning, `$2.00` platform, `$1.00` reserve. Exact replay returned `duplicate`.
- Migration `0025_external_publisher_payment.sql` adds one immutable provider-neutral Payment per eligible Earning. The Operator-only route derives Publisher, amount, currency, and mode from the Earning, validates the hold, stores only method/time/opaque reference, records an audit event, makes exact replay a no-op, and rejects conflicts or mutation. The Publisher sees **paid externally** without payment credentials.
- The dormant Connect experiment additionally proved signed Transfer/full-reversal and connected-account Payout projections locally. Those records are not used by the active Publisher Payment path.
- Unbalanced allocation, receipt over-allocation, cross-mode/currency use, inactive Publishers, non-Operator callers, and direct mutation of posted rows are rejected.
- `pnpm mvp:earnings:test` passes locally without a Stripe API request. Anonymous payment recording receives `401`, a Publisher receives `403`, exact retry returns `duplicate`, conflicting reuse returns `409`, and D1 rejects mutation. Deployed staging independently returns the same role denials and shows the real `$7` Earning as **accrued — awaiting SERP payment** with no Connect control and zero fabricated Payment rows.
- Wrangler `4.122.0` could not parse trigger-rich migrations `0017`, `0019`–`0023`, or `0025` through its normal remote path. For `0025`, the failed attempt left no table or migration record; the exact fresh-local-verified file was then imported transactionally, its table, three indexes, three triggers, 13 columns, and zero rows were verified, and only then was its migration name recorded. The bounded fallback and diagnostic boundary are documented in [D1_MIGRATIONS.md](./D1_MIGRATIONS.md).

## What it does not prove

- Email ownership or password recovery. Email/password currently avoids choosing an email provider during the composition spike.
- A separately owned external repository or invited Publisher consuming the supplied SDK. A clean temporary project now installs and bundles the packed artifact without workspace access, but no registry has been selected, no package has been published, and no external Publisher has independently reviewed the handoff.
- A real invited Publisher independently reviewing the SDK handoff and one actually completed external Publisher payment recorded in staging. Apps Pass correctly refuses to fabricate payment completion merely to make a test green.
- Production readiness, live-mode permission, email ownership/recovery, tax/refund/chargeback operations, or a real bank Payout.

## External staging resources created

- Cloudflare Worker: `serp-apps-pass-staging`
- D1 database: `apps-pass-staging` (`54d36df7-062d-4115-aabc-bcf984b9e2c8`)
- Worker secret names: `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CONNECT_WEBHOOK_SECRET` (values never written to the repository or command output)
- Stripe test objects and IDs: [STRIPE_SANDBOX_STATE.md](./STRIPE_SANDBOX_STATE.md)

No production Cloudflare resource was created by this slice.
