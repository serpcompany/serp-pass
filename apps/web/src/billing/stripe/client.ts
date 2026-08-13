import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export function createStripeClient(secretKey: string, environment: CloudflareEnv["APP_ENV"]) {
  const expectedPrefix = environment === "production" ? "sk_live_" : "sk_test_";
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error(`Stripe secret key mode does not match ${environment}`);
  }
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "SERP Apps Pass", version: "0.0.0-private-pilot" },
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    telemetry: false,
    timeout: 20_000,
  });
}

export function createStripeCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}

export async function assertStripePlatformAccount(stripe: Stripe, expectedAccountId: string) {
  const account = await stripe.accounts.retrieveCurrent();
  if (account.id !== expectedAccountId) {
    throw new Error("Stripe API credential belongs to an unexpected platform Account");
  }
}

export { STRIPE_API_VERSION };
