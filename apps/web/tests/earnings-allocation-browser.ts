import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
if (!appOrigin.includes("localhost")) throw new Error("The account-independent Allocation test is local-only.");
const suffix = Date.now();
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const webRoot = path.resolve(import.meta.dirname, "..");
const devVarsPath = path.join(repositoryRoot, "apps/web/.dev.vars");
const fixtureSecret = process.env.TEST_BILLING_WEBHOOK_SECRET ?? (existsSync(devVarsPath)
  ? /^TEST_BILLING_WEBHOOK_SECRET=(.+)$/mu.exec(readFileSync(devVarsPath, "utf8"))?.[1]?.trim()
  : undefined);
if (!fixtureSecret) throw new Error("Local signed billing fixture secret is required");
const billingFixtureSecret = fixtureSecret;

function localSql(sql: string) {
  return execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--config", "wrangler.jsonc", "--persist-to", "../../.wrangler/mvp-state", "--command", sql, "--json"], {
    cwd: webRoot,
    encoding: "utf8",
  });
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();
  return page.evaluate(async () => ((await (await fetch("/api/auth/get-session")).json()) as { user: { id: string } }).user.id);
}

async function createPaidReceipt(subscriberUserId: string, invoiceId: string) {
  const event = {
    id: `evt_allocation_paid_${invoiceId}`,
    type: "invoice.paid",
    createdAt: 1_900_300_000,
    mode: "test",
    data: {
      subscriberUserId,
      customerId: `cus_allocation_${suffix}`,
      subscriptionId: `sub_allocation_${suffix}`,
      invoiceId,
      amountPaid: 1_000,
      currency: "usd",
      periodStart: 4_070_908_800,
      periodEnd: 4_102_444_800,
    },
  };
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", billingFixtureSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${appOrigin}/api/billing/test-events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-apps-pass-test-signature": `t=${timestamp},v1=${signature}` },
    body,
  });
  assert.equal(response.status, 202, await response.text());
}

const browser = await chromium.launch({ headless: true });
try {
  const operatorContext = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.44" } });
  const operatorPage = await operatorContext.newPage();
  const operatorEmail = `allocation-operator-${suffix}@example.test`;
  const operatorUserId = await signUp(operatorPage, "Allocation Operator", operatorEmail);
  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", "--local", operatorEmail], { cwd: repositoryRoot, stdio: "pipe" });

  const publisherContext = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.45" } });
  const publisherPage = await publisherContext.newPage();
  const publisherUserId = await signUp(publisherPage, "Allocation Publisher", `allocation-publisher-${suffix}@example.test`);
  const publisherId = `pub_allocation_${suffix}`;
  const now = Math.floor(Date.now() / 1000);
  localSql(`INSERT INTO publisher (id, name, status, created_at, created_by_user_id) VALUES ('${publisherId}', 'Allocation Publisher', 'active', ${now}, '${operatorUserId}'); INSERT INTO publisher_membership (publisher_id, user_id, created_at) VALUES ('${publisherId}', '${publisherUserId}', ${now}); INSERT INTO human_role_assignment (user_id, role, source, granted_at, granted_by_user_id) VALUES ('${publisherUserId}', 'publisher', 'invitation', ${now}, '${operatorUserId}');`);

  const invoiceId = `in_allocation_${suffix}`;
  await createPaidReceipt(operatorUserId, invoiceId);
  const cashReceiptId = `receipt:test:${invoiceId}`;
  const allocationRunId = `alloc_${suffix}`;
  const earningId = `earning_${suffix}`;
  const allocation = {
    schemaVersion: 1,
    allocationRunId,
    currency: "usd",
    receiptAllocations: [{ cashReceiptId, amount: 1_000 }],
    reserveAmount: 100,
    platformAmount: 200,
    publisherEarnings: [{ earningId, publisherId, amount: 700, availableAt: new Date((now - 60) * 1000).toISOString() }],
    reason: "Private-pilot worked allocation agreed by the Operator.",
    agreementReference: `pilot-agreement-${suffix}`,
  };

  await publisherPage.goto(`${appOrigin}/publisher`);
  await publisherPage.getByText("No Publisher Earnings yet.").waitFor();
  const denied = await publisherPage.evaluate(async (body) => (await fetch("/api/operator/allocations", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })).status, allocation);
  assert.equal(denied, 403);

  await operatorPage.goto(`${appOrigin}/operator`);
  const post = async (body: unknown) => operatorPage.evaluate(async (value) => {
    const response = await fetch("/api/operator/allocations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    return { status: response.status, body: await response.json() as unknown };
  }, body);
  assert.deepEqual(await post({ ...allocation, platformAmount: 201 }), {
    status: 400,
    body: { message: "Allocation Run does not balance." },
  });
  const posted = await post(allocation);
  assert.deepEqual(posted, {
    status: 201,
    body: {
      outcome: "posted",
      allocationRunId,
      currency: "usd",
      distributableAmount: 1_000,
      reserveAmount: 100,
      platformAmount: 200,
      publisherEarningAmount: 700,
    },
  });
  assert.deepEqual(await post(allocation), { ...posted, status: 200, body: { ...(posted.body as object), outcome: "duplicate" } });
  assert.equal((await post({ ...allocation, reserveAmount: 200, platformAmount: 100 })).status, 409, "Conflicting reuse of an Allocation Run ID must reject");
  assert.equal((await post({ ...allocation, allocationRunId: `alloc_over_${suffix}`, publisherEarnings: [{ ...allocation.publisherEarnings[0], earningId: `earning_over_${suffix}` }] })).status, 409, "A Cash Receipt cannot be allocated twice");

  await publisherPage.reload();
  await publisherPage.getByText("Publisher Earnings").waitFor();
  assert.equal(await publisherPage.getByText("$7.00 USD").isVisible(), true);
  assert.equal(await publisherPage.getByText("Accrued — Connect not ready").isVisible(), true);
  assert.equal(await publisherPage.getByText("No Transfer created").isVisible(), true);
  assert.equal(await publisherPage.getByText("No bank Payout observed").isVisible(), true);

  const immutable = spawnSync("pnpm", ["exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--config", "wrangler.jsonc", "--persist-to", "../../.wrangler/mvp-state", "--command", `UPDATE ledger_entry SET amount = 999 WHERE allocation_run_id = '${allocationRunId}'`], { cwd: webRoot, encoding: "utf8" });
  assert.notEqual(immutable.status, 0, "Posted ledger entries must reject mutation at the database boundary");

  const secondInvoiceId = `in_allocation_append_${suffix}`;
  await createPaidReceipt(operatorUserId, secondInvoiceId);
  const secondReceiptId = `receipt:test:${secondInvoiceId}`;
  const appendTriggerResult = JSON.parse(localSql("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('allocation_receipt_immutable_insert', 'ledger_entry_immutable_insert', 'publisher_earning_immutable_insert') ORDER BY name")) as Array<{ results: Array<{ name: string }> }>;
  assert.deepEqual(appendTriggerResult[0]?.results.map(({ name }) => name), [
    "allocation_receipt_immutable_insert",
    "ledger_entry_immutable_insert",
    "publisher_earning_immutable_insert",
  ], "D1 must guard every appendable financial child of a posted Allocation");
  const appendCommands = [
    `INSERT INTO publisher_earning (id, allocation_run_id, publisher_id, amount, currency, available_at, status, created_at) VALUES ('earning_append_${suffix}', '${allocationRunId}', '${publisherId}', 1, 'usd', ${now}, 'accrued', ${now})`,
    `INSERT INTO allocation_run_receipt (allocation_run_id, cash_receipt_id, amount) VALUES ('${allocationRunId}', '${secondReceiptId}', 1)`,
    `INSERT INTO ledger_entry (id, allocation_run_id, entry_type, amount, currency, cash_receipt_id, posted_at) VALUES ('ledger_append_${suffix}', '${allocationRunId}', 'cash_receipt', -1, 'usd', '${secondReceiptId}', ${now})`,
  ];
  for (const command of appendCommands) {
    const appended = spawnSync("pnpm", ["exec", "wrangler", "d1", "execute", "apps-pass-local", "--local", "--config", "wrangler.jsonc", "--persist-to", "../../.wrangler/mvp-state", "--command", command], { cwd: webRoot, encoding: "utf8" });
    assert.notEqual(appended.status, 0, "A posted Allocation must reject appended financial rows at the database boundary");
  }

  process.stdout.write("PASS an Operator posts one balanced immutable Allocation and the Publisher sees an accrued Earning distinct from settlement\n");
  await publisherContext.close();
  await operatorContext.close();
} finally {
  await browser.close();
}
