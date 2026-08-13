import { readFileSync, writeFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";

const schemaUrl = new URL("../schema/app-manifest-v1.schema.json", import.meta.url);
const outputUrl = new URL("../src/generated/app-manifest-v1-validator.js", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true, code: { source: true, esm: true } });
const validator = ajv.compile(schema);
let generated = standaloneCode(ajv, validator);
const helperReplacements = [
  ['const func1 = require("ajv/dist/runtime/ucs2length").default;', 'const func1 = (value) => Array.from(value).length;'],
  ['const func0 = require("ajv/dist/runtime/equal").default;', 'const func0 = (left, right) => { if (Object.is(left, right)) return true; if (!left || !right || typeof left !== "object" || typeof right !== "object") return false; const leftKeys = Object.keys(left); const rightKeys = Object.keys(right); return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && func0(left[key], right[key])); };'],
] as const;
for (const [commonJs, esm] of helperReplacements) {
  if (!generated.includes(commonJs)) throw new Error(`AJV standalone helper shape changed: ${commonJs}`);
  generated = generated.replace(commonJs, esm);
}

writeFileSync(outputUrl, `${generated}\n`);
