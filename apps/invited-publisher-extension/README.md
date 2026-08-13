# Invited Publisher Video Notes

This is a real private-pilot Chromium extension source project, not a proof fixture or shared popup shell. It owns its manifest, popup UI, and build. It imports `@serp-apps-pass/sdk` as a normal Publisher extension would. This in-repository reference uses the pnpm workspace link for live development; the separate `pnpm mvp:sdk:test` check proves the compiled `0.1.0` tarball installs and bundles from a clean project without workspace access.

Build it with:

```sh
pnpm --filter @serp-apps-pass/invited-publisher-extension build
```

The committed `apppass.json` is the complete versioned Submission document. Its public Publisher/App IDs must first be assigned by an Operator, and its runtime ID is derived from the public manifest key. No platform or Publisher secret is included.

The popup now demonstrates the real MVP consumer contract: create an installation/proof challenge through the SDK, open the Apps Pass activation URL, finish the one-time exchange after Subscriber approval, store the opaque App-session token in `chrome.storage.local`, and check paid-through entitlement. `APP_PASS_AUTHORITY_URL` is injected by the Publisher's build configuration and the ordinary build defaults to staging. Only a build explicitly marked `EXTENSION_DEV_BROWSER=1` accepts the tightly allowlisted `?authority=` test override used by the one repo-owned browser; ordinary extension builds cannot change authority at runtime. The extension never receives a Stripe secret, Publisher secret, or human session cookie.

See [`docs/mvp/PUBLISHER_INTEGRATION.md`](../../docs/mvp/PUBLISHER_INTEGRATION.md) for the human-readable Publisher handoff and the boundary between public IDs, the Submission document, the compiled extension, and Apps Pass approval.
