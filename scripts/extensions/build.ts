import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const examplesRoot = path.join(repositoryRoot, "examples");
const templateRoot = path.join(repositoryRoot, "prototype/extension-shell");
const authorityBaseUrl = process.env.APP_PASS_AUTHORITY_URL ?? "http://127.0.0.1:8787";

function runtimeIdFromKey(key: string) {
  const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((value) => String.fromCharCode(97 + value))
    .join("");
}

const directories = (await readdir(examplesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const built: Array<{ directory: string; appId: string; runtimeId: string; output: string }> = [];

for (const directory of directories) {
  const exampleRoot = path.join(examplesRoot, directory);
  let appManifest: {
    app_id: string;
    name: string;
    publisher_name: string;
    distributions: Array<{ browser_family: string; channel: string; runtime_id: string }>;
  };
  let chromiumManifest: Record<string, unknown> & { key?: string };
  try {
    appManifest = JSON.parse(await readFile(path.join(exampleRoot, "apppass.json"), "utf8"));
    chromiumManifest = JSON.parse(await readFile(path.join(exampleRoot, "extension/manifest.base.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
    throw error;
  }
  if (!chromiumManifest.key) throw new Error(`${directory} must pin a Chromium manifest key`);
  const runtimeId = runtimeIdFromKey(chromiumManifest.key);
  const distribution = appManifest.distributions.find((candidate) =>
    candidate.browser_family === "chromium" && candidate.channel === "unpacked");
  if (!distribution || distribution.runtime_id !== runtimeId) {
    throw new Error(`${directory} apppass.json runtime identity does not match its Chromium manifest key`);
  }
  const output = path.join(exampleRoot, "dist");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await build({
    entryPoints: [path.join(templateRoot, "popup.ts")],
    outfile: path.join(output, "popup.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    define: {
      APP_PASS_CONFIG: JSON.stringify({
        appId: appManifest.app_id,
        appName: appManifest.name,
        publisherName: appManifest.publisher_name,
        authorityBaseUrl,
      }),
    },
  });
  await Promise.all([
    copyFile(path.join(templateRoot, "popup.html"), path.join(output, "popup.html")),
    copyFile(path.join(templateRoot, "popup.css"), path.join(output, "popup.css")),
    writeFile(path.join(output, "manifest.json"), `${JSON.stringify(chromiumManifest, null, 2)}\n`),
  ]);
  built.push({ directory, appId: appManifest.app_id, runtimeId, output });
}

if (built.length === 0) throw new Error("No submitted App manifests with extension sources were discovered");
if (new Set(built.map((entry) => entry.appId)).size !== built.length) {
  throw new Error("Discovered App IDs must be unique");
}
if (new Set(built.map((entry) => entry.runtimeId)).size !== built.length) {
  throw new Error("Discovered Chromium runtime IDs must be unique");
}
process.stdout.write(`${JSON.stringify({ built })}\n`);
