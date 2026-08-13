import assert from "node:assert/strict";

import { assertStripePlatformAccount } from "../src/billing/stripe/client";
import { readStripeHostedBillingConfig, readStripeWebhookConfig } from "../src/billing/stripe/config";

const base = {
  APP_ENV: "staging",
  STRIPE_SECRET_KEY: "sk_test_local_guard",
  STRIPE_WEBHOOK_SECRET: "whsec_local_guard",
  STRIPE_PASS_PRICE_ID: "price_local_guard",
} as unknown as CloudflareEnv;

assert.equal(readStripeHostedBillingConfig(base), null, "hosted billing must remain disabled without an expected Account ID");
assert.ok(readStripeWebhookConfig(base), "account-free webhook signature tests must remain configurable");

const guarded = readStripeHostedBillingConfig({
  ...base,
  STRIPE_EXPECTED_ACCOUNT_ID: "acct_expected",
} as unknown as CloudflareEnv);
assert.equal(guarded?.expectedAccountId, "acct_expected");

let retrieves = 0;
const matchingStripe = {
  accounts: {
    retrieveCurrent: async () => {
      retrieves += 1;
      return { id: "acct_expected" };
    },
  },
} as unknown as Parameters<typeof assertStripePlatformAccount>[0];
await assertStripePlatformAccount(matchingStripe, "acct_expected");
assert.equal(retrieves, 1, "the current Stripe platform Account must be retrieved before mutation");

const mismatchedStripe = {
  accounts: { retrieveCurrent: async () => ({ id: "acct_wrong" }) },
} as unknown as Parameters<typeof assertStripePlatformAccount>[0];
await assert.rejects(
  assertStripePlatformAccount(mismatchedStripe, "acct_expected"),
  /unexpected platform Account/,
  "a credential from another Stripe Account must stop the operation",
);

process.stdout.write("PASS hosted Stripe billing requires and verifies the exact platform Account ID\n");
