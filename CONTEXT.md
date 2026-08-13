# SERP Apps Pass

SERP Apps Pass is a subscription entitlement and Publisher-settlement system for approved independently distributed Apps.

## Language

**Operator**:
The trusted SERP role that controls invitations, identifiers, App approval, authority changes, allocations, and settlement release.
_Avoid_: Admin, owner

**Publisher**:
A person or organization authorized to submit and earn from one or more Apps.
_Avoid_: Partner, developer, vendor

**Subscriber**:
A human customer whose paid-through Subscription may grant access to approved Apps.
_Avoid_: Customer, user, member

**Pass**:
The bundle of approved Apps governed by one Subscription.
_Avoid_: Marketplace, plan, package

**App**:
One approved product participating in the Pass; initially a Chromium extension.
_Avoid_: Plugin, integration

**Distribution**:
An approved public browser/channel/runtime identity through which an App is installed.
_Avoid_: Extension ID, store listing

**Submission**:
A versioned Publisher proposal to register one App and its Distributions, pending Operator review.
_Avoid_: App, manifest

**Subscription**:
The normalized Apps Pass record describing a Subscriber's paid-through access state.
_Avoid_: Stripe subscription, payment

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
_Avoid_: Transfer, payout, balance

**Transfer**:
A Stripe movement from the SERP platform balance to a Publisher connected account.
_Avoid_: Earning, payout

**Payout**:
A Stripe-observed movement from a Publisher connected account to its external bank account.
_Avoid_: Transfer, settlement

**Settlement**:
The controlled process of releasing eligible Publisher Earnings into Transfers and reconciling their outcomes.
_Avoid_: Allocation, payout
