# Partner intake comparison: JoinAppPass and Setapp

Research date: 2026-08-14

This note compares the procedures described in current first-party public materials. It distinguishes published facts from interpretation. Private contracts, internal review playbooks, and authenticated dashboard fields may add requirements that are not publicly documented.

## Executive conclusion

The two references represent different levels of curation:

- **JoinAppPass is a lightweight integration network for already-public browser extensions.** A developer joins a waiting list, integrates the SDK, publishes the integrated update to an extension store, then marks it ready for App Pass verification. Its public procedure does not describe uploading source code or a private review build to App Pass.
- **Setapp is a curated distribution marketplace.** A developer may apply, or Setapp may initiate contact. Setapp applies an initial product/quality gate, gives approved developers access, receives a distributable build for macOS, tests it against detailed guidelines, and reviews later versions. Setapp's public procedure likewise does not require source-code delivery; it reviews a signed/notarized app bundle for macOS, while iOS uses the App Store build and web apps use an API integration.

Therefore, a SERP flow based only on invitation plus manifest approval is closer to JoinAppPass than Setapp. A developer-initiated application followed by product screening, an integrated extension package upload, automated checks, human functional/security/quality review, and version-by-version re-review is the closer browser-extension analogue to Setapp.

Mandatory **source-code** intake would be a deliberate SERP policy stricter than either reference's publicly documented baseline. That may be justified, but it should not be described as something these references establish.

## Side-by-side procedure

| Question | JoinAppPass | Setapp | What is not established publicly |
|---|---|---|---|
| Who initiates? | The public partner page asks a logged-in developer to join a waiting list and says any developer with a publicly listed extension may apply. ([Partner page](https://joinapppass.com/partner)) | Setapp says it commonly contacts developers with standout products, but developers are also welcome to submit its website form. ([Marketplace overview](https://docs.setapp.com/docs/setapp-marketplace-overview)) | Neither public site exposes its complete applicant-screening workflow or every form field to an unauthenticated reader. |
| Initial eligibility | A publicly accessible browser extension; no themes; no spyware or malware. ([Partner FAQ](https://joinapppass.com/partner)) | Mature software with quality, reputation, and stable-performance expectations; Setapp may reject for low demand, failed KYC, unsupported payout geography, safety/privacy risk, imitation, hidden functionality, poor quality, IP problems, and many other guideline violations. ([Developer page](https://setapp.com/developers), [Review guidelines](https://docs.setapp.com/docs/review-guidelines)) | JoinAppPass does not publish a Setapp-sized product, privacy, IP, and UX review standard. |
| Product application before technical integration | The public sequence is not described as a separate product application and preliminary technical review. It exposes a waiting list, then describes SDK integration and store publication before review. ([Partner page](https://joinapppass.com/partner)) | Yes at the high level: reach out/apply, quality approval, submit for technical review, then integrate the SDK. ([Developer page](https://setapp.com/developers)) In detailed platform docs, the release candidate is integrated and tested before final version review, implying a preliminary product gate followed by an integrated-build gate. ([Testing](https://docs.setapp.com/docs/testing-your-application), [Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | Setapp's public marketing summary compresses several stages, so it should not be read as saying its final release review happens before integration. |
| Information/artifacts supplied | Public listing and store-published integration are explicit. The authenticated application/dashboard fields are not documented on the public page. ([Partner page](https://joinapppass.com/partner)) | For macOS, a ZIP containing the `.app` bundle plus release metadata and marketing/support material; the bundle supplies identifiers and version metadata. iOS uses an App Store URL plus metadata; web uses a landing page and Vendor API integration. ([Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | The public Setapp application form fields are not fully enumerated in the docs. |
| Source code or repository access | **Not stated as required.** The documented handoff is a live store version containing the SDK integration. ([Partner page](https://joinapppass.com/partner)) | **Not stated as required.** macOS documentation explicitly requests the compiled app bundle ZIP; iOS relies on the released App Store build; web says no build upload is required. ([Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | Absence from public documentation does not prove either company never requests source or repository access in exceptional/private reviews. |
| Build/package upload | No App Pass upload is described; the developer first publishes the integrated update to the extension store. ([Partner page](https://joinapppass.com/partner)) | macOS: required ZIP app-bundle upload, manually or by CI/API/script/Fastlane. iOS: no binary upload to Setapp; release through the App Store. Web: no build upload. ([Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | JoinAppPass's authenticated dashboard could contain undisclosed evidence fields, but the public procedure does not say so. |
| SDK/integration order | Integrate SDK, publish the extension-store update, set status to `Ready for review`, then App Pass verifies and marks the extension `Live`. ([Partner page](https://joinapppass.com/partner), [Integration guide](https://joinapppass.com/partner/integration)) | After initial business/product acceptance, the developer integrates the Setapp mechanism, tests in the Setapp environment, and submits the release candidate for final review. Platform details differ: Framework/public key for native apps or Vendor API for web. ([Developer page](https://setapp.com/developers), [Testing](https://docs.setapp.com/docs/testing-your-application), [Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | Neither reference supports granting catalog access merely because an SDK call succeeds. |
| Technical/human review | App Pass says its team verifies the live store integration before marking it Live. Its public eligibility language bars spyware/malware but does not publish the checks performed. ([Partner page](https://joinapppass.com/partner)) | Setapp's Review Team runs tests and checks compliance with detailed functional, UX, privacy, safety, legal, metadata, signing, notarization, and platform requirements. ([Review guidelines](https://docs.setapp.com/docs/review-guidelines), [App requirements](https://docs.setapp.com/docs/preparing-your-application-for-setapp), [Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | Neither source publicly promises source-level audit, reproducible builds, dependency review, or a specific malware-scanning pipeline. |
| Distribution | Participating extensions remain publicly distributed through extension stores; App Pass supplies cross-extension subscription activation. Developers may also keep their own payment model. ([Partner page](https://joinapppass.com/partner)) | Setapp directly distributes macOS apps through its client; iOS apps remain App Store-distributed; web apps integrate with Setapp authorization. Developers may also sell outside Setapp. ([Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review), [FAQ](https://docs.setapp.com/docs/faq)) | SERP must choose whether it only licenses store-distributed extensions or also becomes a package distributor. Those are materially different operational and legal roles. |
| Updates and re-review | The public page explains first integration review after a store update, but does not publish a recurring update/re-review procedure. ([Partner page](https://joinapppass.com/partner)) | A macOS developer uploads each new bundle/version and submits it for review; established apps receive a facilitated review with minimum required checks. iOS versions sync from the App Store and the Review Team is notified for double-checking. ([Updating apps](https://docs.setapp.com/docs/updating-applications), [Submitting apps](https://docs.setapp.com/docs/submitting-apps-for-review)) | JoinAppPass update controls are unknown from public docs. Setapp's exact internal test suite is also not public. |
| Ongoing quality | No public rating/removal policy beyond eligibility and the platform's right to refuse/remove content. | Setapp monitors ratings and update freshness; low ratings, long distribution lag, or abandonware can limit promotion or cause removal. ([Quality policy](https://docs.setapp.com/docs/quality-check)) | SERP needs an explicit suspension/removal and subscriber-impact policy; neither reference can decide it for SERP. |
| Revenue attribution | App Pass allocates 80% of plan revenue to publishers, spread daily across eligible activated extensions used that day; it reports estimates daily. ([Partner page](https://joinapppass.com/partner)) | Membership distributes 70% based on apps opened during the billing period, weighted by app price tiers, plus a possible 20% partner fee for referred subscribers. ([Membership revenue](https://docs.setapp.com/docs/setapp-membership-revenue)) | Both formulas are product choices, not evidence that SERP should automate the same formula before approving its own policy. |
| Payout | PayPal at the beginning of each month once earnings cross $50. ([Partner page](https://joinapppass.com/partner)) | Payouts are processed at the beginning of the month to the developer's bank account; Setapp states a $200 transfer floor. ([Statistics and payouts](https://docs.setapp.com/docs/application-statistics)) | Public pages do not fully specify tax, compliance, reserves, disputes, or all country-specific payout handling. |

## Post-cancellation access enforcement

The public evidence does **not** support the idea that a catalog/dashboard status alone disables every already-installed product. Enforcement differs by platform:

- **JoinAppPass:** its integration guide tells the extension to call `checkAppPass()` and treat only `status === 'ok'` as active. The published SDK source confirms that `checkAppPass()` calls the App Pass server and merely returns its status; `no_apppass` means there is no active subscription. The SDK does not itself disable an extension's arbitrary local features. Its server-verification guide likewise tells a Publisher backend to validate the returned token and use `status === 'ok'` when unlocking backend features. ([Integration guide](https://joinapppass.com/partner/integration), [SDK source](https://github.com/chrome-stats/app-pass-sdk/blob/362d46d60a1620bc4d3b39e87641dc620c06a1f6/src/index.ts#L4-L85), [server-verification guide](https://github.com/chrome-stats/app-pass-sdk/blob/362d46d60a1620bc4d3b39e87641dc620c06a1f6/README.md#L50-L84)) **Explicit:** App Pass supplies the active/inactive result. **Necessary inference:** for locally implemented premium behavior, the extension must call the SDK and honor that result; otherwise the shown SDK code has no mechanism to switch those features off. **Unknown:** the public materials do not specify a required recheck interval, token lifetime, push revocation mechanism, or a test that proves every participating extension actually locks after expiry.
- **Setapp on macOS:** Setapp says its Launch Agent controls whether the app runs, so the app does not separately monitor subscription status. Setapp's customer documentation says cancellation retains use through the current billing period, after which the installed apps cannot be used. For failed renewal, Setapp may allow a 14-day grace period and then suspends the account if payment is still unconfirmed. ([Subscription monitoring](https://docs.setapp.com/docs/monitor-subscription-status), [cancellation](https://support.setapp.com/hc/en-us/articles/214288385-Cancel-subscription), [payment-failure grace period](https://support.setapp.com/hc/en-us/articles/115004305069-Grace-period)) **Explicit:** this is platform-side runtime enforcement outside each app's feature-gating UI. The private Launch Agent implementation remains unpublished.
- **Setapp on iOS and web/server-backed apps:** iOS apps receive and monitor a `SetappSubscription` state through the Setapp Framework, and Setapp tests whether the app unlocks full functionality after receiving Framework data. For Vendor API integrations, Setapp says the Publisher should call the access endpoint every time a user accesses the app, and no less often than once per 24 hours; the endpoint response is what decides whether access is allowed. ([Subscription monitoring](https://docs.setapp.com/docs/monitor-subscription-status), [testing](https://docs.setapp.com/docs/testing-your-application), [Vendor API integration](https://docs.setapp.com/docs/integrating-apps-using-vendor-api), [access decision endpoint](https://docs.setapp.com/reference/post_application-access)) **Explicit:** on these platforms the participating app/backend must consume and act on Setapp's entitlement result; sign-in alone is not a subscription check. ([Sign in with Setapp](https://docs.setapp.com/docs/sign-in-with-setapp-developer-preview))

For a Chromium-extension Pass, JoinAppPass is the closer technical reference: the platform can make a Subscriber inactive server-side, but the installed extension or its backend is the component that applies that decision to premium behavior. Setapp's stronger macOS behavior depends on its separately installed desktop Launch Agent, a control SERP does not have over independently distributed Chromium extensions. This evidence supports a black-box active/inactive behavior check if SERP promises loss of access; it does not by itself establish a need for source-code inspection.

## What aligns with the proposed SERP direction

### Strong alignment

1. **Developer-initiated application.** Both references allow developers to express interest or apply. An Operator-created invitation may be useful after acceptance, but it should not be the public starting point.
2. **Admission remains controlled.** Neither program treats submission as automatic catalog publication. Setapp explicitly prioritizes quality over app quantity; JoinAppPass still verifies a store-published integration before marking it Live.
3. **Internal identifiers are platform-owned.** Setapp generates app-specific public keys after registration. This supports SERP generating its own Publisher/App identities rather than asking applicants to invent them. ([Setapp public key](https://docs.setapp.com/docs/add-a-public-key-to-your-app))
4. **Integration followed by an actual release-candidate review.** Both require the integration to exist in the artifact users will run before final go-live approval.
5. **Updates need a controlled path.** Setapp's version submission and facilitated re-review provide the stronger model for SERP.
6. **Publisher earnings are attributed from verified subscriber usage/activation, then paid separately.** Both references separate the user subscription from publisher revenue reporting and payout.

### Important correction to the current discussion

Requiring source code is **not necessary in the logical sense** for a subscription-entitlement platform, and neither reference publicly requires it as a default. It is necessary only if SERP chooses a policy that promises source-level inspection, reproducible builds, code custody, or SERP-controlled rebuilding/distribution.

For the stated goal—avoiding a low-quality, unsafe catalog—the minimum analogous to Setapp is not merely a URL or manifest. It is:

1. developer/application screening;
2. the exact installable extension package intended for release;
3. stable store/runtime identity and ownership evidence;
4. an SDK-integrated candidate;
5. automated package/static checks;
6. human functional, permission, privacy, IP, and quality review;
7. explicit approve/decline authority;
8. the same gated procedure for material updates; and
9. suspension/removal capability after release.

A mandatory source ZIP can be added as a **SERP-specific stronger control**, ideally after preliminary acceptance. Before doing so, SERP should explicitly decide:

- whether source is for inspection only or also rebuilding/redistribution;
- retention, encryption, access logging, and deletion requirements;
- whether uploaded dependencies and build tools are executed, and in what isolated environment;
- what “reproducible” means for Chromium extensions whose store packaging may differ;
- who owns incident response for leaked secrets or third-party code found in submissions; and
- what contractual license permits SERP to inspect, preserve, build, and distribute the code.

## Recommended SERP intake shape derived from the comparison

This is a recommendation, not a claim about either reference:

1. **Application:** developer submits identity/contact, public listing, runtime ID, product description, permissions/privacy details, ownership/IP attestation, and representative screenshots/video.
2. **Preliminary Operator decision:** decline, request information, or accept into technical onboarding. Acceptance generates platform-owned Publisher and App IDs and an activation link.
3. **Integration package:** accepted developer integrates the SERP SDK, then uploads the exact extension ZIP and optionally/mandatorily (depending on the policy decision) a source snapshot plus build instructions.
4. **Automated intake:** archive safety, manifest/runtime consistency, permissions delta, secret/malware/static checks, SDK identity binding, and duplicate/conflict detection.
5. **Human review:** ownership, product value, functional behavior, privacy/security, UX quality, permissions justification, premium-feature behavior, and policy compliance.
6. **Approval:** only an Operator decision makes the App catalog-visible and entitlement-eligible.
7. **Versioned updates:** every material package becomes a new immutable submission and requires checks/review before promotion.
8. **Operations:** ongoing quality monitoring, suspension/removal, earnings ledger, and separately controlled publisher payment.

## Confidence and limitations

- **High confidence:** the documented public sequences, distribution differences, review/build behavior, and published revenue models.
- **Medium confidence:** interpreting Setapp as a preliminary product gate followed by a final integrated-build gate; this reconciles its high-level developer page with its detailed submission docs.
- **Unknown:** private agreements, authenticated form fields, internal security tools, exceptional source-access requests, and unpublished manual review practices at either company.
