import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const outputRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const authorityBaseUrl = process.env.APP_PASS_AUTHORITY_URL ?? "https://serp-apps-pass-staging.serpcompany.workers.dev";
const allowAuthorityOverride = process.env.EXTENSION_DEV_BROWSER === "1";

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
      APP_PASS_AUTHORITY_URL: JSON.stringify(authorityBaseUrl),
      APP_PASS_ALLOW_AUTHORITY_OVERRIDE: JSON.stringify(allowAuthorityOverride),
    },
  }),
]);

process.stdout.write(`Built real extension source at ${appRoot}/dist\n`);
