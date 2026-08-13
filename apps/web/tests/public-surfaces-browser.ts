import assert from "node:assert/strict";

import { chromium } from "playwright";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:8788";
const expected = [
  { path: "/", heading: "One subscription. Every approved App." },
  { path: "/apps", heading: "Every approved extension is included." },
  { path: "/submit", heading: "Bring your extension into one subscription." },
  { path: "/docs", heading: "Add Apps Pass to an extension" },
] as const;

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const surface of expected) {
      const response = await page.goto(`${appOrigin}${surface.path}`, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, `${surface.path} must render`);
      await page.getByRole("heading", { level: 1, name: surface.heading }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Apps", exact: true }).first().getAttribute("href"), "/apps");
      assert.equal(await page.getByRole("link", { name: "Submit an App", exact: true }).first().getAttribute("href"), "/submit");
      assert.equal(await page.getByRole("link", { name: "Docs", exact: true }).first().getAttribute("href"), "/docs");
      assert.equal(await page.getByRole("link", { name: "Account", exact: true }).first().getAttribute("href"), "/account");
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scrollWidth <= dimensions.width, `${surface.path} must not overflow at ${viewport.width}px`);
    }
    await context.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${appOrigin}/apps`, { waitUntil: "domcontentloaded" });
  const catalogText = await page.locator("main").innerText();
  assert.doesNotMatch(catalogText, /[a-p]{32}/u, "The public catalog must not expose a Chromium runtime ID");
  assert.doesNotMatch(catalogText, /submission_[A-Za-z0-9_-]+/u, "The public catalog must not expose a Submission ID");
  await context.close();

  process.stdout.write("PASS public home, Apps, Submit, and Docs surfaces are navigable, responsive, and catalog-safe\n");
} finally {
  await browser.close();
}
