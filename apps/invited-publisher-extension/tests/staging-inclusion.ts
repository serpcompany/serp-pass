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
let browserConnectionExercised = false;

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

    const publisherContext = await browser.newContext();
    const publisherPage = await publisherContext.newPage();
    await publisherPage.goto(`${authority}/submit`);
    await publisherPage.getByLabel("Contact email").fill(publisherEmail);
    await publisherPage.getByLabel("Publisher or company name").fill(manifest.publisher_name);
    await publisherPage.getByLabel("Extension name").fill(manifest.name);
    await publisherPage.getByLabel("Public extension listing URL").fill(`https://chromewebstore.google.com/detail/invited-publisher-${suffix}`);
    await publisherPage.getByLabel("Source repository URL").fill("https://github.com/serpcompany/serp-appspass");
    await publisherPage.getByLabel("What the extension does and why it belongs in the Pass").fill("A real independently built Manifest V3 reference extension that verifies the Publisher SDK handoff and runtime connection boundary.");
    await publisherPage.getByLabel("Permissions, data collection, and privacy explanation").fill("Uses local extension storage for App-session state, requests no page host access, and sends only Apps Pass protocol requests to the staging authority.");
    await publisherPage.getByLabel(/I attest that I own or am authorized/u).check();
    await publisherPage.getByRole("button", { name: "Submit Publisher Application" }).click();
    await publisherPage.getByText("Application received for preliminary SERP review.", { exact: false }).waitFor();
    const applicationId = await publisherPage.getByTestId("application-id").innerText();

    await operatorPage.goto(`${authority}/operator`);
    const applicationForm = operatorPage.getByTestId(`publisher-application-${applicationId}`);
    await applicationForm.getByLabel("Preliminary review reason").fill("Product ownership, narrow permissions, catalog fit, and the independently built reference extension are suitable for the private-pilot integration test.");
    await applicationForm.getByRole("button", { name: "Accept for technical onboarding" }).click();
    const generatedPublisherId = await applicationForm.getByTestId("generated-publisher-id").innerText();
    const generatedAppId = await applicationForm.getByTestId("generated-app-id").innerText();
    const invitationCode = await applicationForm.getByTestId("invitation-code").innerText();
    assert.equal(generatedPublisherId, manifest.publisher_id, "Apps Pass must generate the Publisher ID expected by the accepted extension manifest");
    assert.equal(generatedAppId, manifest.app_id, "Apps Pass must generate the App ID expected by the accepted extension manifest");

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
    await publisherPage.getByLabel("Built or published extension version").fill("0.0.1");
    await publisherPage.getByRole("button", { name: "Register integration" }).click();
    await publisherPage.getByText("Integration Declaration registered.", { exact: false }).waitFor();
    await publisherPage.getByText("Not connected yet — open the integrated extension to verify").waitFor();

    execFileSync("pnpm", ["test:browser"], {
      cwd: appRoot,
      env: { ...process.env, EXPECT_APPROVED: "1" },
      stdio: "inherit",
    });
    browserConnectionExercised = true;
    await publisherPage.reload();
    await publisherPage.getByText(/Connected \d+ time/u).waitFor();
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

if (!browserConnectionExercised) {
  execFileSync("pnpm", ["test:browser"], {
    cwd: appRoot,
    env: { ...process.env, EXPECT_APPROVED: "1" },
    stdio: "inherit",
  });
}

process.stdout.write("PASS public Application, Product Acceptance, generated IDs, Publisher onboarding, Integration Declaration, and runtime connection make the real extension staging-eligible\n");
