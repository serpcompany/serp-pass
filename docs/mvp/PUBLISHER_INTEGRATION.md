# Publisher extension integration standard

Status: **private-pilot version 1**

This is the concrete handoff between SERP Apps Pass and an accepted Chromium-extension Publisher. It does not transfer source-code ownership to SERP, require a source/ZIP upload, or put a platform secret inside the extension.

## Before technical integration

1. The developer submits a public Publisher Application at `/submit`.
2. SERP inspects the public listing, ownership attestation, product/catalog case, and permissions/privacy explanation.
3. SERP declines the Application or preliminarily accepts it for technical onboarding.
4. Preliminary acceptance generates the public Publisher/App IDs and one-time invitation. Applying alone creates no account role, ID, catalog entry, or entitlement authority.

## What SERP gives the Publisher

1. A Publisher invitation tied to the preliminarily accepted email.
2. A public `publisher_id`, such as `pub_invited_publisher_pilot`.
3. A public `app_id`, such as `app_invited_publisher_video_notes`.
4. A versioned Apps Pass SDK pilot tarball, its SHA-256 checksum, and the authority hostname.

These IDs are names assigned by SERP, not passwords. The Publisher may put them in source control and compiled extension code.

## What the Publisher changes

1. Install the exact SDK pilot tarball supplied by SERP. For example, `npm install ./serp-apps-pass-sdk-0.1.0.tgz`. The package contains compiled JavaScript and TypeScript declarations and has no workspace or runtime package dependency.
2. Create the SDK client with the Apps Pass-generated App ID and authority URL. Read the Distribution identity from `chrome.runtime.id`; do not ask a human to type it into SDK calls.
3. Add the authority hostname to the extension's Manifest V3 `host_permissions`.
4. Call `verifyConnection()` from the built extension so Apps Pass can observe the accepted App/runtime pair. Call `check()` wherever the extension wants the current Subscriber entitlement decision. Apps Pass does not certify how local features use that decision.
5. Rebuild the extension normally. The SDK becomes part of its JavaScript bundle; no Stripe, SERP, or Publisher secret is bundled.

Minimal source shape:

```ts
import { createAppPass } from "@serp-apps-pass/sdk";

const appPass = createAppPass({
  appId: "app_operator_issued_id",
  runtimeId: chrome.runtime.id,
  authorityBaseUrl: "https://serp-apps-pass-staging.serpcompany.workers.dev",
});

await appPass.verifyConnection();
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

`apppass.json` is the complete versioned Integration Declaration sent to Apps Pass. It is not a secret and it does not have to ship inside the extension bundle.

It says:

- which Apps Pass-generated Publisher and App IDs bind this declaration;
- the human-readable names shown during Product Acceptance and activation;
- which premium feature names the App requests;
- which Chromium runtime ID belongs to the built extension;
- whether that identity is registered as an unpacked pilot or Chrome Web Store Distribution.

The Publisher copies the JSON and built/published version into the authenticated `/publisher` integration form. Apps Pass validates the whole document and binds it to the Publisher's generated App Assignment. Unknown fields, substituted Publisher/App IDs, or an already claimed runtime identity are rejected.

The active MVP does not upload or inspect a package. A private-R2 exact-package experiment remains in the repository as historical/risk-based evidence only. SERP may introduce source, package, dependency, or malware review later under an approved risk policy; connection verification must not be described as any of those checks.

## What SERP does after registration

1. Store the validated declaration and accepted Distribution as disconnected; registration alone does not grant linking eligibility.
2. Require the built/published extension to call the SDK connection endpoint from the exact declared `chrome-extension://<runtime-id>` origin using the generated App ID.
3. Record first/latest connection time and successful-call count for that accepted App/runtime pair.
4. Mark the accepted App and Distribution connected, catalog-visible, and linking-eligible without a second human approval.
5. Keep Operator suspension available if the App should no longer participate.

The Publisher does not self-assign identities or bypass Product Acceptance. Apps Pass validates the connection against D1 and returns the canonical result. This proves protocol identity/connectivity only, not package safety or local feature enforcement.

## Stable Chromium identity

`chrome.runtime.id` is determined by Chrome. A packaged/store extension receives its stable Chrome Web Store identity; an unpacked private-pilot build needs a stable public manifest key. That public key is not a signing secret. Apps Pass reserves a runtime ID globally within the Chromium browser family, regardless of whether the Submission calls its channel `unpacked` or `chrome_web_store`.

## Executable reference

[`apps/invited-publisher-extension`](../../apps/invited-publisher-extension/) is the private-pilot reference source project. Its `src/manifest.json`, `apppass.json`, SDK usage, build, isolated Chromium check, and repeatable staging-connection check can be inspected independently. Inside this development monorepo it uses the workspace link so SDK edits reload in the project-owned browser; `pnpm mvp:sdk:test` is the separate evidence that the packed artifact works without that link.

Together, the reference browser journey and clean-package test prove the technical integration handoff, connection verification, activation, and entitlement client behavior. The separate John Doe staging run adds a real Stripe test Subscription and accrued Earning. None of this proves an independently operated external Publisher relationship, registry release, completed external Publisher payment, or bank Payout.
