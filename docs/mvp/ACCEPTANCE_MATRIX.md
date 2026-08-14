# Private-pilot acceptance matrix

Updated: **2026-08-14**

This matrix maps the binding PRD criteria to current evidence. `Passed` means the required environment and real boundary have been exercised. `Partial` means useful evidence exists but the criterion is not complete. `Blocked` identifies the exact missing external input or action.

| # | Criterion | Status | Current evidence / next proof |
| --- | --- | --- | --- |
| 1 | Pinned Next/OpenNext/Better Auth/D1 on staging | Passed | Deployed staging Worker, persistent session, and migrated staging D1. |
| 2 | Subscriber and Publisher sessions and roles survive deploys | Passed | Rendered staging browser journeys and D1-backed roles. |
| 3 | Publisher participates without Stripe connected account or stored payment credentials | Passed | Public Application, preliminary acceptance, Membership, exact-package Submission, Earning, and Publisher view do not depend on Connect. Connect onboarding is disabled in staging. |
| 4 | Real extension integrates SDK, submits an exact package, is approved, and loads generically | Partial | Monorepo real extension, clean SDK tarball install, private R2 package upload/download/digest verification, rejection/resubmission, and final approval pass locally and on staging. Still needs an independently operated external Publisher handoff/review. |
| 5 | Real test-mode hosted Checkout | Passed | Real rendered `$10/month` Checkout, exact-account/Price reconciliation, and duplicate-Session reuse pass on staging. |
| 6 | Signed, duplicate, delayed, reordered billing Events | Partial | Provider-delivered signed staging Events and real Event resend/replay pass; delayed/reordered cases remain provider-format local checks. |
| 7 | Subscriber approves real extension and receives `active` | Passed | The real paid staging Subscriber links the actual Publisher extension; its SDK independently receives `active`. |
| 8 | Cancellation, failed renewal, and paid-through expiry | Partial | Real rendered Portal cancellation and signed scheduled-cancellation projection pass while paid access remains active. Failed renewal and natural expiry remain local provider-format checks. |
| 9 | Token isolation, replay, expiry, revocation, suspension | Passed | Real Chromium and authority checks pass; distinct failure states are preserved. |
| 10 | Paid Invoice creates one Cash Receipt and balanced Allocation | Passed | Real staging Cash Receipt `in_1U3zn…` is allocated once as `$7/$2/$1`; exact replay is a no-op. |
| 11 | One idempotent external Publisher Payment record | Partial | Local Operator/Publisher browser boundary passes, including role denial, exact replay, conflicting reuse, immutability, and credential-free display. Staging awaits a payment actually completed outside Apps Pass. |
| 12 | Publisher distinguishes accrued Earning and recorded Payment | Passed locally | Publisher UI says **accrued — awaiting SERP payment** or **paid externally**, with only method, time, and opaque reference. |
| 13 | Secret-safe structured staging trace across journey | Partial | The protected trace reconciles real Checkout, billing, Cash Receipt, App session, Allocation, Earning, and Publisher Payment IDs. Final staging Payment evidence awaits a completed external payment. |
| 14 | Persistence and backup/recovery rehearsal | Passed | Deploy persistence and disposable remote D1 Time Travel rehearsal are documented separately. |
| 15 | Automated and real-browser checks reported separately | Partial | Current local/staging reports distinguish them; final complete rerun awaits Stripe journey. |

## Current external inputs

Before recording a staging Publisher Payment, SERP must actually complete a test or deliberately small real payment through an approved external method and retain its opaque confirmation reference. Apps Pass must not fabricate completion evidence.
