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
| 7 | Signed, duplicate, delayed, and reordered billing Events | Partial | Provider-delivered signed staging Events and real Event resend/replay pass; delayed/reordered cases remain provider-format local checks. |
| 8 | Subscriber approves a real extension and receives `active` | Passed | John Doe first returned truthful `inactive`; after its linked Subscriber's signed-event-derived test Subscription, the same App session returned `active` without relinking. |
| 9 | Cancellation, failed renewal, and paid-through expiry | Partial | Real rendered Portal cancellation and signed scheduled-cancellation projection pass while paid access remains active. Failed renewal and natural expiry remain local provider-format checks. |
| 10 | Cross-App use, link replay/expiry, session revocation, and App suspension | Passed | Real Chromium and authority checks pass with distinct terminal and failure states. |
| 11 | Paid Invoice creates one Cash Receipt and balanced Allocation | Passed | John Cash Receipt `in_1U4O88…` is allocated exactly once as `$7/$2/$1`; the immutable ledger balances to zero. |
| 12 | One completed external Publisher Payment is recorded idempotently | Partial | Local Operator/Publisher browser boundary passes, including role denial, exact replay, conflicting reuse, immutability, and credential-free display. Staging awaits a payment actually completed outside Apps Pass. |
| 13 | Publisher distinguishes accrued Earning from recorded Payment | Passed locally; accrued passes staging | Publisher UI shows the staged John `$7` Earning as awaiting payment. The local journey proves the separate **paid externally** state without exposing credentials. |
| 14 | Secret-safe structured staging trace across the complete journey | Partial | The protected trace reconciles Checkout/API billing, Cash Receipt, App session, Allocation, and Earning IDs. Final staging Payment evidence awaits a completed external payment. |
| 15 | D1 persistence and backup/recovery rehearsal | Passed | Deploy persistence and disposable remote D1 Time Travel rehearsal are documented separately. |
| 16 | Automated checks and real Chromium evidence reported separately | Passed for implemented staging flow | Contract checks, hosted browser Checkout, the project-owned extension browser, and direct D1 reconciliation are reported as distinct evidence. |

## Current external inputs

Before recording a staging Publisher Payment, SERP must actually complete a test or deliberately small real payment through an approved external method and retain its opaque confirmation reference. Apps Pass must not fabricate completion evidence.
