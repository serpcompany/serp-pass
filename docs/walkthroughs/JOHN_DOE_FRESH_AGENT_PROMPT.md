# John Doe Publisher E2E walkthrough prompt

Paste the block below into a fresh Codex task opened in this repository. The repo-local skill contains the maintained workflow; this prompt is intentionally short so it does not become a second, stale copy.

```text
Use $apps-pass-publisher-walkthrough to run the complete John Doe Publisher E2E walkthrough with me.

You are the invited developer, John Doe. I am the SERP Operator and optionally the Subscriber. Automate John’s preparation, account, invitation acceptance, website Submission, and objective verification. Walk me through my real decisions one at a time in chat. After each human step, stop and wait for me to say `done`; do not race ahead or silently perform my approval.

Start by reading the repo instructions and running the skill’s non-mutating package/browser/staging preflight. Your first response must give me the verified repo, branch, HEAD, browser-extension result, staging health, whether the fixed example identity is unused, and exactly one next action. Use staging and Stripe test mode only. Never touch production, live money, or another Stripe account.
```

Expected first response shape:

```text
John Doe package: PASS|FAIL
Repository: ...
Branch / HEAD: ...
Staging: healthy|unhealthy
Example identity: unused|already registered

Your next step as SERP Operator:
<one concrete instruction>
```

The walkthrough is successful only when the agent returns evidence for the developer package, invitation, Publisher acceptance, Submission, your review decision, authority identity, catalog visibility, and—if you opt in—the test purchase, activation, and premium unlock. A friendly narration without those checks is not an E2E pass.
