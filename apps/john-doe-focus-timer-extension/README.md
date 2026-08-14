# John Doe Focus Timer

This is a standalone example of an invited third-party Publisher App. It demonstrates SDK connection, Subscriber linking, and the entitlement response. Its timer UI is example behavior, not something Apps Pass inspects or certifies.

The extension contains only public identifiers. Apps Pass generated the Publisher and App IDs after product acceptance; the runtime identity comes from the actual extension:

- Publisher ID: `pub_john_doe_studio_cf373931`
- App ID: `app_john_doe_focus_timer_cf373931`
- Chromium runtime ID: `bpjnchabpcjomgncmbgphbdggkgkobdb`

`apppass.json` is the registered Integration Declaration for this staged example. It does not create identities and contains no password, Stripe key, proof key, or App-session token.

Build and test the extension from the repository root:

```sh
pnpm walkthrough:john-doe:build
pnpm walkthrough:john-doe:preflight
pnpm walkthrough:john-doe:test
```

When the popup opens, `verifyConnection()` sends the generated App ID and `chrome.runtime.id` from the extension origin. Apps Pass records that connection and then permits Subscriber linking. No ZIP or source review is part of this MVP flow.

The browser test uses a disposable headless Chromium profile and removes it afterward. It does not replace or stop the project-owned extension development browser.

For the resumable staging Subscriber journey, first run `pnpm dev:browser:status`, then:

```sh
pnpm walkthrough:john-doe:activation -- prepare
# Open the returned activationUrl in the signed-in Subscriber browser and approve John Doe Focus Timer.
pnpm walkthrough:john-doe:activation -- finish
pnpm walkthrough:john-doe:activation -- check
```

The helper attaches to the existing project-owned browser and deliberately leaves it running. `finish` proves the link exchange and returns the current authoritative entitlement; `check` is safely repeatable after the Subscriber billing state changes.

For the real human-in-the-loop staging journey, invoke `$apps-pass-publisher-walkthrough` or paste the prompt in [`docs/walkthroughs/JOHN_DOE_FRESH_AGENT_PROMPT.md`](../../docs/walkthroughs/JOHN_DOE_FRESH_AGENT_PROMPT.md).
