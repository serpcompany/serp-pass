import assert from "node:assert/strict";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const email = `subscriber-boundary-${Date.now()}@example.test`;

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.20" } } : {});
  const page = await context.newPage();
  const response = await page.goto(`${appOrigin}/publisher`);

  assert.equal(response?.status(), 200);
  assert.equal(await page.getByRole("heading", { name: "Publisher sign-in required" }).isVisible(), true);

  await page.goto(`${appOrigin}/account`);
  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Boundary Subscriber");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Human session active").waitFor();

  await page.goto(`${appOrigin}/publisher`);
  assert.equal(await page.getByRole("heading", { name: "Publisher invitation required" }).isVisible(), true);

  const wrongRoleStatus = await page.evaluate(async () => {
    const response = await fetch("/api/operator/publisher-invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "blocked-publisher@example.test" }),
    });
    return response.status;
  });
  assert.equal(wrongRoleStatus, 403);

  const crossOriginResponse = await fetch(`${appOrigin}/api/operator/publisher-invitations`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.invalid" },
    body: JSON.stringify({ email: "blocked-publisher@example.test" }),
  });
  assert.equal(crossOriginResponse.status, 403);

  process.stdout.write("PASS anonymous and Subscriber Publisher boundaries\n");
} finally {
  await browser.close();
}
