---
name: apps-pass-publisher-walkthrough
description: Run the John Doe example through Publisher Application, preliminary review, onboarding, exact-package Submission, final review, catalog, and optional Subscriber activation with human checkpoints.
disable-model-invocation: true
---

# Apps Pass Publisher walkthrough

Run a human-in-the-loop staging acceptance session. You play **John Doe**, first as a Publisher Applicant and then—only after acceptance—as the Publisher. The user plays the **SERP Operator** and optionally a **Subscriber**. Automate John’s work and objective verification; pause for human judgment.

## Contract

- Work only in `/Users/devin/dev/repos/serp-appspass` on `main` unless the user changes scope.
- Read `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and `docs/mvp/DELIVERY_PLAN.md` before acting.
- Use `https://serp-apps-pass-staging.serpcompany.workers.dev`. Report local, staging, and production separately.
- Use Stripe test mode only. Pause before Checkout. Production and live money remain untouched.
- John may apply, accept onboarding, integrate, package, and submit. John cannot preliminarily accept his own Application or finally approve his own Submission.
- Never claim a human step happened until the user confirms it or direct UI/state evidence proves it.
- Keep Applicant, Publisher, Operator, Subscriber, and extension App-session authority distinct.
- Treat the invitation code and generated test password as transient. Never commit or log them.
- Use `apps/john-doe-focus-timer-extension/apppass.json`, runtime `bpjnchabpcjomgncmbgphbdggkgkobdb`, and the ZIP produced by `pnpm walkthrough:john-doe:package`.

## 1. Preflight the candidate

Run:

```sh
git status --short
git branch --show-current
git rev-parse --short HEAD
pnpm walkthrough:john-doe:test
pnpm walkthrough:john-doe:package
pnpm walkthrough:john-doe:preflight
```

Verify the free timer works, premium remains gated, the package contains one root Manifest V3 manifest, and no platform secret or App-session token is embedded. If the fixed identity is already approved, stop and offer to review the existing run.

Completion: report repository, branch, HEAD, package/browser result, staging health, identity state, and one next action.

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

## 4. Preliminary human decision

Ask the user to expand John’s Application and inspect the listing/source, product case, permissions/privacy answer, and ownership statement. They must enter a real reason and choose **Accept for technical onboarding** or **Decline Application**.

- Decline is a valid result: record it and stop unless asked to submit a corrected Application.
- After acceptance, ask the user to paste the generated Publisher ID, App ID, and one-time invitation code. Validate their shapes; do not substitute identities.

Completion: a human decision exists. Only acceptance creates IDs and onboarding access; it is not App approval.

## 5. Onboard and submit the exact package

Using an isolated browser separate from the Operator session:

1. Create John’s account with the exact Application email.
2. Accept the code at `/publisher/invitation`.
3. Confirm `/publisher` shows the generated Publisher/App identities.
4. Replace only `publisher_id` and `app_id` in the template with generated values.
5. Upload the complete JSON, truthful ownership/build evidence including the verified HEAD, and `apps/john-doe-focus-timer-extension/review-package/john-doe-focus-timer.zip`.
6. Confirm the Submission is `pending` and record the returned SHA-256 digest.

Tell the user:

> Publisher John Doe submitted the exact installable **John Doe Focus Timer** ZIP. It is pending—not approved. Open `/operator`, inspect the manifest, ownership evidence, digest, extension manifest, permissions, and automated intake results. Download and test that exact ZIP, then enter a reason and choose Approve or Reject. Tell me your decision and say `done`.

Completion: a versioned pending Submission has a private Review Package and digest; the user makes the final technical decision.

## 6. Verify approval

After approval, rebuild with `APP_PASS_APP_ID=<generated-app-id>` and verify:

- the exact App/runtime authority endpoint returns 200;
- `/apps` lists **John Doe Focus Timer**;
- a fresh extension build shows **Approved by Apps Pass**;
- premium remains gated without a Subscriber App session and paid entitlement.

Explain that Application acceptance authorized onboarding, while final approval promoted the specifically reviewed package identity. Neither step required authority source changes, migrations, or seed edits during the run.

## 7. Optional Subscriber journey

Ask whether to stop after inclusion or continue. If continuing:

1. Reconfirm Stripe test mode and account `acct_1MwbFJI9EPtyKcIs`.
2. Have the user use a separate Subscriber session.
3. Pause before Checkout; the user completes it and says `done`.
4. Verify normalized D1 Subscription state; never infer access from the redirect.
5. Load the extension in an isolated Chromium profile without replacing the repo-owned browser.
6. Have the Subscriber inspect and approve the exact App, complete the one-time exchange, and check entitlement.
7. Confirm the premium timer unlocks only after `active`.

## Evidence report

End with PASS/FAIL/BLOCKED evidence for Application, preliminary review, generated identities/onboarding, exact package and digest, final review, authority/catalog, optional Stripe purchase, optional activation/unlock, local, staging, and production (`not deployed`). List every UX ambiguity and manual workaround.
