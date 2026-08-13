# Invited Publisher Video Notes

This is a real private-pilot Chromium extension source project, not a proof fixture or shared popup shell. It owns its manifest, popup UI, and build. It imports `@serp-apps-pass/sdk` as a normal Publisher extension would.

Build it with:

```sh
pnpm --filter @serp-apps-pass/invited-publisher-extension build
```

The committed `apppass.json` is the complete versioned Submission document. Its public Publisher/App IDs must first be assigned by an Operator, and its runtime ID is derived from the public manifest key. No platform or Publisher secret is included.

See [`docs/mvp/PUBLISHER_INTEGRATION.md`](../../docs/mvp/PUBLISHER_INTEGRATION.md) for the human-readable Publisher handoff and the boundary between public IDs, the Submission document, the compiled extension, and Apps Pass approval.
