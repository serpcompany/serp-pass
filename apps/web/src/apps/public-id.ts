function slug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 48) || "record";
}

function generatedPublicId(prefix: "pub" | "app", name: string, collisionSuffix?: string) {
  const suffix = collisionSuffix ? `_${collisionSuffix}` : "";
  return `${prefix}_${slug(name).slice(0, 59 - prefix.length - suffix.length)}${suffix}`;
}

export function generatePublisherId(name: string, collisionSuffix?: string) {
  return generatedPublicId("pub", name, collisionSuffix);
}

export function generateAppId(name: string, collisionSuffix?: string) {
  return generatedPublicId("app", name, collisionSuffix);
}
