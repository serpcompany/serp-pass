import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { chromium, type Page } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const operatorEmail = `operator-bootstrap-${Date.now()}@example.test`;
const publisherEmail = `publisher-applicant-${Date.now()}@example.test`;
const runtimeId = Array.from(randomBytes(16), (byte) => `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 15))}`).join("");
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

async function navigate(page: Page, pathname: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`${appOrigin}${pathname}`, { waitUntil: "commit", timeout: 20_000 });
      await page.waitForFunction(() => document.readyState !== "loading", undefined, { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function waitForTextAfterNavigate(page: Page, pathname: string, text: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await navigate(page, pathname);
    if (await page.getByText(text).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(1_000);
  }
  await page.getByText(text).first().waitFor();
}

async function submitApplication(page: Page, input: { email: string; publisherName: string; appName: string; listingSuffix: string }) {
  await navigate(page, "/submit");
  await page.getByLabel("Contact email").fill(input.email);
  await page.getByLabel("Publisher or company name").fill(input.publisherName);
  await page.getByLabel("Extension name").fill(input.appName);
  await page.getByLabel("Public extension listing URL").fill(`https://chromewebstore.google.com/detail/${input.listingSuffix}`);
  await page.getByLabel("Source repository URL").fill("https://github.com/example/reviewable-extension");
  await page.getByLabel("What the extension does and why it belongs in the Pass").fill("A mature video workflow extension with a clearly defined premium feature for Apps Pass subscribers.");
  await page.getByLabel("Permissions, data collection, and privacy explanation").fill("Uses storage for local preferences and Vimeo host access only for the user-requested download workflow; no data is sold.");
  await page.getByLabel(/I attest that I own or am authorized/).check();
  await page.getByRole("button", { name: "Submit Publisher Application" }).click();
  await page.getByText("Application received for preliminary SERP review").waitFor();
  return page.getByTestId("application-id").innerText();
}

async function acceptApplication(operatorPage: Page, applicationId: string) {
  await navigate(operatorPage, "/operator");
  const reviewForm = operatorPage.getByTestId(`publisher-application-${applicationId}`);
  await reviewForm.getByText("Inspect the Publisher Application").click();
  assert.equal(await reviewForm.getByText("This statement still requires human verification.").isVisible(), true);
  await reviewForm.getByLabel("Preliminary review reason").fill("Public listing, product case, ownership statement, permissions, and privacy answers are sufficient for technical onboarding.");
  await reviewForm.getByRole("button", { name: "Accept for technical onboarding" }).click();
  const publisherId = await reviewForm.getByTestId("generated-publisher-id").innerText();
  const appId = await reviewForm.getByTestId("generated-app-id").innerText();
  const invitationCode = await reviewForm.getByTestId("invitation-code").innerText();
  return { publisherId, appId, invitationCode };
}

const browser = await chromium.launch({ headless: true, args: ["--disable-quic", "--disable-http2"] });

try {
  const applicantContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.40" } } : {});
  const applicantPage = await applicantContext.newPage();
  const applicationId = await submitApplication(applicantPage, {
    email: publisherEmail,
    publisherName: "Applicant Publisher Pilot",
    appName: "Applicant Video Downloader",
    listingSuffix: `applicant-${Date.now()}`,
  });
  assert.match(applicationId, /^[0-9a-f-]{36}$/u);
  await navigate(applicantPage, "/publisher");
  assert.equal(await applicantPage.getByRole("heading", { name: "Publisher sign-in required" }).isVisible(), true, "Application must not grant Publisher authority");

  const operatorContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.30" } } : {});
  const operatorPage = await operatorContext.newPage();
  await navigate(operatorPage, "/account");
  await operatorPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await operatorPage.getByLabel("Name").fill("Bootstrap Operator");
  await operatorPage.getByLabel("Email").fill(operatorEmail);
  await operatorPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await operatorPage.getByRole("button", { name: "Create account" }).click();
  await operatorPage.getByText("Human session active").waitFor();
  await navigate(operatorPage, "/operator");
  assert.equal(await operatorPage.getByRole("heading", { name: "Operator role required" }).isVisible(), true);

  const bootstrapTarget = appOrigin.includes("localhost") ? "--local" : "--staging";
  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", bootstrapTarget, operatorEmail], { cwd: repositoryRoot, stdio: "pipe" });
  await navigate(operatorPage, "/operator");
  assert.equal(await operatorPage.getByRole("heading", { name: "Operator controls" }).isVisible(), true);

  const retiredInvitationStatus = await operatorPage.evaluate(async () => (await fetch("/api/operator/publisher-invitations", { method: "POST" })).status);
  assert.equal(retiredInvitationStatus, 410, "Operators must not bypass the Application review gate");

  const { publisherId, appId, invitationCode } = await acceptApplication(operatorPage, applicationId);
  assert.match(publisherId, /^pub_[a-z0-9_]+$/u);
  assert.match(appId, /^app_[a-z0-9_]+$/u);
  assert.match(invitationCode, /^[A-Za-z0-9_-]{32,}$/u);

  const duplicateApplicantContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.41" } } : {});
  const duplicateApplicantPage = await duplicateApplicantContext.newPage();
  const duplicateApplicationId = await submitApplication(duplicateApplicantPage, {
    email: `duplicate-name-${Date.now()}@example.test`,
    publisherName: "Applicant Publisher Pilot",
    appName: "Applicant Video Downloader",
    listingSuffix: `duplicate-${Date.now()}`,
  });
  const duplicate = await acceptApplication(operatorPage, duplicateApplicationId);
  assert.notEqual(duplicate.publisherId, publisherId);
  assert.notEqual(duplicate.appId, appId);

  const publisherContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.31" } } : {});
  const publisherPage = await publisherContext.newPage();
  await navigate(publisherPage, "/account");
  await publisherPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await publisherPage.getByLabel("Name").fill("Accepted Publisher");
  await publisherPage.getByLabel("Email").fill(publisherEmail);
  await publisherPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await publisherPage.getByRole("button", { name: "Create account" }).click();
  await publisherPage.getByText("Human session active").waitFor();
  await navigate(publisherPage, "/publisher/invitation");
  await publisherPage.getByLabel("Invitation code").fill(invitationCode);
  // A committed Next.js document can become visible before its client form has hydrated on a remote Worker.
  await publisherPage.waitForTimeout(1_000);
  const invitationResponsePromise = publisherPage.waitForResponse((response) => response.url().endsWith("/api/publisher-invitations/accept") && response.request().method() === "POST");
  await publisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
  const invitationResponse = await invitationResponsePromise;
  assert.equal(invitationResponse.status(), 200, await invitationResponse.text());
  await navigate(publisherPage, "/publisher");
  await publisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
  assert.equal(await publisherPage.getByText(appId).isVisible(), true);

  const manifest = {
    $schema: "https://pass.serp.co/schema/app-manifest-v1.json",
    schema_version: 1,
    publisher_id: publisherId,
    publisher_name: "Applicant Publisher Pilot",
    app_id: appId,
    name: "Applicant Video Downloader",
    features: ["premium"],
    distributions: [{ browser_family: "chromium", channel: "unpacked", runtime_id: runtimeId }],
  };

  const wrongRoleResponse = await operatorPage.evaluate(async () => {
    const response = await fetch("/api/publisher/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return response.status;
  });
  assert.equal(wrongRoleResponse, 403);

  const identityMismatchResponse = await publisherPage.evaluate(async (manifest) => {
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: { ...manifest, app_id: "app_not_assigned_to_publisher" }, storeVersion: "1.0.0" }),
    });
    return { status: response.status, body: await response.text() };
  }, manifest);
  assert.equal(identityMismatchResponse.status, 409, identityMismatchResponse.body);

  await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(manifest, null, 2));
  await publisherPage.getByLabel("Built or published extension version").fill("1.0.0");
  const submissionResponsePromise = publisherPage.waitForResponse((response) => response.url().endsWith("/api/publisher/submissions") && response.request().method() === "POST");
  await publisherPage.getByRole("button", { name: "Register integration" }).click();
  const submissionResponse = await submissionResponsePromise;
  assert.equal(submissionResponse.status(), 201, await submissionResponse.text());
  const declarationBody = await submissionResponse.json() as { submissionId: string; status: string };
  assert.match(declarationBody.submissionId, /^[0-9a-f-]{36}$/u);
  assert.equal(declarationBody.status, "disconnected");
  await publisherPage.getByText(/Not connected yet/u).waitFor();

  await navigate(operatorPage, "/operator");
  await operatorPage.getByText(/Waiting for the integrated extension to connect/u).last().waitFor();
  const wrongOriginResponse = await publisherPage.request.post(`${appOrigin}/api/app-pass/connections`, {
    headers: { origin: `chrome-extension://${"a".repeat(32)}`, "content-type": "application/json" },
    data: { appId, runtimeId },
  });
  assert.equal(wrongOriginResponse.status(), 400, "A different extension origin must not connect the declared runtime");
  const connectionResponse = await publisherPage.request.post(`${appOrigin}/api/app-pass/connections`, {
    headers: { origin: `chrome-extension://${runtimeId}`, "content-type": "application/json" },
    data: { appId, runtimeId },
  });
  assert.equal(connectionResponse.status(), 200, await connectionResponse.text());
  assert.equal((await connectionResponse.json() as { status: string }).status, "connected");
  const repeatedConnection = await publisherPage.request.post(`${appOrigin}/api/app-pass/connections`, {
    headers: { origin: `chrome-extension://${runtimeId}`, "content-type": "application/json" },
    data: { appId, runtimeId },
  });
  assert.equal(repeatedConnection.status(), 200, await repeatedConnection.text());
  assert.equal((await repeatedConnection.json() as { connectionCount: number }).connectionCount, 2);

  await waitForTextAfterNavigate(publisherPage, "/publisher", "Connected 2 times");
  await waitForTextAfterNavigate(operatorPage, "/operator", "Connected · first");
  const authorityIdentity = await publisherPage.evaluate(async ({ appId, runtimeId }) => {
    const response = await fetch(`/api/app-pass/apps/${appId}/distributions/${runtimeId}`);
    return { status: response.status, body: await response.json() };
  }, { appId, runtimeId });
  assert.equal(authorityIdentity.status, 200);
  assert.deepEqual(authorityIdentity.body, {
    appId,
    appName: "Applicant Video Downloader",
    appStatus: "approved",
    publisherId,
    publisherName: "Applicant Publisher Pilot",
    runtimeId,
    distributionStatus: "approved",
  });

  const replayContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.32" } } : {});
  const replayPage = await replayContext.newPage();
  await navigate(replayPage, "/account");
  await replayPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await replayPage.getByLabel("Name").fill("Replay Subscriber");
  await replayPage.getByLabel("Email").fill(`replay-${Date.now()}@example.test`);
  await replayPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await replayPage.getByRole("button", { name: "Create account" }).click();
  await replayPage.getByText("Human session active").waitFor();
  await navigate(replayPage, "/publisher/invitation");
  await replayPage.getByLabel("Invitation code").fill(invitationCode);
  await replayPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
  await replayPage.getByText("Invitation is invalid, expired, already used, or assigned to another email.").waitFor();

  process.stdout.write("PASS public Publisher Application, product acceptance, integration declaration, runtime-bound connection, and canonical authority\n");
} finally {
  await browser.close();
}
