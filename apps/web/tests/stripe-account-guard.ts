import assert from "node:assert/strict";

import { assertStripePlatformAccount } from "../src/billing/stripe/client";
import { readStripeConnectOnboardingConfig, readStripeHostedBillingConfig, readStripeWebhookConfig } from "../src/billing/stripe/config";

const base = {
  APP_ENV: "staging",
  STRIPE_SECRET_KEY: "sk_test_local_guard",
  STRIPE_WEBHOOK_SECRET: "whsec_local_guard",
  STRIPE_PASS_PRICE_ID: "price_local_guard",
} as unknown as CloudflareEnv;

assert.equal(readStripeHostedBillingConfig(base), null, "hosted billing must remain disabled without an expected Account ID");
assert.ok(readStripeWebhookConfig(base), "account-free webhook signature tests must remain configurable");
assert.equal(readStripeConnectOnboardingConfig(base), null, "Connect onboarding must remain explicitly disabled");
assert.throws(
  () => readStripeConnectOnboardingConfig({ ...base, STRIPE_CONNECT_ONBOARDING_ENABLED: "1" } as unknown as CloudflareEnv),
  /enabled without an API key and expected Account ID/,
);

const guarded = readStripeHostedBillingConfig({
  ...base,
  STRIPE_EXPECTED_ACCOUNT_ID: "acct_expected",
} as unknown as CloudflareEnv);
assert.equal(guarded?.expectedAccountId, "acct_expected");
const connectGuarded = readStripeConnectOnboardingConfig({
  ...base,
  STRIPE_CONNECT_ONBOARDING_ENABLED: "1",
  STRIPE_EXPECTED_ACCOUNT_ID: "acct_expected",
} as unknown as CloudflareEnv);
assert.equal(connectGuarded?.expectedAccountId, "acct_expected");
assert.throws(
  () => readStripeConnectOnboardingConfig({
    ...base,
    APP_ENV: "production",
    STRIPE_CONNECT_ONBOARDING_ENABLED: "1",
    STRIPE_EXPECTED_ACCOUNT_ID: "acct_expected",
  } as unknown as CloudflareEnv),
  /key mode does not match/,
);

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
