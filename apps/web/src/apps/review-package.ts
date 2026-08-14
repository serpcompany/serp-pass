import { strFromU8, unzipSync, type UnzipFileInfo } from "fflate";

export const MAX_REVIEW_PACKAGE_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;

export type ReviewPackageInspection = {
  archiveFormat: "zip";
  entryCount: number;
  expandedBytes: number;
  manifestVersion: number;
  extensionName: string;
  extensionVersion: string;
  permissions: string[];
  hostPermissions: string[];
  checks: string[];
};

export class ReviewPackageError extends Error {}

function safeArchivePath(name: string) {
  const normalized = name.replaceAll("\\", "/");
  const withoutDirectoryMarker = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return normalized.length > 0
    && !normalized.startsWith("/")
    && !/^[A-Za-z]:\//u.test(normalized)
    && !normalized.includes("\0")
    && withoutDirectoryMarker.length > 0
    && withoutDirectoryMarker.split("/").every((part) => part !== ".." && part !== "");
}

function stringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export function inspectReviewPackage(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_REVIEW_PACKAGE_BYTES) {
    throw new ReviewPackageError("Review Package must be a non-empty ZIP no larger than 10 MB.");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ReviewPackageError("Review Package must be a ZIP archive.");

  let entryCount = 0;
  let expandedBytes = 0;
  let manifestEntries = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file: UnzipFileInfo) {
        entryCount += 1;
        expandedBytes += file.originalSize;
        if (entryCount > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_EXPANDED_BYTES) {
          throw new ReviewPackageError("Review Package expands beyond the safe inspection limit.");
        }
        if (!safeArchivePath(file.name)) throw new ReviewPackageError("Review Package contains an unsafe archive path.");
        if (file.name === "manifest.json") manifestEntries += 1;
        return file.name === "manifest.json";
      },
    });
  } catch (error) {
    if (error instanceof ReviewPackageError) throw error;
    throw new ReviewPackageError("Review Package is not a readable ZIP archive.");
  }
  if (manifestEntries !== 1 || !files["manifest.json"]) {
    throw new ReviewPackageError("Review Package must contain exactly one root manifest.json.");
  }

  let manifest: Record<string, unknown>;
  try {
    const parsed = JSON.parse(strFromU8(files["manifest.json"]));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    manifest = parsed as Record<string, unknown>;
  } catch {
    throw new ReviewPackageError("Review Package manifest.json must contain valid JSON.");
  }
  if (manifest.manifest_version !== 3) throw new ReviewPackageError("Review Package must be a Manifest V3 Chromium extension.");
  if (typeof manifest.name !== "string" || !manifest.name.trim()) throw new ReviewPackageError("Extension manifest must contain a name.");
  if (typeof manifest.version !== "string" || !/^\d+(?:\.\d+){0,3}$/u.test(manifest.version)) {
    throw new ReviewPackageError("Extension manifest must contain a valid version.");
  }

  const inspection: ReviewPackageInspection = {
    archiveFormat: "zip",
    entryCount,
    expandedBytes,
    manifestVersion: 3,
    extensionName: manifest.name,
    extensionVersion: manifest.version,
    permissions: stringList(manifest.permissions),
    hostPermissions: stringList(manifest.host_permissions),
    checks: ["bounded_zip", "safe_paths", "root_manifest", "manifest_v3"],
  };
  return { manifest, inspection };
}

export async function sha256Hex(bytes: Uint8Array) {
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
