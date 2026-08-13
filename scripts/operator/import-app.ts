import { readFile } from "node:fs/promises";
import path from "node:path";

const [manifestPath, ...unexpected] = process.argv.slice(2);
if (!manifestPath || unexpected.length > 0) {
  throw new Error("Usage: pnpm operator:import-app <path-to-apppass.json>");
}

let manifest: unknown;
try {
  manifest = JSON.parse(await readFile(path.resolve(manifestPath), "utf8"));
} catch (error) {
  const message = error instanceof SyntaxError ? `Malformed JSON: ${error.message}` : String(error);
  console.error(message);
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  const response = await fetch("http://127.0.0.1:8787/operator/import-app", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(manifest),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(body);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${body}\n`);
  }
}
