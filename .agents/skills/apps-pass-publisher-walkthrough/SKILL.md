---
name: apps-pass-publisher-walkthrough
description: Run the John Doe example Publisher through the SERP Apps Pass staging invitation, submission, review, catalog, and optional Subscriber activation journey with human checkpoints.
disable-model-invocation: true
---

# Apps Pass Publisher walkthrough

Run a human-in-the-loop E2E QA session. You play **John Doe**, the invited third-party Publisher. The user plays the **SERP Operator** and, optionally, a **Subscriber**. Automate developer work and objective verification; pause for human judgment.

## Contract

- Work only in `/Users/devin/dev/repos/serp-appspass` on `main` unless the user explicitly changes scope.
- Read `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and `docs/mvp/DELIVERY_PLAN.md` before acting.
- Use `https://serp-apps-pass-staging.serpcompany.workers.dev`. Report local, staging, and production separately.
- Use Stripe test mode only. Pause before opening or completing Checkout. Production and live money remain untouched.
- John may prepare, accept, and submit. John cannot approve his own Submission. The user must inspect it and choose approve or reject.
- Never claim a human step happened until the user confirms it or direct UI/state evidence proves it.
- Keep the Publisher human session, Operator human session, Subscriber human session, and extension App session distinct in every explanation.
- Treat the one-time invitation code and generated test password as transient. Do not commit them or print the password.
- Use `apps/john-doe-focus-timer-extension/apppass.json` exactly. The fixed public identities are:
  - Publisher: `pub_john_doe_studio`
  - App: `app_john_doe_focus_timer`
  - Chromium runtime: `bpjnchabpcjomgncmbgphbdggkgkobdb`

## 1. Prove the package before roleplay

Run:

```sh
git status --short
git branch --show-current
git rev-parse --short HEAD
pnpm walkthrough:john-doe:test
pnpm walkthrough:john-doe:preflight
```

The browser check must load the built extension, observe the fixed runtime ID, and prove the free timer is enabled while the premium timer is gated. The preflight must report staging healthy plus one of:

- `unused_ready_for_walkthrough`: continue with step 2.
- `already_registered_review_existing_run`: stop before creating accounts or invitations. Tell the user the fixed walkthrough has already been completed and offer to review its existing catalog/extension result. Do not invent another identity or alter the committed example.

First response completion criterion: report repository, branch, HEAD, browser result, staging result, submission state, and the one next action. Do not dump later steps on the user.

## 2. Establish the Operator

Tell the user:

> John Doe has finished the extension package. You are now the SERP Operator. Open the staging `/account` page, create or sign into the account you want to use as Operator, then send me that exact email and say `done`.

Wait. After the user responds, validate the email shape and run:

```sh
pnpm mvp:operator:bootstrap -- --staging <exact-email>
```

Ask the user to refresh `/operator` and confirm they see **Operator role active**. Wait for `done`.

Completion criterion: the user has a staging human session with the explicit Operator role.

## 3. Ask the Operator to invite John

Generate a unique Publisher login email such as `john.doe.walkthrough.<UTC timestamp>@example.test`. Keep a random 16+ character test password only in transient process/session state.

Give the user these exact form values:

- Publisher email: the generated email
- Publisher public ID: `pub_john_doe_studio`
- Publisher name: `John Doe Studio`
- First App public ID: `app_john_doe_focus_timer`

Ask them to click **Create Publisher invitation**, paste the one-time invitation code into chat, and say `done`. Wait.

Completion criterion: the user supplies a newly issued code bound to John’s exact email.

## 4. Act as John: accept and submit

Use an isolated browser session, separate from the user's Operator session. Through the visible staging UI:

1. Create John’s account at `/account` with the invited email.
2. Enter the code at `/publisher/invitation`.
3. Confirm `/publisher` shows **Publisher role active** and the assigned App ID.
4. Paste the exact contents of `apps/john-doe-focus-timer-extension/apppass.json` into **App manifest JSON**.
5. Submit this truthful evidence, substituting the verified HEAD:

   `Walkthrough example source: apps/john-doe-focus-timer-extension at repository HEAD <HEAD>. The package browser check loaded runtime bpjnchabpcjomgncmbgphbdggkgkobdb and confirmed the premium feature is gated before entitlement. This is a SERP-owned staged example of an external Publisher handoff, not independent third-party ownership verification.`

6. Confirm the Publisher UI reports the Submission as `pending`.

Then tell the user:

> Developer John Doe just submitted **John Doe Focus Timer**. It is pending—not approved. Open `/operator`, expand **Inspect the developer submission**, check the manifest and ownership evidence, enter a review reason, and choose Approve or Reject. Tell me your decision and say `done`.

Wait. A rejection is a valid QA outcome: report it accurately and stop unless the user asks to rerun with a corrected Submission.

Completion criterion: John has submitted through the site, and the user has made the Operator decision.

## 5. Verify approval without mutating authority

After an approval, verify:

- the exact identity endpoint returns 200;
- `/apps` visibly lists **John Doe Focus Timer**;
- a fresh build of John’s extension shows **Approved by Apps Pass**;
- the premium timer remains gated before a Subscriber App session and active entitlement.

Explain the proof in plain language: the site accepted a Publisher-authored manifest, the Operator approved it, the authority now recognizes this exact App/runtime pair, and catalog discovery changed without changing authority source code or a database migration.

Completion criterion: identity, catalog, and real extension all agree on the approved App.

## 6. Offer the optional Subscriber journey

Ask whether the user wants to stop after Publisher inclusion or continue through test purchase, activation, and entitlement. If they stop, deliver the evidence report.

If they continue:

1. Reconfirm Stripe test mode and the configured account ID `acct_1MwbFJI9EPtyKcIs` before any Stripe action.
2. Have the user create or select a staging Subscriber human session at `/account`.
3. Pause before **Subscribe through Stripe Checkout**. The user performs the test Checkout and says `done`.
4. Verify normalized D1 Subscription state; never infer access from the redirect alone.
5. Load John’s unpacked extension in an isolated, disposable Chromium profile without replacing or stopping the repo-owned dev browser.
6. Start linking from the extension, have the signed-in Subscriber inspect and approve the exact App, finish the one-time exchange, then check entitlement.
7. Confirm the 25-minute premium timer changes from disabled to enabled only after `active`.

Completion criterion: a verified Stripe test event projected paid-through authority into D1, the extension obtained its own scoped App session, and John’s premium feature unlocked from an `active` decision.

## Evidence report

End with a compact table of each journey boundary and observed PASS/FAIL/BLOCKED evidence. Include:

- Developer package and stable runtime
- Operator invitation
- Publisher acceptance and Submission
- Human Operator review decision
- Authority identity and `/apps` catalog
- Optional Stripe test purchase
- Optional extension activation and premium unlock
- Local state
- Deployed staging state
- Production: always `not deployed` for this walkthrough

List every unexpected UX ambiguity as a finding. A partial journey is `BLOCKED`, never PASS.
