import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { validatedManifest } from "@serp-apps-pass/contracts";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const outputRoot = process.env.EXTENSION_OUTPUT_DIR
  ? path.resolve(process.env.EXTENSION_OUTPUT_DIR)
  : fileURLToPath(new URL("../dist/", import.meta.url));
const authorityBaseUrl = process.env.APP_PASS_AUTHORITY_URL ?? "https://serp-apps-pass-staging.serpcompany.workers.dev";
const integration = validatedManifest(JSON.parse(await readFile(`${appRoot}/apppass.json`, "utf8")));
const appId = process.env.APP_PASS_APP_ID ?? integration.app_id;

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  cp(`${sourceRoot}/manifest.json`, `${outputRoot}/manifest.json`),
  cp(`${sourceRoot}/popup.html`, `${outputRoot}/popup.html`),
  cp(`${sourceRoot}/popup.css`, `${outputRoot}/popup.css`),
  build({
    entryPoints: [`${sourceRoot}/popup.ts`],
    outfile: `${outputRoot}/popup.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    define: {
      APP_PASS_APP_ID: JSON.stringify(appId),
      APP_PASS_AUTHORITY_URL: JSON.stringify(authorityBaseUrl),
    },
  }),
]);

process.stdout.write(`Built John Doe Focus Timer at ${appRoot}/dist\n`);
