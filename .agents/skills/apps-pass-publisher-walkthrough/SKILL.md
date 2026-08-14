---
name: apps-pass-publisher-walkthrough
description: Run the John Doe example through Publisher Application, product review, onboarding, SDK connection verification, catalog, and optional Subscriber activation with human checkpoints.
disable-model-invocation: true
---

# Apps Pass Publisher walkthrough

Run a human-in-the-loop staging acceptance session. You play **John Doe**, first as a Publisher Applicant and then—only after acceptance—as the Publisher. The user plays the **SERP Operator** and optionally a **Subscriber**. Automate John’s work and objective verification; pause for human judgment.

## Contract

- Work only in `/Users/devin/dev/repos/serp-appspass` on `main` unless the user changes scope.
- Read `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and `docs/mvp/DELIVERY_PLAN.md` before acting.
- Use `https://serp-apps-pass-staging.serpcompany.workers.dev`. Report local, staging, and production separately.
- Use Stripe test mode only. Pause before Checkout. Production and live money remain untouched.
- John may apply, accept onboarding, integrate, publish, and register a Distribution. John cannot accept his own Application.
- Never claim a human step happened until the user confirms it or direct UI/state evidence proves it.
- Keep Applicant, Publisher, Operator, Subscriber, and extension App-session authority distinct.
- Treat the invitation code and generated test password as transient. Never commit or log them.
- Use `apps/john-doe-focus-timer-extension/apppass.json` and runtime `bpjnchabpcjomgncmbgphbdggkgkobdb`.
- Treat the deployed exact-ZIP Submission screen as historical evidence from the superseded flow. A fresh walkthrough must exercise connection verification without package upload or a second human approval.

## 1. Preflight the candidate

Run:

```sh
git status --short
git branch --show-current
git rev-parse --short HEAD
pnpm walkthrough:john-doe:test
pnpm walkthrough:john-doe:build
```

Verify the extension loads with its stable runtime identity and contains no platform secret or App-session token. If the fixed identity is already connected, stop and offer to review the existing run.

Completion: report repository, branch, HEAD, browser result, staging health, identity state, and one next action.

## 2. Apply as John

Generate a unique email `john.doe.walkthrough.<UTC timestamp>@example.test`. Keep a random 16+ character password only in transient state. Through `/submit`, submit:

- Publisher/company: `John Doe Studio`
- Extension: `John Doe Focus Timer`
- Public review location and source: `https://github.com/serpcompany/serp-appspass/tree/main/apps/john-doe-focus-timer-extension`
- Product: a five-minute free timer plus a premium twenty-five-minute focus timer gated by Apps Pass
- Permissions/privacy: local storage plus the staging Apps Pass host permission; no personal-data sale
- Ownership: explicitly identify this as a SERP-owned staged example of an external Publisher handoff, not independent ownership evidence

Confirm the site returns a pending Application and `/publisher` remains unavailable. Tell the user:

> Developer applicant John Doe submitted **John Doe Focus Timer**. John is not a Publisher and nothing is approved. Sign in as the SERP Operator, open `/operator`, inspect **Pending Publisher Applications**, and tell me when you can see it.

Completion: one pending Application exists and no Publisher/App authority was created.

## 3. Establish the Operator

If the user lacks an Operator session, ask them to sign in at `/account` and provide the exact email. Bootstrap only that email:

```sh
pnpm mvp:operator:bootstrap -- --staging <exact-email>
```

Ask them to refresh `/operator` and confirm **Operator role active**.

Completion: the user has the explicit staging Operator role.

## 4. Product decision

Ask the user to expand John’s Application and inspect the listing/source, product case, permissions/privacy answer, and ownership statement. They must enter a real reason and choose **Accept for technical onboarding** or **Decline Application**.

- Decline is a valid result: record it and stop unless asked to submit a corrected Application.
- After acceptance, ask the user to paste the generated Publisher ID, App ID, and one-time invitation code. Validate their shapes; do not substitute identities.

Completion: a human decision exists. Only acceptance creates IDs and onboarding access; it is not App approval.

## 5. Onboard and verify the connection

Using an isolated browser separate from the Operator session:

1. Create John’s account with the exact Application email.
2. Accept the code at `/publisher/invitation`.
3. Confirm `/publisher` shows the generated Publisher/App identities.
4. Replace only `publisher_id` and `app_id` in the template with generated values.
5. Build the extension with the generated App ID, publish or stage the resulting extension at its declared public Distribution, and register the versioned `apppass.json` plus store version.
6. Load the extension and require Apps Pass to observe a successful SDK request from the accepted App/runtime pair.
7. Confirm the Publisher and Operator surfaces show **Connected** and the App is catalog-visible.

Tell the user:

> Publisher John Doe integrated **John Doe Focus Timer**. Apps Pass observed the accepted App ID and browser runtime identity, so the dashboard now shows **Connected**. No package or source review was performed or claimed.

Completion: the accepted Publisher's real extension produced durable connection evidence and became catalog-visible without a second human decision.

## 6. Verify inclusion

Verify that:

- the exact App/runtime authority endpoint returns 200;
- `/apps` lists **John Doe Focus Timer**;
- the integrated extension shows **Connected to Apps Pass**;
- an unpaid Subscriber receives the correct `inactive` decision.

Explain that Product Acceptance admitted the Publisher and generated identities, while connection verification proved only protocol connectivity. Neither step certifies source code, package safety, or local feature enforcement.

## 7. Optional Subscriber journey

Ask whether to stop after inclusion or continue. If continuing:

1. Reconfirm Stripe test mode and account `acct_1MwbFJI9EPtyKcIs`.
2. Have the user use a separate Subscriber session.
3. Pause before Checkout; the user completes it and says `done`.
4. Verify normalized D1 Subscription state; never infer access from the redirect.
5. Load the extension in an isolated Chromium profile without replacing the repo-owned browser.
6. Have the Subscriber inspect and approve the exact App, complete the one-time exchange, and check entitlement.
7. Confirm the extension receives `active`; local premium unlocking is demonstration-only and not an admission requirement.

Use the repo-owned resumable commands for steps 5–7:

```sh
pnpm dev:browser:status
pnpm walkthrough:john-doe:activation -- prepare
pnpm walkthrough:john-doe:activation -- finish
pnpm walkthrough:john-doe:activation -- check
```

## Evidence report

End with PASS/FAIL/BLOCKED evidence for Application, Product Acceptance, generated identities/onboarding, connection verification, authority/catalog, optional Stripe purchase, optional activation decision, local, staging, and production (`not deployed`). List every UX ambiguity and manual workaround.
