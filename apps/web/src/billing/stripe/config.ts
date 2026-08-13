export type StripeEnvironment = CloudflareEnv & {
  STRIPE_EXPECTED_ACCOUNT_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PASS_PRICE_ID?: string;
};

function readStripeApiConfig(environment: CloudflareEnv) {
  const env = environment as StripeEnvironment;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PASS_PRICE_ID) return null;
  if (!env.STRIPE_PASS_PRICE_ID.startsWith("price_")) throw new Error("Stripe Pass Price ID format is invalid");
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    passPriceId: env.STRIPE_PASS_PRICE_ID,
  };
}

export function readStripeHostedBillingConfig(environment: CloudflareEnv) {
  const api = readStripeApiConfig(environment);
  const expectedAccountId = (environment as StripeEnvironment).STRIPE_EXPECTED_ACCOUNT_ID;
  if (!api || !expectedAccountId) return null;
  if (!/^acct_[A-Za-z0-9]+$/.test(expectedAccountId)) throw new Error("Stripe expected Account ID format is invalid");
  return { ...api, expectedAccountId };
}

export function readStripeWebhookConfig(environment: CloudflareEnv) {
  const api = readStripeApiConfig(environment);
  const webhookSecret = (environment as StripeEnvironment).STRIPE_WEBHOOK_SECRET;
  if (!api || !webhookSecret) return null;
  if (!webhookSecret.startsWith("whsec_")) throw new Error("Stripe webhook secret format is invalid");
  return { ...api, webhookSecret };
}
