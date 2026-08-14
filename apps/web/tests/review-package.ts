import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import { inspectReviewPackage, ReviewPackageError, sha256Hex } from "../src/apps/review-package";

function packageWith(manifest: Record<string, unknown>, extra: Record<string, Uint8Array> = {}) {
  return zipSync({ "manifest.json": strToU8(JSON.stringify(manifest)), ...extra });
}

test("records bounded Manifest V3 package facts", async () => {
  const bytes = packageWith({ manifest_version: 3, name: "Reviewed Extension", version: "1.2.3", permissions: ["storage"], host_permissions: ["https://example.com/*"] }, { "assets/": new Uint8Array(), "assets/popup.html": strToU8("ok") });
  const result = inspectReviewPackage(bytes);
  assert.equal(result.inspection.manifestVersion, 3);
  assert.equal(result.inspection.extensionName, "Reviewed Extension");
  assert.deepEqual(result.inspection.permissions, ["storage"]);
  assert.equal((await sha256Hex(bytes)).length, 64);
});

test("rejects an unsafe archive path", () => {
  const bytes = packageWith({ manifest_version: 3, name: "Unsafe", version: "1.0.0" }, { "../outside.js": strToU8("bad") });
  assert.throws(() => inspectReviewPackage(bytes), ReviewPackageError);
  const windowsAbsolute = packageWith({ manifest_version: 3, name: "Unsafe", version: "1.0.0" }, { "C:\\outside.js": strToU8("bad") });
  assert.throws(() => inspectReviewPackage(windowsAbsolute), ReviewPackageError);
});

test("rejects missing root manifest and Manifest V2", () => {
  assert.throws(() => inspectReviewPackage(zipSync({ "folder/manifest.json": strToU8("{}") })), /root manifest/u);
  assert.throws(() => inspectReviewPackage(packageWith({ manifest_version: 2, name: "Old", version: "1.0" })), /Manifest V3/u);
});
