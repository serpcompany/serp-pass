import Ajv2020 from "ajv/dist/2020.js";
import manifestSchema from "../schemas/app-manifest-v1.schema.json";

export type AppManifestV1 = {
  $schema: "https://pass.serp.co/schema/app-manifest-v1.json";
  schema_version: 1;
  publisher_id: string;
  publisher_name: string;
  app_id: string;
  name: string;
  features: string[];
  distributions: Array<{
    browser_family: "chromium";
    channel: "unpacked" | "chrome_web_store";
    runtime_id: string;
  }>;
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<AppManifestV1>(manifestSchema);

export class ManifestValidationError extends Error {}

export function validatedManifest(input: unknown): AppManifestV1 {
  if (!validate(input)) {
    const details = validate.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new ManifestValidationError(`Invalid app manifest: ${details ?? "validation failed"}`);
  }
  return {
    ...input,
    features: [...input.features].sort(),
    distributions: [...input.distributions].sort((left, right) =>
      `${left.browser_family}:${left.channel}:${left.runtime_id}`.localeCompare(
        `${right.browser_family}:${right.channel}:${right.runtime_id}`,
      )),
  };
}
