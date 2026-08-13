# Private-pilot threat model

Status: **binding MVP security boundary; not a completed security audit**

## Trust domains

- Public internet and unauthenticated browsers.
- Authenticated Subscriber browser.
- Authenticated invited-Publisher browser.
- Publisher-owned extension code and local extension storage.
- Trusted Operator CLI/session.
- Apps Pass Worker and D1.
- Stripe webhook and server API traffic.

An extension is not a trusted server, even when its runtime ID is approved. A runtime ID is public identity metadata, not a secret.

## Principal threats and required controls

| Threat | Required MVP control | Required evidence |
| --- | --- | --- |
| Forged Stripe webhook | Raw-body signature verification with pinned endpoint secret | Invalid signature rejected; valid fixture accepted |
| Duplicate/out-of-order Stripe delivery | Unique Event IDs plus state reconciliation against event/object chronology | Replay and reorder tests |
| Checkout redirect granting access | Entitlement trusts normalized webhook projection only | Redirect-before-webhook remains inactive |
| Publisher claiming another extension | Operator-issued IDs, recorded ownership evidence, globally unique browser-family/runtime identity regardless of distribution channel, manual approval | Rejected conflicting Submission and audit event |
| Extension impersonating another App | Approved Distribution check plus App-scoped session token | Cross-App token/runtime tests |
| Untrusted client fabricating an extension request | Treat runtime ID and Origin as public browser/CORS metadata, not authentication; show canonical identity, require human approval, require proof possession, and rate-limit public link/exchange calls | Wrong browser origins reject, abuse is bounded, and only the proof holder can exchange an approved request |
| Stolen/replayed link proof | High entropy, short expiry, proof challenge, single exchange | Wrong, expired, and replayed proof tests |
| App-session database disclosure | High-entropy opaque token; hash only in D1 | State/log scan exposes no token |
| Human session leaking into an extension | Activation stays on the website; the extension receives only its separate opaque App-session token after proof exchange | Extension storage and bundle contain no Better Auth cookie or platform secret |
| Human account takeover | Better Auth secure cookies, verified sign-in, session revocation, rate limiting | Role and revoked-session checks |
| Subscriber approving deceptive App | Activation page displays canonical approved Publisher, App, and Distribution | Browser E2E verifies displayed identity |
| CSRF on approval or money action | Same-site session protections plus origin/CSRF-safe state-change handling | Cross-origin mutation test |
| Public Operator action | Operator allowlist/role and protected interface; no anonymous mutation routes | Anonymous/Publisher/Subscriber rejection tests |
| Publisher changing payout destination through Apps Pass | Stripe-hosted Connect account management | No bank data accepted or stored by Apps Pass |
| Double settlement | Immutable Earning release state plus deterministic Stripe idempotency key | Concurrent/retry settlement test |
| Allocation tampering | Balanced immutable entries and Operator audit identity/reason | Unbalanced/edited posting rejected |
| Refund after Publisher transfer | Reserve/hold policy, reversal workflow, reconciliation | Test-mode refund/reversal scenario |
| Secret or personal-data logging | Structured allowlisted fields and redaction | Log fixture/scan and review |
| Environment crossover | Separate D1 databases, Stripe modes, secrets, hostnames, IDs | Startup/config assertion and staging evidence |
| D1 loss or bad migration | Reviewed migrations, staging apply, Time Travel/recovery runbook | Staging recovery rehearsal |

## Credential rules

- Stripe secrets, webhook secrets, Better Auth secrets, email credentials, and Operator credentials live in environment secrets.
- No `NEXT_PUBLIC_` or extension bundle may contain a privileged secret.
- Account Link URLs are short-lived secrets and are neither persisted unnecessarily nor logged.
- App-session tokens are stored only in the linked extension installation and as hashes in D1.
- Logs may contain opaque record IDs and correlation IDs, but not tokens, proof keys, cookies, raw webhook bodies, payment methods, or identity-verification payloads.
- The Operator journey trace is role-protected and allowlists its response fields. It excludes token/proof/payload/idempotency hashes and keys, email, hosted URLs, installation IDs, revoke reasons, payment methods, and KYC data. Its structured log contains only the Subscriber ID, correlation ID, outcome, and relationship counts.

## Authorization matrix

| Capability | Subscriber | Publisher | Operator |
| --- | ---: | ---: | ---: |
| View own Subscription | Yes | No | Support-only |
| Approve own App Link | Yes | No | No |
| Submit App for owned Publisher | No | Yes | Assisted fallback |
| View own Publisher earnings | No | Yes | Yes |
| Approve or suspend App | No | No | Yes |
| Post Allocation Run | No | No | Yes |
| Release Transfer | No | No | Yes |
| Revoke own human session | Yes | Yes | Yes |
| Revoke App session | Own link | No | Yes |

Support-only Operator Subscriber access must not become impersonation without a later explicit design.

## Before live money

- Review Stripe production webhook endpoints and secret rotation.
- Review CSP, CORS, cookie scope, host permissions, and activation URL handling on the actual hostname.
- Perform dependency and secret scans.
- Exercise refund, dispute, Transfer failure, reversal, webhook delay, and Stripe outage scenarios.
- Review Publisher agreement, privacy, terms, refund, and incident-response paths.
- Record residual risks and obtain explicit production approval.
