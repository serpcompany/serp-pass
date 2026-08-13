import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const expectedAccountId = "acct_1MwbFJI9EPtyKcIs";
const expectedPriceId = "price_1U3zRcI9EPtyKcIsot42EEhL";
const platformWebhookEndpointId = "we_1U3zS9I9EPtyKcIsVOaQ6ycM";
const proveRedirectOnly = process.env.PROVE_REDIRECT_ONLY === "1";
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const suffix = Date.now();
const email = `stripe-checkout-staging-${suffix}@example.test`;
const operatorEmail = `stripe-checkout-operator-${suffix}@example.test`;
const appManifest = JSON.parse(await readFile(path.join(repositoryRoot, "apps/invited-publisher-extension/apppass.json"), "utf8")) as {
  app_id: string; name: string; publisher_name: string; distributions: Array<{ runtime_id: string }>;
};
const runtimeId = appManifest.distributions[0]?.runtime_id;
assert.ok(runtimeId);

const accountId = execFileSync("stripe", ["get", "/v1/account", "--project-name", "serp-appspass"], { encoding: "utf8" });
assert.equal((JSON.parse(accountId) as { id: string }).id, expectedAccountId, "Stripe CLI must target the approved platform Account");

function stripeJson(pathname: string, data: string[] = []) {
  const args = ["get", pathname, "--project-name", "serp-appspass"];
  for (const value of data) args.push("--data", value);
  return JSON.parse(execFileSync("stripe", args, { encoding: "utf8" })) as Record<string, unknown>;
}

function setPlatformWebhookDisabled(disabled: boolean) {
  const endpoint = JSON.parse(execFileSync("stripe", [
    "post", `/v1/webhook_endpoints/${platformWebhookEndpointId}`,
    "--project-name", "serp-appspass", "--data", `disabled=${disabled}`,
  ], { encoding: "utf8" })) as { status: string };
  assert.equal(endpoint.status, disabled ? "disabled" : "enabled");
}

function eventFor(type: string, predicate: (object: Record<string, unknown>) => boolean) {
  const events = stripeJson("/v1/events", ["limit=100", `type=${type}`]) as { data: Array<{ id: string; data: { object: Record<string, unknown> } }> };
  const event = events.data.find((candidate) => predicate(candidate.data.object));
  assert.ok(event, `Stripe ${type} Event must exist for this test purchase`);
  return event.id;
}

function resendEvent(eventId: string) {
  execFileSync("stripe", ["events", "resend", eventId, `--webhook-endpoint=${platformWebhookEndpointId}`, "--confirm", "--project-name", "serp-appspass"], { stdio: "pipe" });
}

const browser = await chromium.launch({ headless: true });
let webhookDisabled = false;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Real Stripe Checkout Subscriber");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  const subscriberUserId = await page.evaluate(async () => ((await (await fetch("/api/auth/get-session")).json()) as { user: { id: string } }).user.id);

  const startCheckout = () => context.request.post(`${appOrigin}/api/billing/checkout`, {
    headers: { origin: appOrigin, referer: `${appOrigin}/account` },
    maxRedirects: 0,
  });
  const first = await startCheckout();
  assert.equal(first.status(), 303, await first.text());
  const firstUrl = first.headers().location;
  assert.ok(firstUrl?.startsWith("https://checkout.stripe.com/"), "Checkout must redirect only to Stripe-hosted Checkout");
  const second = await startCheckout();
  assert.equal(second.status(), 303, await second.text());
  assert.equal(second.headers().location, firstUrl, "duplicate Checkout starts must reuse one Stripe Session");
  const checkoutSessionId = /cs_test_[A-Za-z0-9]+/u.exec(firstUrl)?.[0];
  assert.ok(checkoutSessionId, "Stripe-hosted URL must contain its Checkout Session ID");

  if (proveRedirectOnly) {
    setPlatformWebhookDisabled(true);
    webhookDisabled = true;
  }

  await page.goto(firstUrl);
  await page.locator('input[name="cardNumber"]').fill("4242424242424242");
  await page.locator('input[name="cardExpiry"]').fill("1234");
  await page.locator('input[name="cardCvc"]').fill("123");
  const billingName = page.locator('input[name="billingName"]');
  if (await billingName.count()) await billingName.fill("SERP Pass Test Subscriber");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`${appOrigin}/account?checkout=returned`, { timeout: 90_000 });

  let replayedInvoiceEventId: string | null = null;
  if (proveRedirectOnly) {
    const beforeWebhook = await page.evaluate(async () => (await (await fetch("/api/account/subscription")).json() as { subscription: unknown }).subscription);
    assert.equal(beforeWebhook, null, "Checkout return must remain inactive until signed provider Events are projected");
    setPlatformWebhookDisabled(false);
    webhookDisabled = false;
    const checkoutSession = stripeJson(`/v1/checkout/sessions/${checkoutSessionId}`) as { subscription: string };
    const subscriptionId = checkoutSession.subscription;
    assert.match(subscriptionId, /^sub_/u);
    const checkoutEventId = eventFor("checkout.session.completed", (object) => object.id === checkoutSessionId);
    const subscriptionEventId = eventFor("customer.subscription.created", (object) => object.id === subscriptionId);
    replayedInvoiceEventId = eventFor("invoice.paid", (object) => {
      const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined;
      return parent?.subscription_details?.subscription === subscriptionId;
    });
    resendEvent(checkoutEventId);
    resendEvent(subscriptionEventId);
    resendEvent(replayedInvoiceEventId);
  }

  const deadline = Date.now() + 90_000;
  let subscription: unknown = null;
  while (Date.now() < deadline) {
    subscription = await page.evaluate(async () => (await (await fetch("/api/account/subscription")).json() as { subscription: unknown }).subscription);
    if ((subscription as { access?: string } | null)?.access === "active") break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.deepEqual(subscription, {
    provider: "stripe",
    mode: "test",
    status: "active",
    cancelAtPeriodEnd: false,
    entitledUntil: (subscription as { entitledUntil?: string }).entitledUntil,
    access: "active",
  });
  assert.match((subscription as { entitledUntil: string }).entitledUntil, /^\d{4}-\d{2}-\d{2}T/u);

  const operatorContext = await browser.newContext();
  const operatorPage = await operatorContext.newPage();
  await operatorPage.goto(`${appOrigin}/account`);
  await operatorPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await operatorPage.getByLabel("Name").fill("Stripe Checkout Operator");
  await operatorPage.getByLabel("Email").fill(operatorEmail);
  await operatorPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await operatorPage.getByRole("button", { name: "Create account" }).click();
  await operatorPage.getByText("Human session active").waitFor();
  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", "--staging", operatorEmail], { cwd: repositoryRoot, stdio: "pipe" });
  const audit = await operatorPage.evaluate(async (id) => {
    const response = await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(id)}`);
    return { status: response.status, body: await response.json() as { counts: Record<string, number>; issues: string[]; trace: Record<string, unknown[]> } };
  }, subscriberUserId);
  assert.equal(audit.status, 200);
  assert.deepEqual(audit.body.issues, []);
  assert.equal(audit.body.counts.customers, 1);
  assert.equal(audit.body.counts.subscriptions, 1);
  assert.equal(audit.body.counts.cashReceipts, 1);
  assert.equal(audit.body.trace.checkoutAttempts.length, 1);
  assert.equal(audit.body.trace.billingCustomers.length, 1);
  assert.equal(audit.body.trace.subscriptions.length, 1);
  assert.ok(audit.body.trace.billingEvents.length >= 2);
  assert.equal(audit.body.trace.invoices.length, 1);
  assert.equal(audit.body.trace.cashReceipts.length, 1);
  assert.doesNotMatch(JSON.stringify(audit.body), /token|proof|payload|idempotency|email|hosted|url|installation|revokeReason/iu);
  await operatorContext.close();

  const checkoutAttempt = audit.body.trace.checkoutAttempts[0] as { providerSessionId: string };
  const session = stripeJson(`/v1/checkout/sessions/${checkoutAttempt.providerSessionId}`) as {
    livemode: boolean; status: string; payment_status: string; client_reference_id: string; subscription: string; metadata: Record<string, string>; line_items?: unknown;
  };
  assert.equal(session.livemode, false);
  assert.equal(session.status, "complete");
  assert.equal(session.payment_status, "paid");
  assert.equal(session.client_reference_id, subscriberUserId);
  assert.equal(session.metadata.apps_pass_subscriber_user_id, subscriberUserId);
  const lineItems = stripeJson(`/v1/checkout/sessions/${checkoutAttempt.providerSessionId}/line_items`) as {
    data: Array<{ price: { id: string }; amount_total: number; currency: string }>;
  };
  assert.deepEqual(lineItems.data.map((item) => ({ priceId: item.price.id, amount: item.amount_total, currency: item.currency })), [
    { priceId: expectedPriceId, amount: 1_000, currency: "usd" },
  ]);

  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Manage billing in Stripe" }).click();
  await page.waitForURL(/^https:\/\/billing\.stripe\.com\//u, { timeout: 30_000 });
  const cancelControl = page.getByRole("button", { name: /Cancel (plan|subscription)/iu })
    .or(page.getByRole("link", { name: /Cancel (plan|subscription)/iu }))
    .first();
  await cancelControl.click();
  const confirmCancellation = page.getByRole("button", { name: /Cancel (plan|subscription)|Confirm cancellation/iu }).last();
  await confirmCancellation.click();
  const stripeCancelDeadline = Date.now() + 30_000;
  let stripeCancellation: number | null = null;
  while (Date.now() < stripeCancelDeadline) {
    stripeCancellation = (stripeJson(`/v1/subscriptions/${session.subscription}`) as { cancel_at: number | null }).cancel_at;
    if (stripeCancellation) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(typeof stripeCancellation, "number", "rendered Portal cancellation must schedule the Stripe Subscription end");
  await page.goto(`${appOrigin}/account`);
  const cancelDeadline = Date.now() + 60_000;
  let canceledSubscription = subscription as { cancelAtPeriodEnd?: boolean; access?: string };
  while (Date.now() < cancelDeadline) {
    canceledSubscription = await page.evaluate(async () => (await (await fetch("/api/account/subscription")).json() as { subscription: typeof canceledSubscription }).subscription);
    if (canceledSubscription.cancelAtPeriodEnd) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.equal(canceledSubscription.cancelAtPeriodEnd, true, "Portal cancellation must project from a signed Subscription Event");
  assert.equal(canceledSubscription.access, "active", "cancellation at period end must preserve already-paid access");
  await page.reload();
  await page.getByText("Cancellation scheduled; access remains active through the paid-through date.").waitFor();

  const browserState = JSON.parse(await readFile(path.join(repositoryRoot, ".extension-dev-browser/state.json"), "utf8")) as {
    status: string; cdpUrl: string; extensions: Array<{ id: string; pageUrl: string }>;
  };
  assert.equal(browserState.status, "ready");
  const extension = browserState.extensions.find((candidate) => candidate.id === runtimeId);
  assert.ok(extension, "the real invited-Publisher extension must be loaded in the project-owned browser");
  const extensionBrowser = await chromium.connectOverCDP(browserState.cdpUrl);
  const extensionContext = extensionBrowser.contexts()[0];
  assert.ok(extensionContext);
  await extensionContext.clearCookies();
  const existingPopups = extensionContext.pages().filter((candidate) => candidate.url().startsWith(extension.pageUrl));
  const popup = existingPopups[0] ?? await extensionContext.newPage();
  for (const duplicate of existingPopups.slice(1)) await duplicate.close();
  await popup.goto(`${extension.pageUrl}?authority=${encodeURIComponent(appOrigin)}`);
  await popup.evaluate(async () => void await (globalThis as unknown as { chrome: { storage: { local: { clear(): Promise<void> } } } }).chrome.storage.local.clear());
  await popup.reload();
  await popup.getByText("Approved by Apps Pass").waitFor();
  const extensionSubscriberPage = await extensionContext.newPage();
  await extensionSubscriberPage.goto(`${appOrigin}/account`);
  await extensionSubscriberPage.getByLabel("Email").fill(email);
  await extensionSubscriberPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await extensionSubscriberPage.getByRole("button", { name: "Sign in" }).click();
  await extensionSubscriberPage.getByText("Human session active").waitFor();
  const activationPromise = extensionContext.waitForEvent("page");
  await popup.getByRole("button", { name: "Link with Apps Pass" }).click();
  const activation = await activationPromise;
  await activation.waitForURL(`${appOrigin}/activate/**`);
  await activation.getByRole("heading", { name: appManifest.name }).waitFor();
  await activation.getByRole("button", { name: "Approve this extension" }).click();
  await activation.getByText("Approved. Return to the extension and choose Finish linking.").waitFor();
  await popup.reload();
  await popup.getByRole("button", { name: "Finish linking after approval" }).click();
  await popup.getByText("Linked. Apps Pass access can now be checked.").waitFor();
  await popup.getByRole("button", { name: "Check Apps Pass access" }).click();
  await popup.getByText("active", { exact: true }).waitFor();
  await popup.getByText("Premium feature access is active.").waitFor();
  await activation.close();
  await extensionSubscriberPage.close();

  if (replayedInvoiceEventId) {
    resendEvent(replayedInvoiceEventId);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const replayOperatorContext = await browser.newContext();
    const replayOperatorPage = await replayOperatorContext.newPage();
    await replayOperatorPage.goto(`${appOrigin}/account`);
    await replayOperatorPage.getByLabel("Email").fill(operatorEmail);
    await replayOperatorPage.getByLabel("Password").fill("correct-horse-battery-staple");
    await replayOperatorPage.getByRole("button", { name: "Sign in" }).click();
    await replayOperatorPage.getByText("Human session active").waitFor();
    const afterReplay = await replayOperatorPage.evaluate(async (id) => (await (await fetch(`/api/operator/billing/audit?subscriberUserId=${encodeURIComponent(id)}`)).json()) as { counts: { cashReceipts: number }; trace: { billingEvents: string[] } }, subscriberUserId);
    assert.equal(afterReplay.counts.cashReceipts, 1, "replayed Invoice Event must not create a second Cash Receipt");
    assert.equal(afterReplay.trace.billingEvents.filter((id) => id === replayedInvoiceEventId).length, 1, "replayed provider Event must remain singular");
    await replayOperatorContext.close();
  }

  process.stdout.write(`${proveRedirectOnly ? "PASS Checkout return stayed inactive until real Stripe Event resend, then activated exactly once" : "PASS real Stripe Checkout completed and signed provider Events granted paid-through access"}; the real Publisher extension independently received active (${subscriberUserId})\n`);
} finally {
  if (webhookDisabled) setPlatformWebhookDisabled(false);
  await browser.close();
}
setTimeout(() => process.exit(0), 0);
