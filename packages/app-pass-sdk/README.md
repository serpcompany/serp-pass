# SERP Apps Pass SDK

Private-pilot Chromium extension client for SERP Apps Pass.

This package is deliberately marked private until SERP approves a package registry and release process. A Publisher may install a versioned pilot tarball supplied by SERP; they do not need access to the Apps Pass monorepo.

```ts
import { createAppPass } from "@serp-apps-pass/sdk";

const appPass = createAppPass({
  appId: "app_operator_issued_id",
  runtimeId: chrome.runtime.id,
  authorityBaseUrl: "https://serp-apps-pass-staging.serpcompany.workers.dev",
});
```

The extension must request `storage` and add the exact Apps Pass authority origin to Manifest V3 `host_permissions`. Public Publisher/App/runtime identifiers are not secrets. Never add Stripe keys, Apps Pass server credentials, or Publisher secrets to an extension.
