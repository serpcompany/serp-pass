import type Stripe from "stripe";

import type { BillingMode } from "@/billing/events";
import { billingRecordId } from "@/billing/identity";
import { PUBLISHER_METADATA_KEY } from "@/connect/projection";

type ConnectOnboardingExecutor = {
  createAccount(input: { publisherId: string; email: string; country: string; idempotencyKey: string }): Promise<{ id: string }>;
  createAccountLink(input: { accountId: string; refreshUrl: string; returnUrl: string }): Promise<{ url: string }>;
};

type OnboardingRow = {
  id: string;
  country: string;
  provider_account_id: string | null;
  idempotency_key: string;
  status: "creating" | "account_created";
};

export class ConnectOnboardingRejected extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ConnectOnboardingRejected";
  }
}

function countryCode(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z]{2}$/u.test(value)) throw new ConnectOnboardingRejected("Publisher country must be a two-letter code.");
  return value.toUpperCase();
}

function stripeAccountId(value: string) {
  if (!/^acct_[A-Za-z0-9_]+$/u.test(value)) throw new Error("Stripe returned an invalid connected Account ID");
  return value;
}

function stripeHostedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "connect.stripe.com") throw new Error("Stripe returned an unexpected onboarding URL");
  return url.toString();
}

async function onboardingRow(db: CloudflareEnv["DB"], publisherId: string, mode: BillingMode) {
  return db.prepare("SELECT id, country, provider_account_id, idempotency_key, status FROM publisher_connect_onboarding WHERE provider = 'stripe' AND mode = ? AND publisher_id = ?")
    .bind(mode, publisherId)
    .first<OnboardingRow>();
}

export async function beginConnectOnboarding(input: {
  db: CloudflareEnv["DB"];
  mode: BillingMode;
  actorUserId: string;
  actorEmail: string;
  publisherId: string;
  country: unknown;
  applicationOrigin: string;
  executor: ConnectOnboardingExecutor;
}) {
  const country = countryCode(input.country);
  if (!/^pub_[a-z0-9][a-z0-9_]{2,59}$/u.test(input.publisherId)) throw new ConnectOnboardingRejected("Publisher identity is invalid.");
  const membership = await input.db.prepare("SELECT p.status FROM publisher p INNER JOIN publisher_membership pm ON pm.publisher_id = p.id WHERE p.id = ? AND pm.user_id = ?")
    .bind(input.publisherId, input.actorUserId)
    .first<{ status: string }>();
  if (!membership || membership.status !== "active") throw new ConnectOnboardingRejected("Active Publisher Membership required.", 403);

  let row = await onboardingRow(input.db, input.publisherId, input.mode);
  if (!row) {
    const now = Math.floor(Date.now() / 1000);
    const id = billingRecordId("connect-onboarding", input.mode, input.publisherId);
    const idempotencyKey = `apps-pass-connect-account:${input.mode}:${input.publisherId}`;
    await input.db.prepare("INSERT OR IGNORE INTO publisher_connect_onboarding (id, publisher_id, provider, mode, country, provider_account_id, idempotency_key, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, 'stripe', ?, ?, NULL, ?, 'creating', ?, ?, ?)")
      .bind(id, input.publisherId, input.mode, country, idempotencyKey, input.actorUserId, now, now)
      .run();
    row = await onboardingRow(input.db, input.publisherId, input.mode);
  }
  if (!row) throw new Error("Could not establish an idempotent Connect onboarding record");
  if (row.country !== country) throw new ConnectOnboardingRejected(`Publisher country is already fixed as ${row.country}.`, 409);

  let accountId = row.provider_account_id;
  if (!accountId) {
    const account = await input.executor.createAccount({ publisherId: input.publisherId, email: input.actorEmail, country, idempotencyKey: row.idempotency_key });
    accountId = stripeAccountId(account.id);
    await input.db.prepare("UPDATE publisher_connect_onboarding SET provider_account_id = ?, status = 'account_created', updated_at = ? WHERE id = ? AND provider_account_id IS NULL AND status = 'creating'")
      .bind(accountId, Math.floor(Date.now() / 1000), row.id)
      .run();
    const recorded = await onboardingRow(input.db, input.publisherId, input.mode);
    if (!recorded?.provider_account_id) throw new Error("Connect Account creation was not recorded");
    if (recorded.provider_account_id !== accountId) throw new Error("Connect Account creation conflicted with another request");
    accountId = recorded.provider_account_id;
  }

  const link = await input.executor.createAccountLink({
    accountId,
    refreshUrl: `${input.applicationOrigin}/publisher?connect=refresh`,
    returnUrl: `${input.applicationOrigin}/publisher?connect=returned`,
  });
  return { publisherId: input.publisherId, providerAccountId: accountId, url: stripeHostedUrl(link.url) };
}

export function stripeConnectOnboardingExecutor(stripe: Stripe): ConnectOnboardingExecutor {
  return {
    async createAccount(input) {
      return stripe.accounts.create({
        type: "express",
        country: input.country,
        email: input.email,
        capabilities: { transfers: { requested: true } },
        metadata: { [PUBLISHER_METADATA_KEY]: input.publisherId },
      }, { idempotencyKey: input.idempotencyKey });
    },
    async createAccountLink(input) {
      return stripe.accountLinks.create({
        account: input.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: "account_onboarding",
        collection_options: { fields: "eventually_due" },
      });
    },
  };
}

export function localConnectOnboardingExecutor(): ConnectOnboardingExecutor {
  return {
    createAccount: async ({ publisherId }) => ({ id: `acct_local_${publisherId}` }),
    createAccountLink: async ({ accountId }) => ({ url: `https://connect.stripe.com/setup/c/${accountId}/${crypto.randomUUID()}` }),
  };
}
