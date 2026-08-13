# Publisher extension integration standard

Status: **private-pilot version 1**

This is the concrete handoff between SERP Apps Pass and an invited Chromium-extension Publisher. It does not transfer source-code ownership to SERP and does not require a platform secret inside the extension.

## What SERP gives the Publisher

1. A Publisher invitation tied to the Publisher's sign-in email.
2. A public `publisher_id`, such as `pub_invited_pilot_real`.
3. A public `app_id`, such as `app_invited_pilot_real`.
4. The Apps Pass SDK and authority hostname.

These IDs are names assigned by SERP, not passwords. The Publisher may put them in source control and compiled extension code.

## What the Publisher changes

1. Add `@serp-apps-pass/sdk` to the extension source project. During this private pilot it is a workspace package; before an external repository uses it, SERP must choose a versioned package-distribution channel.
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

[`apps/invited-publisher-extension`](../../apps/invited-publisher-extension/) is the private-pilot reference source project. Its `src/manifest.json`, `apppass.json`, SDK usage, build, isolated Chromium check, and repeatable staging-approval check can be inspected independently.

It currently proves inclusion and identity only. It does not prove a real purchase, Subscriber activation, Publisher earning, or payout. Those are later delivery slices.
