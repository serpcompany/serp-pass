# John Doe Focus Timer

This is a standalone example of an invited third-party Publisher App. The free five-minute timer is John Doe Studio's feature. The premium 25-minute timer is unlocked only when the shared Apps Pass SDK returns `active`.

The extension contains only public identifiers. Apps Pass generates the Publisher and App IDs when the Operator creates the invitation; the runtime identity comes from the actual extension:

- Publisher ID: `pub_john_doe_studio`
- App ID: `app_john_doe_focus_timer`
- Chromium runtime ID: `bpjnchabpcjomgncmbgphbdggkgkobdb`

`apppass.json` is the Submission template John completes with those generated IDs. It does not create identities and contains no password, Stripe key, proof key, or App-session token.

Build the SDK configuration with the generated App ID returned by the invitation flow:

```sh
APP_PASS_APP_ID=<generated-app-id> pnpm walkthrough:john-doe:build
```

Run the non-mutating checks from the repository root:

```sh
pnpm walkthrough:john-doe:build
pnpm walkthrough:john-doe:test
pnpm walkthrough:john-doe:preflight
```

The browser test uses a disposable headless Chromium profile and removes it afterward. It does not replace or stop the project-owned extension development browser.

For the real human-in-the-loop staging journey, invoke `$apps-pass-publisher-walkthrough` or paste the prompt in [`docs/walkthroughs/JOHN_DOE_FRESH_AGENT_PROMPT.md`](../../docs/walkthroughs/JOHN_DOE_FRESH_AGENT_PROMPT.md).
