import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const appRoot = path.resolve(import.meta.dirname, "..");
const expectedRuntimeId = "pkenmpgagmnabdljhnjibgpbmakekahf";

const testRoot = await mkdtemp(path.join(os.tmpdir(), "apps-pass-real-extension-"));
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
  assert.ok(browser, "Persistent Chromium context disconnected");
  const session = await browser.newBrowserCDPSession();
  const installed = await session.send("Extensions.getExtensions");
  const loaded = installed.extensions.find((extension) => path.resolve(extension.path) === extensionRoot);
  assert.ok(loaded, "Chromium did not load the real extension source path");
  assert.equal(loaded.id, expectedRuntimeId);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${loaded.id}/popup.html`);
  assert.equal(await page.getByText("Third-party Publisher App").isVisible(), true);
  assert.equal(await page.getByText(expectedRuntimeId).isVisible(), true);
  if (process.env.EXPECT_APPROVED === "1") {
    await page.getByText("Connected to Apps Pass").waitFor();
  }
  await page.getByRole("button", { name: "Check Apps Pass access" }).click();
  await page.getByText("unauthenticated").waitFor();

  process.stdout.write("PASS real extension source loads with its stable runtime ID and shared SDK\n");
} finally {
  await context.close();
  await rm(testRoot, { recursive: true, force: true });
}
