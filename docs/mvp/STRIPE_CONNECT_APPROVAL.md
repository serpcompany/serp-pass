# Stripe Connect sandbox approval packet

Status: **superseded 2026-08-14; retained as post-MVP experiment history**

Date: **2026-08-13**

## Hard boundary

The active private-pilot PRD no longer uses Stripe Connect. Stripe bills Subscribers only; SERP completes Publisher payments outside Apps Pass and records provider-neutral evidence afterward. Do not execute this packet or enable `STRIPE_CONNECT_ONBOARDING_ENABLED` or `STRIPE_TEST_TRANSFERS_ENABLED` without a new explicit decision.

The intended platform account is `acct_1MwbFJI9EPtyKcIs`, currently named **SERP Pass**. On 2026-08-13 the user approved test-mode Connect onboarding, staging webhooks, one small test Transfer, and its full reversal on that exact account. This does not authorize another account, live mode, production, a real bank account, or real money.

This packet is separate from the Subscriber billing approval. It authorizes nothing unless the user explicitly approves **Stripe test mode on that exact account** and supplies the intended test Publisher country/email plus the exact manually agreed Earning amount. It never authorizes live mode, production, a real bank account, or real money.

## Proposed Connect configuration

Before mutation:

1. Prove the authenticated platform Account ID is exactly `acct_1MwbFJI9EPtyKcIs` and the working context is test/sandbox mode.
2. Inventory existing Connect settings, connected Accounts, and event destinations. Do not overwrite or repurpose unrelated configuration.
3. Confirm the test Publisher country is supported for separate charges and transfers and that the platform/Pubisher regional combination is allowed.
4. Confirm the platform is willing to be merchant of record and responsible for platform fees, refunds, chargebacks, and the applicable connected-account negative-balance model for this test architecture.

Only after those checks:

1. Create or deliberately reuse one Express connected Account for the invited test Publisher, with metadata `apps_pass_publisher_id=<assigned Publisher ID>` and only the capabilities the funds flow actually needs. Separate charges and transfers require the `transfers` capability; do not request card payments merely to make a readiness screen green.
2. Generate single-use Stripe-hosted onboarding links. Treat return URLs only as navigation; readiness comes from signed Account state.
3. Create a connected-account event destination targeting `https://serp-apps-pass-staging.serpcompany.workers.dev/api/stripe/connect-webhook` and subscribe only to:
   - `account.updated`;
   - `payout.created`;
   - `payout.updated`;
   - `payout.paid`;
   - `payout.failed`;
   - `payout.canceled`.
4. Add `transfer.created`, `transfer.updated`, and `transfer.reversed` to the platform-account event destination at `/api/stripe/webhook`.
5. Store the two endpoint signing secrets separately as `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`. Add only test credentials to Cloudflare staging secrets; never put them in Git, logs, screenshots, extension bundles, or production.
6. Keep `STRIPE_TEST_TRANSFERS_ENABLED` absent until Checkout, Connect readiness, the explicit Allocation, and its Earning have all been inspected. Set it to `1` only for the approved test Transfer window.

## Proposed test journey

1. Complete Stripe-hosted onboarding for one invited Publisher.
2. Observe a signed `account.updated` Event on the dedicated Connect endpoint and prove transfers capability, requirements, and payout readiness independently.
3. Complete the separately approved test Subscriber purchase and post one explicitly reviewed Allocation. The application must not infer a revenue-share formula.
4. Use the visible Operator control to release exactly one held Earning. Before the request, re-check the platform Account ID; create one separate Stripe Transfer with the deterministic Earning idempotency key.
5. Repeat the release request and prove no second Transfer is created.
6. Observe signed `transfer.*` evidence separately from the API response and Publisher Earning.
7. Exercise a full test reversal and prove the Transfer, Settlement, and Earning become reversed without rewriting history. Partial reversal remains a stop condition until a correction-ledger workflow is approved.
8. If Stripe emits a connected-account Payout in the sandbox, project its state separately and never use the Transfer as proof that a bank Payout completed.
9. Reconcile Stripe Account, Transfer, connected balance/Payout, and D1 identifiers without recording secrets or hosted URLs.

## Stop and rollback

Stop on any Account ID, mode, country, capability, destination, currency, amount, endpoint-secret, or existing-configuration mismatch. Disable `STRIPE_TEST_TRANSFERS_ENABLED` first. Then disable only the newly created event destinations/objects as appropriate, remove staging Stripe secrets/configuration, redeploy the inert routes, and preserve D1 audit/financial evidence rather than deleting history.

## Remaining execution inputs

- The Publisher identity, App identity, Publisher Membership, and pilot email already exist in Apps Pass.
- Stripe still requires the Publisher's two-letter country code before the Express Account can be created. It must not be inferred from the platform account.
- The user authorized a small test Transfer and full reversal, but the exact Earning amount is not yet fixed. The local `$7 / $2 / $1` example is test data, not an approved revenue-share policy.
- The isolated Stripe CLI profile now verifies exact platform Account `acct_1MwbFJI9EPtyKcIs`. The dedicated Connect webhook and signing secret are configured, but no connected Account exists and onboarding remains disabled pending the country decision.

Official architecture references: [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [Connect webhooks](https://docs.stripe.com/connect/webhooks), and [account capabilities](https://docs.stripe.com/connect/account-capabilities).
