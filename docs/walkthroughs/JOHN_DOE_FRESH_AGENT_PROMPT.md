# John Doe Publisher E2E walkthrough prompt

Paste the block below into a fresh Codex task opened in this repository. The repo-local skill contains the maintained workflow; this prompt is intentionally short so it does not become a second, stale copy.

```text
Use $apps-pass-publisher-walkthrough to run the complete John Doe Publisher E2E walkthrough with me.

You are developer applicant John Doe. I am the SERP Operator and optionally the Subscriber. Automate John’s public Application, preparation, onboarding after acceptance, exact-package Submission, and objective verification. Walk me through my two real decisions—preliminary Application review and final technical package review—one at a time. After each human step, stop and wait for me to say `done`; do not race ahead or silently perform either approval.

Start by reading the repo instructions and running the skill’s package/browser/staging preflight. Your first response must give me the verified repo, branch, HEAD, browser-extension/package result, staging health, and exactly one next action. Applying must not grant Publisher authority. Apps Pass generates the Publisher and App IDs only after I accept the Application; neither of us should invent them. Final approval must be tied to the exact uploaded ZIP and digest. Use staging and Stripe test mode only. Never touch production, live money, or another Stripe account.
```

Expected first response shape:

```text
John Doe package: PASS|FAIL
Repository: ...
Branch / HEAD: ...
Staging: healthy|unhealthy
Example runtime: ready|already registered

Your next step as SERP Operator:
<one concrete instruction>
```

The walkthrough is successful only when the agent returns evidence for the public Application, your preliminary decision, generated onboarding, exact package and digest, your final technical decision, authority identity, catalog visibility, and—if you opt in—the test purchase, activation, and premium unlock. A friendly narration without those checks is not an E2E pass.
