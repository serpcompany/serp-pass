import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const appRoot = path.resolve(import.meta.dirname, "..");
const expectedRuntimeId = "bpjnchabpcjomgncmbgphbdggkgkobdb";
const testRoot = await mkdtemp(path.join(os.tmpdir(), "john-doe-focus-timer-"));
const buildOutputRoot = path.join(testRoot, "extension");
const profileRoot = path.join(testRoot, "profile");

execFileSync("pnpm", ["build"], {
  cwd: appRoot,
  env: { ...process.env, EXTENSION_OUTPUT_DIR: buildOutputRoot },
  stdio: "pipe",
});
const extensionRoot = await realpath(buildOutputRoot);
const context = await chromium.launchPersistentContext(profileRoot, {
  executablePath: chromium.executablePath(),
  headless: true,
  args: [
    "--remote-debugging-port=0",
    "--enable-unsafe-extension-debugging",
    `--disable-extensions-except=${extensionRoot}`,
    `--load-extension=${extensionRoot}`,
  ],
});

try {
  const browser = context.browser();
  assert.ok(browser, "Disposable Chromium context disconnected");
  const session = await browser.newBrowserCDPSession();
  const installed = await session.send("Extensions.getExtensions");
  const loaded = installed.extensions.find((extension) => path.resolve(extension.path) === extensionRoot);
  assert.ok(loaded, "Chromium did not load John Doe's extension source");
  assert.equal(loaded.id, expectedRuntimeId);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${loaded.id}/popup.html`);
  assert.equal(await page.getByText("Example third-party extension").isVisible(), true);
  assert.equal(await page.getByText("John Doe Studio", { exact: false }).isVisible(), true);
  assert.equal(await page.getByText(expectedRuntimeId).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Start free 5 min" }).isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "Start premium 25 min" }).isDisabled(), true);
  if (process.env.EXPECT_CONNECTED === "1") {
    await page.getByText("Connected to Apps Pass", { exact: true }).waitFor();
  }
  await page.getByRole("button", { name: "Check Apps Pass access" }).click();
  await page.getByText("unauthenticated", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Start premium 25 min" }).isDisabled(), true);

  process.stdout.write("PASS John Doe's real extension loads with a stable runtime ID and gated premium feature\n");
} finally {
  await context.close();
  await rm(testRoot, { recursive: true, force: true });
}
