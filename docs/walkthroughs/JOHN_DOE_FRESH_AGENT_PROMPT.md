# John Doe Publisher E2E walkthrough prompt

Paste the block below into a fresh Codex task opened in this repository. The repo-local skill contains the maintained workflow; this prompt is intentionally short so it does not become a second, stale copy.

```text
Use $apps-pass-publisher-walkthrough to run the complete John Doe Publisher E2E walkthrough with me.

You are developer applicant John Doe. I am the SERP Operator and optionally the Subscriber. Automate John’s public Application, onboarding after Product Acceptance, SDK integration, connection verification, and objective verification. Walk me through the one real admission decision—whether SERP accepts the product. Stop and wait for me to say `done`; do not perform that decision yourself.

Start by reading the repo instructions and running the skill’s browser/staging preflight. Your first response must give me the verified repo, branch, HEAD, browser-extension result, staging health, and exactly one next action. Applying must not grant Publisher authority. Apps Pass generates the Publisher and App IDs only after I accept the Application; neither of us should invent them. After receiving those IDs, configure the SDK and prove that the published/staged extension connects from the accepted App/runtime pair. Do not require source, ZIP, implementation review, or a second human approval. Use staging and Stripe test mode only. Never touch production, live money, or another Stripe account.
```

Expected first response shape:

```text
John Doe extension: PASS|FAIL
Repository: ...
Branch / HEAD: ...
Staging: healthy|unhealthy
Example runtime: ready|already registered

Your next step as SERP Operator:
<one concrete instruction>
```

The walkthrough is successful only when the agent returns evidence for the public Application, your Product Acceptance decision, generated onboarding, SDK connection from the accepted identity, catalog visibility, and—if you opt in—the test purchase and activation decision. Local feature enforcement is outside Publisher-admission acceptance.
