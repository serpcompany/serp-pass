import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const appRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const authority = "https://serp-apps-pass-staging.serpcompany.workers.dev";
const manifest = JSON.parse(await readFile(path.join(appRoot, "apppass.json"), "utf8")) as {
  publisher_id: string;
  publisher_name: string;
  app_id: string;
  name: string;
  distributions: Array<{ runtime_id: string }>;
};
const runtimeId = manifest.distributions[0]?.runtime_id;
assert.ok(runtimeId);
const identityUrl = `${authority}/api/app-pass/apps/${manifest.app_id}/distributions/${runtimeId}`;

let response = await fetch(identityUrl);
if (response.status === 404) {
  const suffix = Date.now();
  const operatorEmail = `real-extension-operator-${suffix}@example.test`;
  const publisherEmail = `real-extension-publisher-${suffix}@example.test`;
  const password = "correct-horse-battery-staple";
  const browser = await chromium.launch({ headless: true });
  try {
    const operatorContext = await browser.newContext();
    const operatorPage = await operatorContext.newPage();
    await operatorPage.goto(`${authority}/account`);
    await operatorPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
    await operatorPage.getByLabel("Name").fill("Real Extension Pilot Operator");
    await operatorPage.getByLabel("Email").fill(operatorEmail);
    await operatorPage.getByLabel("Password").fill(password);
    await operatorPage.getByRole("button", { name: "Create account" }).click();
    await operatorPage.getByText("Human session active").waitFor();
    execFileSync("pnpm", ["mvp:operator:bootstrap", "--", "--staging", operatorEmail], { cwd: repositoryRoot, stdio: "pipe" });

    await operatorPage.goto(`${authority}/operator`);
    await operatorPage.getByLabel("Publisher email").fill(publisherEmail);
    await operatorPage.getByLabel("Publisher public ID").fill(manifest.publisher_id);
    await operatorPage.getByLabel("Publisher name").fill(manifest.publisher_name);
    await operatorPage.getByLabel("First App public ID").fill(manifest.app_id);
    await operatorPage.getByRole("button", { name: "Create Publisher invitation" }).click();
    const invitationCode = await operatorPage.getByTestId("invitation-code").innerText();

    const publisherContext = await browser.newContext();
    const publisherPage = await publisherContext.newPage();
    await publisherPage.goto(`${authority}/account`);
    await publisherPage.getByRole("button", { name: "Need a pilot account? Create one" }).click();
    await publisherPage.getByLabel("Name").fill("Real Invited Publisher Pilot");
    await publisherPage.getByLabel("Email").fill(publisherEmail);
    await publisherPage.getByLabel("Password").fill(password);
    await publisherPage.getByRole("button", { name: "Create account" }).click();
    await publisherPage.getByText("Human session active").waitFor();
    await publisherPage.goto(`${authority}/publisher/invitation`);
    await publisherPage.getByLabel("Invitation code").fill(invitationCode);
    await publisherPage.getByRole("button", { name: "Accept Publisher invitation" }).click();
    await publisherPage.getByRole("heading", { name: "Publisher pilot area" }).waitFor();
    await publisherPage.getByLabel("App manifest JSON").fill(JSON.stringify(manifest, null, 2));
    await publisherPage.getByLabel("Ownership evidence").fill("Repository-owned real extension source and stable unpacked Chromium runtime reviewed for the private pilot.");
    await publisherPage.getByRole("button", { name: "Submit App for review" }).click();
    await publisherPage.getByText(`${manifest.app_id} · pending`).waitFor();

    await operatorPage.reload();
    const reviewForm = operatorPage.locator("form").filter({ hasText: `${manifest.app_id} · pending` });
    await reviewForm.getByLabel("Review reason").fill("Real source project, public manifest, and stable runtime identity verified for staging.");
    await reviewForm.getByRole("button", { name: "Approve Submission" }).click();
    await operatorPage.getByText(`${manifest.app_id} · pending`).waitFor({ state: "detached" });
  } finally {
    await browser.close();
  }
  response = await fetch(identityUrl);
}

const identityBody = await response.text();
assert.equal(response.status, 200, identityBody);
const identity = JSON.parse(identityBody) as { appId?: string; publisherId?: string; runtimeId?: string; appStatus?: string };
assert.equal(identity.appId, manifest.app_id);
assert.equal(identity.publisherId, manifest.publisher_id);
assert.equal(identity.runtimeId, runtimeId);
assert.equal(identity.appStatus, "approved");

execFileSync("pnpm", ["test:browser"], {
  cwd: appRoot,
  env: { ...process.env, EXPECT_APPROVED: "1" },
  stdio: "inherit",
});

process.stdout.write("PASS real Publisher extension is approved in staging and recognized by its runtime identity\n");
