import { stripeApiKeyMatchesEnvironment } from "./client";

export type StripeEnvironment = CloudflareEnv & {
  STRIPE_EXPECTED_ACCOUNT_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CONNECT_WEBHOOK_SECRET?: string;
  STRIPE_PASS_PRICE_ID?: string;
  STRIPE_CONNECT_ONBOARDING_ENABLED?: string;
  STRIPE_TEST_TRANSFERS_ENABLED?: string;
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

export function readStripeConnectWebhookConfig(environment: CloudflareEnv) {
  const env = environment as StripeEnvironment;
  const secretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET ?? (environment.APP_ENV === "local" ? env.STRIPE_WEBHOOK_SECRET : undefined);
  if (!secretKey || !webhookSecret) return null;
  if (!webhookSecret.startsWith("whsec_")) throw new Error("Stripe Connect webhook secret format is invalid");
  return { secretKey, webhookSecret };
}

export function readStripeConnectOnboardingConfig(environment: CloudflareEnv) {
  const env = environment as StripeEnvironment;
  if (env.STRIPE_CONNECT_ONBOARDING_ENABLED !== "1") return null;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_EXPECTED_ACCOUNT_ID) throw new Error("Stripe Connect onboarding is enabled without an API key and expected Account ID");
  if (!stripeApiKeyMatchesEnvironment(env.STRIPE_SECRET_KEY, environment.APP_ENV)) throw new Error("Stripe Connect API key mode does not match the environment");
  if (!/^acct_[A-Za-z0-9]+$/u.test(env.STRIPE_EXPECTED_ACCOUNT_ID)) throw new Error("Stripe expected Account ID format is invalid");
  return { secretKey: env.STRIPE_SECRET_KEY, expectedAccountId: env.STRIPE_EXPECTED_ACCOUNT_ID };
}

export function readStripeTestSettlementConfig(environment: CloudflareEnv) {
  const env = environment as StripeEnvironment;
  if (environment.APP_ENV !== "staging" || env.STRIPE_TEST_TRANSFERS_ENABLED !== "1") return null;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_EXPECTED_ACCOUNT_ID) throw new Error("Stripe test settlement is enabled without an API key and expected Account ID");
  if (!stripeApiKeyMatchesEnvironment(env.STRIPE_SECRET_KEY, environment.APP_ENV)) throw new Error("Stripe test settlement requires a test-mode API key");
  if (!/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_EXPECTED_ACCOUNT_ID)) throw new Error("Stripe expected Account ID format is invalid");
  return { secretKey: env.STRIPE_SECRET_KEY, expectedAccountId: env.STRIPE_EXPECTED_ACCOUNT_ID };
}
