# Stripe sandbox state

Updated: **2026-08-14**

This is the durable inventory and evidence record for the explicitly approved test-mode integration. It is not a live-mode or production authorization.

## Account and credential boundary

- Platform Account: `acct_1MwbFJI9EPtyKcIs` (**SERP Pass**), verified before mutation.
- Mode: test only; every created object reports `livemode: false`.
- Staging uses the Stripe CLI-issued account-scoped restricted test key. It expires on **2026-11-11** and is stored only as the Cloudflare secret `STRIPE_SECRET_KEY`.
- Production still accepts only a `sk_live_` credential and remains unconfigured and undeployed.
- Webhook signing values are stored separately as `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`. No credential or signing value is in Git, D1, logs, screenshots, or an extension bundle.

## Created test objects

| Purpose | Stripe ID | Exact configuration |
| --- | --- | --- |
| Product | `prod_V47gb68aSMy1ec` | SERP Pass; Apps Pass staging metadata |
| Price | `price_1U3zRcI9EPtyKcIsot42EEhL` | USD 1000; monthly; licensed; active |
| Customer Portal | `bpc_1U3zRdI9EPtyKcIsnYKb6o21` | payment-method update; cancellation scheduled at period end; no plan switching or pause |
| Platform webhook | `we_1U3zS9I9EPtyKcIsVOaQ6ycM` | Checkout, Invoice, Subscription, and Transfer Events only |
| Connect webhook | `we_1U3zSBI9EPtyKcIs9SxpuyrY` | connected Account and Payout Events only |

The pre-mutation inventory contained zero Products, Prices, Portal configurations, webhook endpoints, and connected Accounts, so no unrelated object was reused or overwritten.

## Real staging evidence

`pnpm mvp:stripe-checkout:test-staging` now performs a real rendered-browser journey against deployed staging:

1. creates distinct Subscriber and Operator accounts;
2. starts Checkout twice and proves one Stripe-hosted Session is reused;
3. completes Stripe-hosted Checkout with public test payment data;
4. waits for signature-verified provider Events;
5. proves one normalized Subscription, Invoice, and Cash Receipt;
6. reconciles the exact test Price, amount, currency, Customer, Subscription, Invoice, and Checkout IDs through the protected Operator trace;
7. cancels through the rendered Customer Portal and proves signed scheduled-cancellation state preserves already-paid access;
8. links the real invited-Publisher extension in the repo-owned Chromium instance and proves the SDK independently receives `active`;
9. leaves the repo-owned browser running.

`pnpm mvp:stripe-checkout:test-redirect-boundary` additionally disables only the newly created platform webhook, completes a fresh test Checkout, proves the browser return remains inactive, re-enables the endpoint, resends the exact recorded provider Events, and proves duplicate Invoice delivery leaves one Event and one Cash Receipt.

## Provider-shape findings

The first real purchase exposed that Dahlia Invoice top-level `period_end` is the Invoice-generation window, while the configured Price line contains the recurring service period. That first test Subscription/Invoice is preserved as failed acceptance evidence (`sub_1U3zYqI9EPtyKcIs7Nq4262v`, `in_1U3zYoI9EPtyKcIseI0KUg2H`) and is not used for allocation. The adapter now derives paid-through time from configured-Price line periods, and a fresh real purchase passed.

The real Customer Portal represented scheduled cancellation with `cancel_at` while leaving `cancel_at_period_end` false and status active. The adapter now recognizes both provider representations and the UI says **Cancellation scheduled** rather than claiming cancellation is already complete.

## Approved staging settlement proof

- Synthetic Publisher: `pub_invited_pilot_real`; country fixed as `US`. This is test data, not a real person or business.
- Source Cash Receipt: `receipt:test:in_1U3znNI9EPtyKcIs6md4w0SV`, created from a successful real Stripe test Checkout and not previously allocated.
- Allocation Run: `alloc_staging_real_10usd_20260814`.
- Immutable split: `$7.00` Publisher Earning (`earning_staging_pub_real_700_20260814`), `$2.00` platform, and `$1.00` reserve.
- The first posting returned `posted`; replaying the exact request returned `duplicate` and created no second allocation.
- Stripe Connect onboarding is enabled only in staging. The first Account-creation attempt was rejected by Stripe because this platform Account has not completed the one-time Connect platform signup. D1 preserves an idempotent `creating` onboarding row without a connected Account ID, so the same Publisher can safely continue after that platform setup.
- Stripe test Transfer execution remains disabled. No Transfer or Payout exists.

## Still gated

- No connected Account exists. Account creation is blocked on the one-time Connect platform signup in the Stripe Dashboard.
- Test Transfers remain disabled until signed `account.updated` evidence proves the synthetic Publisher Account is settlement-ready.
- No live-mode object, real card, real bank account, production secret, production D1, or production Worker exists.
