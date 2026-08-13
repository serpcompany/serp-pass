# Private-pilot MVP delivery plan

Status: **binding sequence; implementation in progress**

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

Status: **completed on Cloudflare staging 2026-08-13**

- Subscriber sign-in/sign-out/session revocation.
- invitation-only Publisher sign-in and role.
- explicit Operator allowlist/role.
- role enforcement on server use cases and UI.
- session persistence across deployments.

Browser evidence: one account per role sees only its permitted surface; anonymous and wrong-role mutations fail.

Evidence: [STATUS.md](./STATUS.md). The initial Operator is explicitly bootstrapped through the trusted local/Cloudflare CLI; all later Publisher role grants require an Operator-created, hashed, expiring, email-bound, single-use invitation. Email verification and recovery remain required before the controlled live gate.

## 3. Publisher inclusion slice

Status: **completed on Cloudflare staging 2026-08-13**

- Operator invitation and assigned public IDs.
- authenticated Publisher manifest submission.
- versioned validation and pending Submission record.
- ownership-evidence field and Operator approval/rejection CLI.
- approved App/Distribution query used by the authority.
- one real extension repository integrates the SDK in its own source.

Browser evidence: Publisher submits; Operator approves; the real unpacked extension identifies itself through the approved Distribution without any fixture enumeration.

Evidence: [STATUS.md](./STATUS.md). The public manifest contract is isolated in `packages/app-pass-contracts`; the independently built extension source is `apps/invited-publisher-extension`. The deployed journey also proves wrong-role and mismatched-identity rejection, Operator rejection, corrected resubmission, and approval. The versioned private-pilot SDK now packs as compiled JavaScript plus declarations with no runtime/workspace dependency; `pnpm mvp:sdk:test` installs that tarball in a clean temporary project and bundles a clean extension entry. Registry publication and an actual invited-Publisher handoff remain open.

## 4. Subscriber billing slice

Status: **normalized foundation is safely deployed; account-independent Stripe signature/Event and hosted-route code passes locally; the selected sandbox remains untouched pending explicit approval**

- one configured Stripe test Price;
- authenticated hosted Checkout and Customer Portal;
- raw-body webhook verification;
- replay-safe Event ingestion;
- normalized Customer, Subscription, Invoice, Cash Receipt, and `entitled_until` projection;
- reconciliation command for missed/delayed events.

Browser evidence: test purchase changes the Subscriber UI only after the webhook projection. Duplicate, delayed, failed-renewal, cancellation, and paid-through-expiry scenarios pass.

## 5. Real activation and entitlement slice

Status: **implemented and browser-verified locally and on Cloudflare staging; real paid activation awaits the Slice 4 Stripe test purchase**

- port the proven link/App-session behavior behind authenticated activation UX;
- SDK returns/opens an activation URL;
- `/activate/[requestId]` shows canonical Publisher and App identity;
- approve/deny/expired/already-used terminal states;
- entitlement reads normalized paid-through state;
- session revocation and App suspension.

Browser evidence: the real extension links and unlocks after purchase; another App cannot reuse its session; expiry and failure states are truthful.

Local evidence uses the signed billing-fixture boundary only to establish paid-through authority without accessing Stripe. The independently built Publisher extension performs the request and exchange from its real `chrome-extension://` origin, the Subscriber approves through Better Auth, and D1 stores only the App-session token hash. Approve, deny, already-used, expiry, unpaid, paid-through active, cross-App rejection, scoped revocation, App suspension/reapproval, relinking, public-call rate limiting, and temporary authority failure all pass in Chromium. Staging proves the persistent hash-only App-session path across a Worker deployment and correctly remains `inactive`; it cannot prove real paid `active` until the approved Stripe test purchase exists.

## 6. Publisher payment-boundary slice

Status: **product direction corrected; Stripe Connect is not an MVP dependency**

- collect Publisher payment instructions and tax information outside Apps Pass under an approved SERP operating process;
- store no payment-account credentials in Apps Pass;
- show the Publisher that Stripe bills Subscribers only;
- preserve Connect code as dormant post-MVP evidence rather than enabling it in staging.

Evidence: an invited Publisher can submit and earn without a Stripe connected account. The active Publisher page contains no Connect onboarding control.

Historical evidence includes an account-independent Connect onboarding and readiness experiment. It remains useful if payout automation is reconsidered, but Stripe rejected the first real Account attempt because the platform had not enrolled in Connect. The MVP deliberately avoids that dependency instead of making Connect enrollment a launch blocker.

## 7. Earnings and settlement slice

Status: **allocation, Earning, and external Publisher Payment recording are browser-verified locally; staging payment evidence awaits a payment actually completed outside Apps Pass**

- immutable Cash Receipt and ledger model;
- Operator-created balanced Allocation Run;
- Publisher Earning and hold state;
- Operator recording of one already-completed external payment;
- idempotent Payment evidence with immutable method/reference/time;
- explicit correction and failed-payment operating policy before live money;
- Publisher-readable history.

Browser/Operator evidence: one paid test Invoice becomes one allocated Earning and one recorded external Publisher Payment without duplication or stored credentials.

Current evidence starts with one signed local paid Invoice and exercises the visible protected Operator controls and Publisher page. The Operator supplies every receipt amount, reserve, platform amount, Publisher amount, agreement reference, reason, and hold time. D1 atomically posts the immutable balanced ledger and Earning. After the hold, only an Operator can record a completed external Payment. D1 derives the exact Publisher, amount, currency, and mode from the Earning; exact retry is a no-op, changed reuse conflicts, and mutation rejects. The Publisher sees **paid externally** plus an opaque reference. Apps Pass never initiates the payment or stores payment credentials.

## 8. Staging release gate

Before the release gate, the deployed pilot must be understandable without reading repository documentation:

- `/` explains the Pass and provides obvious Subscriber and Publisher entry points;
- `/apps` lists only real approved D1 Apps and truthful availability;
- `/submit` explains the invited-Publisher inclusion process;
- `/docs` explains the SDK, public IDs, manifest, rebuild, Submission, review, and activation boundaries;
- signed-in role surfaces remain reachable from the shared site navigation.

- all PRD acceptance criteria pass against deployed staging and staging D1;
- one SERP-owned and one invited-Publisher App are independently integrated;
- browser E2E, contract/integration checks, and manual journey evidence are separate;
- structured logs trace each journey without secret leakage;
- migration, rollback, D1 recovery, webhook reconciliation, App suspension, and Publisher Payment correction runbooks are rehearsed;
- limitations, residual risks, and production inputs are recorded.

Staging completion does not authorize live mode.

Current recovery evidence: the actual D1 Time Travel mechanism was rehearsed against a named disposable APAC database and the restored sentinel was verified before the database was deleted. The real staging database was not rewound. [D1_RECOVERY.md](./D1_RECOVERY.md) records the exact evidence and the remaining maintenance-mode and full-domain reconciliation gap.

## 9. Controlled live gate

After explicit approval of every live-money policy in the PRD:

- create production Cloudflare/D1 resources and secrets;
- apply reviewed production migrations;
- configure Stripe live Product/Price, webhook, and portal;
- onboard one real Publisher under an approved agreement and external payment process;
- perform one deliberately limited live purchase;
- link and verify one real extension;
- post one approved Allocation, complete one deliberately small external Publisher payment, and record its opaque confirmation evidence;
- exercise the agreed cancellation/refund path;
- reconcile Stripe subscriber receipts, D1 Allocation/Payment evidence, and the separately controlled external payment record;
- publish the pilot evaluation and operating decision.

## Mandatory stop conditions

Stop promotion—not local development—when:

- a product/money policy is unresolved but code would encode an answer;
- test and live Stripe state could mix;
- a migration or recovery path has not passed staging;
- a security control has only a mocked test where deployed behavior matters;
- the real extension integration has been replaced by the prototype popup shell;
- payment-provider country or responsibility rules contradict the planned money flow;
- a user-visible success depends on an Operator manually editing D1.
