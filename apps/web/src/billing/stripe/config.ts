export type StripeEnvironment = CloudflareEnv & {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PASS_PRICE_ID?: string;
};

export function readStripeApiConfig(environment: CloudflareEnv) {
  const env = environment as StripeEnvironment;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PASS_PRICE_ID) return null;
  if (!env.STRIPE_PASS_PRICE_ID.startsWith("price_")) throw new Error("Stripe Pass Price ID format is invalid");
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    passPriceId: env.STRIPE_PASS_PRICE_ID,
  };
}

export function readStripeWebhookConfig(environment: CloudflareEnv) {
  const api = readStripeApiConfig(environment);
  const webhookSecret = (environment as StripeEnvironment).STRIPE_WEBHOOK_SECRET;
  if (!api || !webhookSecret) return null;
  if (!webhookSecret.startsWith("whsec_")) throw new Error("Stripe webhook secret format is invalid");
  return { ...api, webhookSecret };
}
