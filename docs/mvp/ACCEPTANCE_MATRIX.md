# Private-pilot acceptance matrix

Updated: **2026-08-15**

This matrix maps the binding PRD criteria to current evidence. `Passed` means the required environment and real boundary have been exercised. `Partial` means useful evidence exists but the criterion is not complete. `Blocked` identifies the exact missing external input or action.

| # | Criterion | Status | Current evidence / next proof |
| --- | --- | --- | --- |
| 1 | Pinned Next/OpenNext/Better Auth/D1 on staging | Passed | Deployed staging Worker, persistent session, and migrated staging D1. |
| 2 | Subscriber and Publisher sessions and roles survive deploys | Passed | Rendered staging browser journeys and D1-backed roles. |
| 3 | Application grants no authority; only reasoned Operator acceptance generates onboarding identities | Passed | Public Application, Product Acceptance, generated immutable IDs, and email-bound invitation pass on deployed staging. |
| 4 | Accepted Publisher participates without Connect or stored payment credentials | Passed | Membership, Integration Declaration, Connection Verification, Earning, and Publisher view do not depend on Connect. Connect onboarding is disabled in staging. |
| 5 | Real extension integrates the SDK and proves its accepted App/runtime connection | Passed | John Doe Focus Timer and the invited-Publisher extension connect from stable real Chromium origins. No package/source review or local feature-enforcement certification is claimed. |
| 6 | Subscriber completes real test-mode hosted Checkout | Passed | Rendered `$10/month` Checkout, exact-account/Price reconciliation, duplicate-Session reuse, and Portal cancellation pass on staging. The separate John API Subscription supplements but does not replace this evidence. |
| 7 | Signed, duplicate, delayed, and reordered billing Events | Passed | Provider-delivered signed staging Events and real Event resend/replay pass. Official Stripe-format signature tests plus normalized signed fixtures prove delayed/reordered delivery cannot regress status or paid-through state. |
| 8 | Subscriber approves a real extension and receives `active` | Passed | John Doe first returned truthful `inactive`; after its linked Subscriber's signed-event-derived test Subscription, the same App session returned `active` without relinking. |
| 9 | Cancellation, failed renewal, and paid-through expiry | Passed | Portal cancellation preserves paid access. A real Stripe test-clock renewal used the decline-after-attach PaymentMethod: staging recorded one failed Invoice, did not extend paid-through time or create another Cash Receipt, and returned `inactive` after the prior paid-through timestamp expired. |
| 10 | Cross-App use, link replay/expiry, session revocation, and App suspension | Passed | Real Chromium and authority checks pass with distinct terminal and failure states. |
| 11 | Paid Invoice creates one Cash Receipt and balanced Allocation | Passed | John Cash Receipt `in_1U4O88…` is allocated exactly once as `$7/$2/$1`; the immutable ledger balances to zero. |
| 12 | Publisher sees the accrued Earning without a fabricated payment claim | Passed | Publisher UI shows the staged John `$7` Earning as awaiting payment, and staging contains zero Publisher Payment rows. The locally tested payment-recording boundary is supporting evidence, not a staging gate. |
| 13 | Secret-safe structured staging trace across the complete journey | Passed | The protected trace reconciles Checkout/API billing, Cash Receipt, App session, Allocation, and Earning IDs. Deployed role/redaction checks pass, and correlation ID `a2a844a02b27d4dc` was matched to the corresponding secret-safe Workers Log event. |
| 14 | D1 persistence and backup/recovery rehearsal | Passed | Deploy persistence and disposable remote D1 Time Travel rehearsal are documented separately. |
| 15 | Automated checks and real Chromium evidence reported separately | Passed | Contract checks, hosted browser Checkout, the project-owned extension browser, Stripe test-clock behavior, and direct D1 reconciliation are reported as distinct evidence. |

## Deferred live-pilot input

The first controlled settlement with an actual Publisher requires an approved external payment method and an opaque confirmation reference. That rehearsal is intentionally not required to confirm the staging MVP.
