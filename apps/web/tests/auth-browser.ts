import assert from "node:assert/strict";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const email = `browser-${Date.now()}@example.test`;
const password = "correct-horse-battery-staple";

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext(appOrigin.includes("localhost") ? { extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.10" } } : {});
  const page = await context.newPage();
  await page.goto(`${appOrigin}/account`);

  await page.getByRole("button", { name: "Need a pilot account? Create one" }).click();
  await page.getByLabel("Name").fill("Browser Subscriber");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByText("Human session active").waitFor();
  assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /Welcome, Browser Subscriber/);

  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name.includes("session_token"));
  assert.ok(sessionCookie, "Better Auth session cookie was not created");
  assert.equal(sessionCookie.httpOnly, true);
  assert.equal(sessionCookie.sameSite, "Lax");
  assert.equal(sessionCookie.secure, appOrigin.startsWith("https://"));

  await page.reload();
  await page.getByText("Human session active").waitFor();
  assert.equal(await page.getByText(email).isVisible(), true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByText("No human session").waitFor();

  process.stdout.write("PASS visible sign-up, D1 session reload, and sign-out\n");
} finally {
  await browser.close();
}
