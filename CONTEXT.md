# SERP Apps Pass

SERP Apps Pass is a subscription entitlement and Publisher-settlement system for approved independently distributed Apps.

## Language

**Operator**:
The trusted SERP role that controls invitations, identifiers, App approval, authority changes, allocations, and settlement release.
_Avoid_: Admin, owner

**Publisher**:
A person or organization authorized to submit and earn from one or more Apps.
_Avoid_: Partner, developer, vendor

**Publisher Applicant**:
A person or organization asking SERP to consider one proposed App. An Applicant is not a Publisher and has no submission, catalog, or earning authority.
_Avoid_: Publisher, invited Publisher

**Publisher Application**:
A public, developer-initiated proposal containing contact, product, ownership, distribution, privacy, and quality facts for SERP's preliminary review.
_Avoid_: Invitation, App Submission, Publisher account

**Preliminary Acceptance**:
The Operator decision that admits an Applicant to technical onboarding and causes Apps Pass to generate Publisher/App identities and an email-bound invitation. It does not approve an App for the Pass.
_Avoid_: Approval, publication, invitation

**Publisher Membership**:
The authorization connecting one signed-in human to one Publisher.
_Avoid_: Publisher role, developer account

**Subscriber**:
A human customer whose paid-through Subscription may grant access to approved Apps.
_Avoid_: Customer, user, member

**Pass**:
The bundle of approved Apps governed by one Subscription.
_Avoid_: Marketplace, plan, package

**App**:
One approved product participating in the Pass; initially a Chromium extension.
_Avoid_: Plugin, integration

**App Assignment**:
A system-generated reservation authorizing one Publisher to submit facts for one immutable public App identifier.
_Avoid_: Slot, claimed App ID

**Public Publisher ID**:
An immutable Apps Pass-generated identity for one Publisher. It is not chosen by a Publisher or Operator and is separate from the Publisher's display name.
_Avoid_: Publisher name, developer ID

**Public App ID**:
An immutable Apps Pass-generated identity for one App, used by the SDK and authority. It is separate from every browser runtime or store identity.
_Avoid_: Extension ID, runtime ID, App name

**Distribution**:
An approved public browser/channel/runtime identity through which an App is installed.
_Avoid_: Extension ID, store listing

**Submission**:
A versioned technical release candidate containing the public App manifest, ownership evidence, and the exact installable Review Package, pending Operator review.
_Avoid_: Publisher Application, App, manifest

**Review Package**:
The immutable installable extension archive that a Publisher proposes for one App version. Its digest and inspection facts identify exactly what SERP reviewed; it is not automatically source code.
_Avoid_: Source repository, store URL, App manifest

**Ownership Evidence**:
The Publisher-supplied material an Operator reviews to establish control of a proposed Distribution.
_Avoid_: Automatic verification, proof of copyright

**Subscription**:
The normalized Apps Pass record describing a Subscriber's paid-through access state.
_Avoid_: Stripe subscription, payment

**Billing Customer**:
The environment-scoped mapping between one Subscriber and one payment-provider customer identity.
_Avoid_: Subscriber, Stripe user

**Billing Event**:
A signature-verified, replay-safe provider notification recorded before its normalized transition is trusted.
_Avoid_: Webhook, Subscription

**Checkout Attempt**:
A durable idempotency record for creating or resuming one hosted Subscriber Checkout Session; it never grants access.
_Avoid_: purchase, Subscription, payment

**Invoice**:
The provider invoice projection associated with a normalized Subscription; a paid Invoice may create one Cash Receipt.
_Avoid_: Cash Receipt, payment

**App Link**:
The Subscriber-approved association between one App installation and the Subscriber.
_Avoid_: Login, authorization

**App Session**:
A revocable credential scoped to one App Link and stored as a hash by Apps Pass.
_Avoid_: User session, API key

**Entitlement**:
The current authority decision for one App Session: active, inactive, unauthenticated, revoked, or temporarily unavailable.
_Avoid_: Subscription, license

**Cash Receipt**:
The Apps Pass record that a Stripe Invoice was successfully paid and may later fund an Allocation Run.
_Avoid_: Revenue, Earning, payout

**Allocation Run**:
An immutable balanced posting that divides eligible Cash Receipts among reserve, SERP, and one or more Publisher Earnings.
_Avoid_: Revenue algorithm, payout

**Publisher Earning**:
An amount attributed to a Publisher by a posted Allocation Run, potentially held before settlement.
_Avoid_: Publisher Payment, payout, balance

**Publisher Payment**:
Immutable Apps Pass evidence that SERP completed payment of one eligible Publisher Earning outside Apps Pass. It records method, amount, time, and an opaque provider confirmation reference, but never initiates payment or stores payment credentials.
_Avoid_: Earning, Stripe Transfer, bank credentials

**Transfer**:
A post-MVP or historical Stripe Connect movement from the SERP platform balance to a Publisher connected account. It is not part of the active private-pilot settlement path.
_Avoid_: Earning, payout

**Payout**:
A post-MVP or historical Stripe-observed movement from a Publisher connected account to its external bank account.
_Avoid_: Transfer, settlement

**Settlement**:
The controlled process of paying eligible Publisher Earnings and recording evidence. In the private pilot, SERP completes payment outside Apps Pass and an Operator records a Publisher Payment afterward.
_Avoid_: Allocation, payout
