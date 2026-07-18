import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const policyPath = new URL(
  "../public/managed/ovis-workspace-policy-v1.json",
  import.meta.url,
);
const hashPath = new URL(
  "../public/managed/ovis-workspace-policy-v1.json.sha256",
  import.meta.url,
);
const policy = await readFile(policyPath);
const expected = (await readFile(hashPath, "utf8")).trim().split(/\s+/)[0];
const actual = createHash("sha256").update(policy).digest("hex");

if (actual !== expected) {
  throw new Error(
    `Managed policy v1 is immutable: expected SHA-256 ${expected}, received ${actual}`,
  );
}

console.log(`Managed policy v1 SHA-256: ${actual}`);
