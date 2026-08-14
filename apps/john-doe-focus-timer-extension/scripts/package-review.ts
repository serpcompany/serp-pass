import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { zipSync } from "fflate";

const appRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(appRoot, "dist");
const outputRoot = path.join(appRoot, "review-package");
const outputPath = path.join(outputRoot, "john-doe-focus-timer.zip");

async function collect(directory: string, prefix = "", files: Record<string, Uint8Array> = {}) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(absolute, relative, files);
    else if (entry.isFile()) files[relative] = new Uint8Array(await readFile(absolute));
  }
  return files;
}

await mkdir(outputRoot, { recursive: true });
await writeFile(outputPath, zipSync(await collect(distRoot), { level: 9 }));
process.stdout.write(`${outputPath}\n`);
