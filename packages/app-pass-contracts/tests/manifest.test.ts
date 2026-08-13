import assert from "node:assert/strict";
import test from "node:test";

import { ManifestValidationError, validatedManifest } from "../src/index";

const validManifest = {
  $schema: "https://pass.serp.co/schema/app-manifest-v1.json",
  schema_version: 1,
  publisher_id: "pub_invited_pilot",
  publisher_name: "Invited Pilot",
  app_id: "app_video_downloader",
  name: "Video Downloader",
  features: ["downloads", "premium"],
  distributions: [{ browser_family: "chromium", channel: "unpacked", runtime_id: "abcdefghijklmnopabcdefghijklmnop" }],
};

test("validates and canonicalizes the public App manifest", () => {
  const manifest = validatedManifest({ ...validManifest, features: ["premium", "downloads"] });
  assert.deepEqual(manifest.features, ["downloads", "premium"]);
});

test("rejects fields outside the versioned public contract", () => {
  assert.throws(
    () => validatedManifest({ ...validManifest, platform_secret: "must-not-exist" }),
    ManifestValidationError,
  );
});
