import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const email = `operator-bootstrap-${Date.now()}@example.test`;
const publisherEmail = `invited-publisher-${Date.now()}@example.test`;
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
  await page.getByRole("button", { name: "Create Publisher invitation" }).click();
  const invitationCode = await page.getByTestId("invitation-code").innerText();
  assert.match(invitationCode, /^[A-Za-z0-9_-]{32,}$/);

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

  process.stdout.write("PASS Operator bootstrap and single-use Publisher invitation\n");
} finally {
  await browser.close();
}
