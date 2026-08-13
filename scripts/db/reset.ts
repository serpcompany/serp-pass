import { rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const stateDirectory = path.join(repositoryRoot, ".wrangler/state");

if (path.dirname(stateDirectory) !== path.join(repositoryRoot, ".wrangler")) {
  throw new Error("Refusing to reset an unexpected directory");
}

await rm(stateDirectory, { recursive: true, force: true });
