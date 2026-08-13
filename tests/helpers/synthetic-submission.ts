import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

function runtimeIdFromKey(key: string) {
  const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((value) => String.fromCharCode(97 + value))
    .join("");
}

export function createSyntheticSubmission() {
  const suffix = `${process.pid}_${Date.now()}`;
  const directory = path.join("examples", `.synthetic-discovery-${suffix}`);
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = Buffer.from(publicKey.export({ type: "spki", format: "der" })).toString("base64");
  const appId = `app_synthetic_${suffix}`;
  const runtimeId = runtimeIdFromKey(key);
  mkdirSync(path.join(directory, "extension"), { recursive: true });
  writeFileSync(path.join(directory, "apppass.json"), JSON.stringify({
    $schema: "https://pass.serp.co/schema/app-manifest-v1.json",
    schema_version: 1,
    publisher_id: `pub_synthetic_${suffix}`,
    publisher_name: "Synthetic discovery Publisher",
    app_id: appId,
    name: "Synthetic discovery App",
    features: ["premium"],
    distributions: [{ browser_family: "chromium", channel: "unpacked", runtime_id: runtimeId }],
  }));
  writeFileSync(path.join(directory, "extension/manifest.base.json"), JSON.stringify({
    manifest_version: 3,
    name: "Synthetic discovery Extension",
    version: "0.0.0",
    key,
    permissions: ["storage"],
    host_permissions: ["http://127.0.0.1:8787/*"],
    action: { default_popup: "popup.html" },
  }));
  return {
    appId,
    runtimeId,
    directory,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
}
