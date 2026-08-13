import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { build } from "esbuild";

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const sdkDirectory = join(repositoryRoot, "packages", "app-pass-sdk");

test("a clean extension project installs and bundles the packed SDK without workspace access", async (context) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "serp-apps-pass-sdk-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const packDirectory = join(temporaryRoot, "pack");
  const consumerDirectory = join(temporaryRoot, "consumer");
  mkdirSync(packDirectory);
  mkdirSync(consumerDirectory);

  const packOutput = execFileSync(
    "pnpm",
    ["--dir", sdkDirectory, "pack", "--pack-destination", packDirectory],
    { encoding: "utf8" },
  );
  const tarballName = packOutput.trim().split("\n").at(-1);
  if (!tarballName?.endsWith(".tgz")) assert.fail(`Expected pnpm pack to return a tarball, received: ${packOutput}`);
  const tarballPath = resolve(sdkDirectory, tarballName);

  writeFileSync(join(consumerDirectory, "package.json"), JSON.stringify({ name: "external-publisher-extension", private: true, type: "module" }));
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarballPath],
    { cwd: consumerDirectory, stdio: "pipe" },
  );

  const installedPackageJson = JSON.parse(readFileSync(
    join(consumerDirectory, "node_modules", "@serp-apps-pass", "sdk", "package.json"),
    "utf8",
  )) as { version?: string; private?: boolean; exports?: { "."?: { types?: string; import?: string } }; dependencies?: Record<string, string> };
  assert.equal(installedPackageJson.version, "0.1.0");
  assert.equal(installedPackageJson.private, true, "The pilot tarball must remain non-publishable until a registry is approved");
  assert.deepEqual(installedPackageJson.dependencies ?? {}, {});
  assert.equal(installedPackageJson.exports?.["."]?.types, "./dist/index.d.ts");
  assert.equal(installedPackageJson.exports?.["."]?.import, "./dist/index.js");
  const installedSdkRoot = join(consumerDirectory, "node_modules", "@serp-apps-pass", "sdk");
  assert.equal(existsSync(join(installedSdkRoot, "src")), false, "Raw monorepo TypeScript must not be the package runtime");
  assert.match(readFileSync(join(installedSdkRoot, "dist", "index.d.ts"), "utf8"), /createAppPass/u);
  assert.doesNotMatch(readFileSync(join(installedSdkRoot, "dist", "index.js"), "utf8"), /@serp-apps-pass|workspace:\*/u);

  const installedSdk = await import(pathToFileURL(
    join(installedSdkRoot, "dist", "index.js"),
  ).href) as { createAppPass(options: unknown): { check(): Promise<unknown> } };
  assert.equal(typeof installedSdk.createAppPass, "function");

  const values = new Map<string, string>();
  const client = installedSdk.createAppPass({
    appId: "app_external_smoke",
    runtimeId: "abcdefghijklmnopabcdefghijklmnop",
    authorityBaseUrl: "https://pass.example.test",
    storage: {
      get: async (key: string) => values.get(key),
      set: async (key: string, value: string) => void values.set(key, value),
      remove: async (key: string) => void values.delete(key),
    },
    fetch: async () => new Response(null, { status: 500 }),
  });
  assert.deepEqual(await client.check(), { status: "unauthenticated", reason: "not_linked" });

  const entryPath = join(consumerDirectory, "popup.ts");
  const bundlePath = join(consumerDirectory, "popup.js");
  writeFileSync(entryPath, [
    'import { createAppPass } from "@serp-apps-pass/sdk";',
    'export const client = createAppPass({ appId: "app_external_smoke", runtimeId: chrome.runtime.id, authorityBaseUrl: "https://pass.example.test" });',
  ].join("\n"));
  await build({ entryPoints: [entryPath], outfile: bundlePath, bundle: true, format: "esm", platform: "browser" });
  const bundle = readFileSync(bundlePath, "utf8");
  assert.match(bundle, /app_external_smoke/u);
  assert.doesNotMatch(bundle, /@serp-apps-pass\/contracts|workspace:\*/u);
});
