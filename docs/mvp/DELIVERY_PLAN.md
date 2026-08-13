# Private-pilot MVP delivery plan

Status: **binding sequence; implementation not started**

Each slice must finish with a human-observable workflow, automated evidence at the relevant interface, and a written local/staging/production status. Created files, tables, or mocked endpoints do not complete a slice.

## 0. Preserve the proof

Status: **completed locally; remote preservation pending**

- Commit the completed proof cleanup.
- Create an annotated proof tag.
- Start the MVP on a separate branch.
- Push the proof branch/tag and close the failed issue only with explicit remote-mutation approval.

Evidence: local commit `6909bf0`, local tag `prototype-extension-inclusion-proof-v1`, branch `mvp/private-pilot`.

## 1. Stack-composition spike

Status: **completed on Cloudflare staging 2026-08-13**

Build the smallest Next.js/OpenNext app that proves, in one deployed staging Worker:

- App Router page and route handler;
- staging D1 binding and one reviewed migration;
- pinned Better Auth human session using the chosen sign-in/email method;
- secure staging cookies and callback URLs;
- structured Workers Logs;
- local Next development, local OpenNext/workerd preview, and deployed staging as separately reported states.

Do not port entitlement or payment behavior until this exact composition passes.

Evidence: [STATUS.md](./STATUS.md). Email/password is the private-pilot spike method; invitation roles and session administration remain Slice 2 work. No Stripe configuration was used.

## 2. Identity and role slice

- Subscriber sign-in/sign-out/session revocation.
- invitation-only Publisher sign-in and role.
- explicit Operator allowlist/role.
- role enforcement on server use cases and UI.
- session persistence across deployments.

Browser evidence: one account per role sees only its permitted surface; anonymous and wrong-role mutations fail.

## 3. Publisher inclusion slice

- Operator invitation and assigned public IDs.
- authenticated Publisher manifest submission.
- versioned validation and pending Submission record.
- ownership-evidence field and Operator approval/rejection CLI.
- approved App/Distribution query used by the authority.
- one real extension repository integrates the SDK in its own source.

Browser evidence: Publisher submits; Operator approves; the real unpacked extension identifies itself through the approved Distribution without any fixture enumeration.

## 4. Subscriber billing slice

- one configured Stripe test Price;
- authenticated hosted Checkout and Customer Portal;
- raw-body webhook verification;
- replay-safe Event ingestion;
- normalized Customer, Subscription, Invoice, Cash Receipt, and `entitled_until` projection;
- reconciliation command for missed/delayed events.

Browser evidence: test purchase changes the Subscriber UI only after the webhook projection. Duplicate, delayed, failed-renewal, cancellation, and paid-through-expiry scenarios pass.

## 5. Real activation and entitlement slice

- port the proven link/App-session behavior behind authenticated activation UX;
- SDK returns/opens an activation URL;
- `/activate/[requestId]` shows canonical Publisher and App identity;
- approve/deny/expired/already-used terminal states;
- entitlement reads normalized paid-through state;
- session revocation and App suspension.

Browser evidence: the real extension links and unlocks after purchase; another App cannot reuse its session; expiry and failure states are truthful.

## 6. Publisher Connect slice

- create/reuse one connected account per Publisher;
- Stripe-hosted Express onboarding;
- refresh and return handling without treating redirect as completion;
- readiness projection from Stripe account state/events;
- Publisher view distinguishes onboarding, charges readiness, transfers readiness, and observed Payout status.

Browser evidence: test Publisher completes onboarding and Apps Pass derives readiness from Stripe.

## 7. Earnings and settlement slice

- immutable Cash Receipt and ledger model;
- Operator-created balanced Allocation Run;
- Publisher Earning and hold state;
- Operator release;
- idempotent separate Stripe Transfer;
- reversal/failure/retry and Payout-event reconciliation;
- Publisher-readable history.

Browser/Operator evidence: one paid test Invoice becomes one allocated Earning, one approved Transfer, and a separately reported Payout state without duplication.

## 8. Staging release gate

- all PRD acceptance criteria pass against deployed staging and staging D1;
- one SERP-owned and one invited-Publisher App are independently integrated;
- browser E2E, contract/integration checks, and manual journey evidence are separate;
- structured logs trace each journey without secret leakage;
- migration, rollback, D1 recovery, webhook reconciliation, App suspension, and Transfer recovery runbooks are rehearsed;
- limitations, residual risks, and production inputs are recorded.

Staging completion does not authorize live mode.

## 9. Controlled live gate

After explicit approval of every live-money policy in the PRD:

- create production Cloudflare/D1 resources and secrets;
- apply reviewed production migrations;
- configure Stripe live Product/Price, webhook, Connect, and portal;
- onboard one real Publisher;
- perform one deliberately limited live purchase;
- link and verify one real extension;
- post one approved allocation and small Transfer;
- verify Transfer and Payout separately;
- exercise the agreed cancellation/refund path;
- reconcile Stripe, D1, and bank/Payout evidence;
- publish the pilot evaluation and operating decision.

## Mandatory stop conditions

Stop promotion—not local development—when:

- a product/money policy is unresolved but code would encode an answer;
- test and live Stripe state could mix;
- a migration or recovery path has not passed staging;
- a security control has only a mocked test where deployed behavior matters;
- the real extension integration has been replaced by the prototype popup shell;
- Stripe/Connect country or responsibility rules contradict the planned money flow;
- a user-visible success depends on an Operator manually editing D1.
