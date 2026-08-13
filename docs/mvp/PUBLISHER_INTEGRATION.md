# Publisher extension integration standard

Status: **private-pilot version 1**

This is the concrete handoff between SERP Apps Pass and an invited Chromium-extension Publisher. It does not transfer source-code ownership to SERP and does not require a platform secret inside the extension.

## What SERP gives the Publisher

1. A Publisher invitation tied to the Publisher's sign-in email.
2. A public `publisher_id`, such as `pub_invited_pilot_real`.
3. A public `app_id`, such as `app_invited_pilot_real`.
4. A versioned Apps Pass SDK pilot tarball, its SHA-256 checksum, and the authority hostname.

These IDs are names assigned by SERP, not passwords. The Publisher may put them in source control and compiled extension code.

## What the Publisher changes

1. Install the exact SDK pilot tarball supplied by SERP. For example, `npm install ./serp-apps-pass-sdk-0.1.0.tgz`. The package contains compiled JavaScript and TypeScript declarations and has no workspace or runtime package dependency.
2. Create the SDK client with the assigned App ID, `chrome.runtime.id`, and the Apps Pass authority URL.
3. Add the authority hostname to the extension's Manifest V3 `host_permissions`.
4. Call the SDK from the extension's existing premium-access boundary. Slice 3 can check approved identity; Subscriber activation and real entitlement unlock arrive in Slice 5.
5. Rebuild the extension normally. The SDK becomes part of its JavaScript bundle; no Stripe, SERP, or Publisher secret is bundled.

Minimal source shape:

```ts
import { createAppPass } from "@serp-apps-pass/sdk";

const appPass = createAppPass({
  appId: "app_operator_issued_id",
  runtimeId: chrome.runtime.id,
  authorityBaseUrl: "https://serp-apps-pass-staging.serpcompany.workers.dev",
});

const decision = await appPass.check();
```

## Private-pilot SDK handoff

The SDK is versioned `0.1.0` and deliberately remains `private: true`. That prevents accidental registry publication while the product and package name are still working names. Private does not prevent installing the supplied tarball from a file.

Before sending a pilot SDK, SERP runs:

```sh
pnpm mvp:sdk:test
mkdir -p /tmp/serp-apps-pass-sdk
pnpm --dir packages/app-pass-sdk pack --pack-destination /tmp/serp-apps-pass-sdk
shasum -a 256 /tmp/serp-apps-pass-sdk/serp-apps-pass-sdk-0.1.0.tgz
```

The automated check packs the package, installs it into an empty temporary project with npm, imports the compiled module, calls the public client with an explicit storage adapter, and bundles a clean extension entry with esbuild. It performs no registry publication and requires no access to this monorepo from the simulated Publisher project.

SERP sends the Publisher the tarball and checksum through the agreed private channel. The Publisher verifies the checksum, commits the package-manager lockfile produced by installation, integrates the client at the existing premium-feature boundary, and returns the built runtime identity in `apppass.json`. Choosing npm, GitHub Packages, or another long-term registry remains a later release decision; the pilot does not pretend a registry exists.

## What `apppass.json` is

`apppass.json` is the complete versioned Submission document sent to Apps Pass. It is not a secret and it does not have to ship inside the extension bundle.

It says:

- which Operator-issued Publisher and App IDs this Submission uses;
- the human-readable names shown during review and activation;
- which premium feature names the App requests;
- which Chromium runtime ID belongs to the built extension;
- whether that identity is being reviewed as an unpacked pilot or Chrome Web Store Distribution.

The Publisher copies the JSON into the authenticated `/publisher` Submission form and adds ownership evidence. Apps Pass validates the whole document. Unknown fields, malformed IDs, an unassigned App ID, or an already claimed runtime identity are rejected.

## What SERP does after submission

1. Store the validated Submission as `pending`; this does not grant access.
2. Review the ownership evidence and actual extension/runtime identity.
3. Reject with a reason so the same App Assignment can be corrected and resubmitted, or approve it.
4. On approval only, create the canonical Publisher/App/Distribution authority records.
5. Let the extension identify itself with its public App ID and actual `chrome.runtime.id`.

The extension does not decide that it is approved. The Apps Pass authority checks D1 and returns the canonical result.

## Stable Chromium identity

`chrome.runtime.id` is determined by Chrome. A packaged/store extension receives its stable Chrome Web Store identity; an unpacked private-pilot build needs a stable public manifest key. That public key is not a signing secret. Apps Pass reserves a runtime ID globally within the Chromium browser family, regardless of whether the Submission calls its channel `unpacked` or `chrome_web_store`.

## Executable reference

[`apps/invited-publisher-extension`](../../apps/invited-publisher-extension/) is the private-pilot reference source project. Its `src/manifest.json`, `apppass.json`, SDK usage, build, isolated Chromium check, and repeatable staging-approval check can be inspected independently. Inside this development monorepo it uses the workspace link so SDK edits reload in the project-owned browser; `pnpm mvp:sdk:test` is the separate evidence that the packed artifact works without that link.

Together, the reference browser journey and clean-package test prove the technical integration handoff, activation, and entitlement client behavior. They do not prove a real Stripe purchase, external Publisher review, registry release, Publisher settlement, or bank Payout.
