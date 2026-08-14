import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const email = `operator-bootstrap-${Date.now()}@example.test`;
const publisherEmail = `invited-publisher-${Date.now()}@example.test`;
let publisherId = "";
let appId = "";
const runtimeId = Array.from(randomBytes(16), (byte) => `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 15))}`).join("");
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

const browser = await chromium.launch({ headless: true });

try {
  const operatorContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.30" } } : {});
  const page = await operatorContext.newPage();
  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Bootstrap Operator");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();

  await page.goto(`${appOrigin}/operator`);
  assert.equal(await page.getByRole("heading", { name: "Operator role required" }).isVisible(), true);

  const bootstrapTarget = appOrigin.includes("localhost") ? "--local" : "--staging";
  execFileSync("pnpm", ["mvp:operator:bootstrap", "--", bootstrapTarget, email], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });

  await page.reload();
  assert.equal(await page.getByRole("heading", { name: "Operator controls" }).isVisible(), true);

  await page.getByLabel("Publisher email").fill(publisherEmail);
  await page.getByLabel("Publisher name").fill("Invited Publisher Pilot");
  await page.getByLabel("First App name").fill("Invited Video Downloader");
  await page.getByRole("button", { name: "Create Publisher invitation" }).click();
  publisherId = await page.getByTestId("generated-publisher-id").innerText();
  appId = await page.getByTestId("generated-app-id").innerText();
  assert.match(publisherId, /^pub_[a-z0-9_]+$/);
  assert.match(appId, /^app_[a-z0-9_]+$/);
  const invitationCode = await page.getByTestId("invitation-code").innerText();
  assert.match(invitationCode, /^[A-Za-z0-9_-]{32,}$/);

  await page.getByLabel("Publisher email").fill(`duplicate-name-${Date.now()}@example.test`);
  await page.getByLabel("Publisher name").fill("Invited Publisher Pilot");
  await page.getByLabel("First App name").fill("Invited Video Downloader");
  await page.getByRole("button", { name: "Create Publisher invitation" }).click();
  const duplicatePublisherId = await page.getByTestId("generated-publisher-id").innerText();
  const duplicateAppId = await page.getByTestId("generated-app-id").innerText();
  assert.notEqual(duplicatePublisherId, publisherId);
  assert.notEqual(duplicateAppId, appId);

  const publisherContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.31" } } : {});
  const publisherPage = await publisherContext.newPage();
  await publisherPage.goto(`${appOrigin}/account`);
  await publisherPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await publisherPage.getByLabel("Name").fill("Invited Publisher");
  await publisherPage.getByLabel("Email").fill(publisherEmail);
  await publisherPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await publisherPage.getByRole("button", { name: "Create account" }).click();
  await publisherPage.getByText("Human session active").waitFor();
  await publisherPage.goto(`${appOrigin}/publisher/invitation`);
  await publisherPage.getByLabel("Invitation code").fill(invitationCode);
  await publisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
  await publisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
  assert.equal(await publisherPage.getByText(appId).isVisible(), true);
  const manifest = {
    $schema: "https://pass.serp.co/schema/app-manifest-v1.json",
    schema_version: 1,
    publisher_id: publisherId,
    publisher_name: "Invited Publisher Pilot",
    app_id: appId,
    name: "Invited Video Downloader",
    features: ["premium"],
    distributions: [{ browser_family: "chromium", channel: "unpacked", runtime_id: runtimeId }],
  };
  const wrongRoleResponse = await page.evaluate(async (manifest) => {
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest, ownershipEvidence: "This Operator is not the assigned Publisher account." }),
    });
    return response.status;
  }, manifest);
  assert.equal(wrongRoleResponse, 403);

  const identityMismatchResponse = await publisherPage.evaluate(async (manifest) => {
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: { ...manifest, app_id: `${manifest.app_id}_unassigned` }, ownershipEvidence: "This deliberately mismatched identity must be rejected." }),
    });
    return response.status;
  }, manifest);
  assert.equal(identityMismatchResponse, 409);

  await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(manifest, null, 2));
  await publisherPage.getByLabel("Ownership evidence").fill("Private pilot source repository and unpacked extension reviewed with the Operator.");
  const submissionResponsePromise = publisherPage.waitForResponse((response) => response.url().endsWith("/api/publisher/submissions") && response.request().method() === "POST");
  await publisherPage.getByRole("button", { name: "Submit App for review" }).click();
  const submissionResponse = await submissionResponsePromise;
  assert.equal(submissionResponse.status(), 201, await submissionResponse.text());
  await publisherPage.getByText(`${appId} · pending`).waitFor();

  await page.reload();
  let reviewForm = page.locator("form").filter({ hasText: `${appId} · pending` });
  await reviewForm.getByText("Inspect the developer submission").click();
  assert.equal(await reviewForm.getByText("Invited Video Downloader").isVisible(), true);
  assert.equal(await reviewForm.getByText("Private pilot source repository and unpacked extension reviewed with the Operator.").isVisible(), true);
  await reviewForm.getByLabel("Review reason").fill("First review deliberately verifies the rejection and resubmission path.");
  await reviewForm.getByRole("button", { name: "Reject Submission" }).click();
  await page.getByText(`${appId} · pending`).waitFor({ state: "detached" });

  await publisherPage.reload();
  await publisherPage.getByText(`${appId} · rejected`).waitFor();
  await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(manifest, null, 2));
  await publisherPage.getByLabel("Ownership evidence").fill("Private pilot source repository and unpacked extension reviewed again after rejection.");
  const resubmissionResponsePromise = publisherPage.waitForResponse((response) => response.url().endsWith("/api/publisher/submissions") && response.request().method() === "POST");
  await publisherPage.getByRole("button", { name: "Submit App for review" }).click();
  const resubmissionResponse = await resubmissionResponsePromise;
  assert.equal(resubmissionResponse.status(), 201, await resubmissionResponse.text());

  await page.reload();
  reviewForm = page.locator("form").filter({ hasText: `${appId} · pending` });
  await reviewForm.getByLabel("Review reason").fill("Ownership evidence and unpacked runtime identity reviewed for the private pilot.");
  await reviewForm.getByRole("button", { name: "Approve Submission" }).click();
  await page.getByText(`${appId} · pending`).waitFor({ state: "detached" });

  await publisherPage.reload();
  await publisherPage.getByText(`${appId} · approved`).first().waitFor();
  const authorityIdentity = await publisherPage.evaluate(async ({ appId, runtimeId }) => {
    const response = await fetch(`/api/app-pass/apps/${appId}/distributions/${runtimeId}`);
    return { status: response.status, body: await response.json() as { appId?: string; runtimeId?: string } };
  }, { appId, runtimeId });
  assert.equal(authorityIdentity.status, 200);
  assert.deepEqual(authorityIdentity.body, {
    appId,
    appName: "Invited Video Downloader",
    appStatus: "approved",
    publisherId,
    publisherName: "Invited Publisher Pilot",
    runtimeId,
    distributionStatus: "approved",
  });

  const conflictingPublisherEmail = `runtime-conflict-publisher-${Date.now()}@example.test`;
  await page.goto(`${appOrigin}/operator`);
  await page.getByLabel("Publisher email").fill(conflictingPublisherEmail);
  await page.getByLabel("Publisher name").fill("Runtime Conflict Publisher");
  await page.getByLabel("First App name").fill("Runtime Conflict App");
  await page.getByRole("button", { name: "Create Publisher invitation" }).click();
  const conflictingPublisherId = await page.getByTestId("generated-publisher-id").innerText();
  const conflictingAppId = await page.getByTestId("generated-app-id").innerText();
  const conflictingInvitationCode = await page.getByTestId("invitation-code").innerText();

  const conflictingPublisherContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.33" } } : {});
  const conflictingPublisherPage = await conflictingPublisherContext.newPage();
  await conflictingPublisherPage.goto(`${appOrigin}/account`);
  await conflictingPublisherPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await conflictingPublisherPage.getByLabel("Name").fill("Runtime Conflict Publisher");
  await conflictingPublisherPage.getByLabel("Email").fill(conflictingPublisherEmail);
  await conflictingPublisherPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await conflictingPublisherPage.getByRole("button", { name: "Create account" }).click();
  await conflictingPublisherPage.getByText("Human session active").waitFor();
  await conflictingPublisherPage.goto(`${appOrigin}/publisher/invitation`);
  await conflictingPublisherPage.getByLabel("Invitation code").fill(conflictingInvitationCode);
  await conflictingPublisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
  await conflictingPublisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
  const runtimeConflictStatus = await conflictingPublisherPage.evaluate(async ({ manifest, publisherId, appId }) => {
    const response = await fetch("/api/publisher/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manifest: {
          ...manifest,
          publisher_id: publisherId,
          publisher_name: "Runtime Conflict Publisher",
          app_id: appId,
          name: "Conflicting Runtime App",
          distributions: [{ ...manifest.distributions[0], channel: "chrome_web_store" }],
        },
        ownershipEvidence: "This different channel must not permit claiming an already approved Chromium runtime ID.",
      }),
    });
    return response.status;
  }, { manifest, publisherId: conflictingPublisherId, appId: conflictingAppId });
  assert.equal(runtimeConflictStatus, 409);

  const replayContext = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.32" } } : {});
  const replayPage = await replayContext.newPage();
  await replayPage.goto(`${appOrigin}/account`);
  await replayPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await replayPage.getByLabel("Name").fill("Replay Subscriber");
  await replayPage.getByLabel("Email").fill(`replay-${Date.now()}@example.test`);
  await replayPage.getByLabel("Password").fill("correct-horse-battery-staple");
  await replayPage.getByRole("button", { name: "Create account" }).click();
  await replayPage.getByText("Human session active").waitFor();
  await replayPage.goto(`${appOrigin}/publisher/invitation`);
  await replayPage.getByLabel("Invitation code").fill(invitationCode);
  await replayPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
  await replayPage.getByText("Invitation is invalid, expired, already used, or assigned to another email.").waitFor();

  process.stdout.write("PASS Publisher invitation, guarded review lifecycle, canonical identity, and cross-channel runtime uniqueness\n");
} finally {
  await browser.close();
}
