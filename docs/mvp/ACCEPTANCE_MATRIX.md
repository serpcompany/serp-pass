# Private-pilot acceptance matrix

Updated: **2026-08-13**

This matrix maps the binding PRD criteria to current evidence. `Passed` means the required environment and real boundary have been exercised. `Partial` means useful evidence exists but the criterion is not complete. `Blocked` identifies the exact missing external input or action.

| # | Criterion | Status | Current evidence / next proof |
| --- | --- | --- | --- |
| 1 | Pinned Next/OpenNext/Better Auth/D1 on staging | Passed | Deployed staging Worker, persistent session, and migrated staging D1. |
| 2 | Subscriber and Publisher sessions and roles survive deploys | Passed | Rendered staging browser journeys and D1-backed roles. |
| 3 | Real test-mode Connect onboarding and derived readiness | Partial | Local public seam and signed projection pass. Needs correct Stripe authentication, Publisher country, real hosted onboarding, signed provider Event, and staging evidence. |
| 4 | Real extension integrates SDK, submits, is approved, and loads generically | Partial | Monorepo real extension and clean tarball install pass. Still needs the external Publisher handoff/review boundary. |
| 5 | Real test-mode hosted Checkout | Blocked | Approved at $10/month; CLI is authenticated to the wrong Stripe account. |
| 6 | Signed, duplicate, delayed, reordered billing Events | Partial | Official signed fixtures pass locally. Provider-delivered staging Events remain unproved. |
| 7 | Subscriber approves real extension and receives `active` | Partial | Real extension is active locally from normalized authority and inactive on unpaid staging. Needs the real paid staging projection. |
| 8 | Cancellation, failed renewal, and paid-through expiry | Partial | Projection behavior passes locally. Real Portal cancellation/provider Events remain unproved. |
| 9 | Token isolation, replay, expiry, revocation, suspension | Passed | Real Chromium and authority checks pass; distinct failure states are preserved. |
| 10 | Paid Invoice creates one Cash Receipt and balanced Allocation | Partial | Ledger path passes from signed local Invoice fixture. Needs real test Invoice and explicitly reviewed amounts. |
| 11 | One idempotent test-mode Publisher Transfer | Blocked | Bounded test Transfer/reversal approved, but correct Stripe authentication, Publisher country/readiness, and exact Earning amount are missing. |
| 12 | Publisher distinguishes Earning, Transfer, and bank Payout | Partial | Rendered local state distinctions pass; provider-driven Transfer/Payout evidence remains unproved. |
| 13 | Secret-safe structured staging trace across journey | Partial | Structured events exist per module; complete real Checkout-to-Transfer staging trace remains. |
| 14 | Persistence and backup/recovery rehearsal | Passed | Deploy persistence and disposable remote D1 Time Travel rehearsal are documented separately. |
| 15 | Automated and real-browser checks reported separately | Partial | Current local/staging reports distinguish them; final complete rerun awaits Stripe journey. |

## Current external inputs

1. Authenticate Stripe tooling to `acct_1MwbFJI9EPtyKcIs`; the current CLI identity is `acct_1T3IiJE8IBJK847r` and must not be used.
2. Supply the invited Publisher's two-letter Stripe country code.
3. Before Transfer execution, approve an exact Publisher Earning amount. The local `$7 / $2 / $1` fixture is not policy.
