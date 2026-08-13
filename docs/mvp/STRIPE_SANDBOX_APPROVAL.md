# Stripe sandbox approval packet

Status: **proposed test-mode actions; no approval granted and no Stripe account accessed**

Date: **2026-08-13**

## Hard boundary

The intended isolated Stripe account is `acct_1MwbFJI9EPtyKcIs`, currently named **SERP Pass**. The account identifier supplied in conversation is not authorization to open, inspect, configure, or mutate the account.

Every action below is test/sandbox mode only. Nothing authorizes live-mode keys, Products, Prices, Customers, subscriptions, payments, Connect accounts, Transfers, production Cloudflare resources, or real money.

## Proposed product configuration

The test-only starting model is deliberately singular:

- Product display name: **SERP Pass**;
- one recurring Price: **USD $10.00 monthly**;
- quantity: one;
- no annual Price, trial, coupon, promotion code, seat, usage charge, or automatic tax;
- hosted Checkout rather than custom payment UI;
- Customer Portal allows payment-method updates and cancellation at period end;
- success/cancel return to the staging `/account` page, which remains confirmation UX only.

The Product name can be renamed later. Stripe Price amount/currency/cadence are immutable economic records; changing one means creating and selecting a replacement Price, not silently editing history.

## Exact account actions proposed

Before any mutation:

1. Authenticate to Stripe without exposing a credential in output.
2. Retrieve the current platform Account and prove its ID is exactly `acct_1MwbFJI9EPtyKcIs` and that the working context is a sandbox/test environment. Stop on any mismatch.
3. Inventory existing test Products, Prices, webhook/event destinations, and Portal configuration so nothing unrelated is overwritten.

Only after those checks:

1. Create or deliberately reuse one test Product named **SERP Pass**, marked with Apps Pass staging metadata.
2. Create or deliberately reuse one active recurring test Price for `usd`, `1000` minor units, monthly.
3. Configure the sandbox Customer Portal for payment-method updates and cancellation at period end; do not enable plan switching or an unapproved alternative Price.
4. Create one staging webhook/event destination targeting `https://serp-apps-pass-staging.serpcompany.workers.dev/api/stripe/webhook` with API version `2026-07-29.dahlia` and only:
   - `checkout.session.completed`;
   - `checkout.session.expired`;
   - `invoice.paid`;
   - `invoice.payment_failed`;
   - `customer.subscription.created`;
   - `customer.subscription.updated`;
   - `customer.subscription.deleted`.
5. Add only the test secret key and endpoint signing secret to the existing Cloudflare staging Worker as secrets; add the chosen Price ID and exact expected platform Account ID `acct_1MwbFJI9EPtyKcIs` as staging configuration. Do not add secrets to local files, Git, production, logs, screenshots, or extension bundles. Checkout and Portal must retrieve the current Stripe platform Account and stop before mutation if its ID differs from the expected Account ID.
6. Confirm the already-applied Checkout-attempt migration and inert routes, add the approved staging Price configuration, and redeploy without changing production.

## Test journey proposed

1. Create a fresh staging Subscriber.
2. Start hosted Checkout twice before paying and prove both requests resolve to one durable attempt and one Stripe Session.
3. Complete Checkout with Stripe test payment data.
4. Prove the browser return alone does not grant access.
5. Observe signature-verified `checkout.session.completed` and `invoice.paid` Events in D1.
6. Prove the Invoice creates one Cash Receipt and extends the normalized paid-through date once.
7. Replay the Event and prove no duplicate state or Cash Receipt appears.
8. Open the Portal, cancel at period end, and prove access remains active only through the paid-through date.
9. Exercise a failed-renewal test fixture/test-clock path and prove it never extends paid-through access.
10. Reconcile Stripe objects against D1 and record identifiers without recording secrets or hosted URLs.

This is a test purchase. It does not use a real card or move real money.

## Stop and rollback

Stop immediately if the account ID, mode, Price, currency, endpoint, API version, or existing unrelated configuration differs from this packet.

Rollback is:

1. disable the staging webhook/event destination;
2. deactivate the newly created test Price if it should no longer be offered;
3. remove the Stripe secrets and Price configuration from the staging Worker;
4. redeploy staging with billing visibly unavailable;
5. retain test D1 Event/attempt/audit records as evidence rather than rewriting financial history.

No pre-existing Stripe object may be deleted or modified merely to make the test pass.

## Approval wording

A sufficient approval can be plain language, but it must explicitly authorize **test mode on `acct_1MwbFJI9EPtyKcIs`** and the proposed Product/Price, webhook, Portal, and Cloudflare staging configuration. Approval for this packet is not approval for Connect, Transfers, production, live mode, or real money.
