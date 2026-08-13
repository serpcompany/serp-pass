# Private-pilot acceptance matrix

Updated: **2026-08-13**

This matrix maps the binding PRD criteria to current evidence. `Passed` means the required environment and real boundary have been exercised. `Partial` means useful evidence exists but the criterion is not complete. `Blocked` identifies the exact missing external input or action.

| # | Criterion | Status | Current evidence / next proof |
| --- | --- | --- | --- |
| 1 | Pinned Next/OpenNext/Better Auth/D1 on staging | Passed | Deployed staging Worker, persistent session, and migrated staging D1. |
| 2 | Subscriber and Publisher sessions and roles survive deploys | Passed | Rendered staging browser journeys and D1-backed roles. |
| 3 | Real test-mode Connect onboarding and derived readiness | Partial | Correct Stripe account, Connect webhook, local public seam, and signed projection pass. Needs Publisher country, real hosted onboarding, signed provider Event, and staging evidence. |
| 4 | Real extension integrates SDK, submits, is approved, and loads generically | Partial | Monorepo real extension and clean tarball install pass. Still needs the external Publisher handoff/review boundary. |
| 5 | Real test-mode hosted Checkout | Passed | Real rendered `$10/month` Checkout, exact-account/Price reconciliation, and duplicate-Session reuse pass on staging. |
| 6 | Signed, duplicate, delayed, reordered billing Events | Partial | Provider-delivered signed staging Events and real Event resend/replay pass; delayed/reordered cases remain provider-format local checks. |
| 7 | Subscriber approves real extension and receives `active` | Passed | The real paid staging Subscriber links the actual Publisher extension; its SDK independently receives `active`. |
| 8 | Cancellation, failed renewal, and paid-through expiry | Partial | Real rendered Portal cancellation and signed scheduled-cancellation projection pass while paid access remains active. Failed renewal and natural expiry remain local provider-format checks. |
| 9 | Token isolation, replay, expiry, revocation, suspension | Passed | Real Chromium and authority checks pass; distinct failure states are preserved. |
| 10 | Paid Invoice creates one Cash Receipt and balanced Allocation | Partial | A real Stripe Invoice creates exactly one Cash Receipt; balanced allocation passes locally. Needs one explicitly reviewed allocation from a successful real receipt. |
| 11 | One idempotent test-mode Publisher Transfer | Blocked | Bounded Transfer/reversal and exact Stripe account are approved; Publisher country/readiness and exact Earning amount remain. |
| 12 | Publisher distinguishes Earning, Transfer, and bank Payout | Partial | Rendered local state distinctions pass; provider-driven Transfer/Payout evidence remains unproved. |
| 13 | Secret-safe structured staging trace across journey | Partial | The protected trace now reconciles real Checkout, billing, Cash Receipt, and App-session provider IDs with redaction and count-only Workers Logs. Allocation through Transfer provider IDs remain. |
| 14 | Persistence and backup/recovery rehearsal | Passed | Deploy persistence and disposable remote D1 Time Travel rehearsal are documented separately. |
| 15 | Automated and real-browser checks reported separately | Partial | Current local/staging reports distinguish them; final complete rerun awaits Stripe journey. |

## Current external inputs

1. Approve the synthetic invited test Publisher's two-letter Stripe country code; no real Publisher identity or bank account will be used.
2. Before allocation and Transfer execution, approve exact amounts for one successful real `$10` Cash Receipt. The local `$7 / $2 / $1` fixture is not policy.
