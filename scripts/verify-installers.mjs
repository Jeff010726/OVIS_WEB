import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const downloads = new URL("../public/downloads/", import.meta.url);
const artifacts = [
  { name: "OVIS-Workspace-Setup-v1.exe", magic: Buffer.from("MZ"), minimumSize: 100_000 },
  {
    name: "ovis-workspace-support_1.0.0_all.deb",
    magic: Buffer.from("!<arch>\n"),
    minimumSize: 1_000,
  },
  {
    name: "ovis-workspace-support-1.0.0.noarch.rpm",
    magic: Buffer.from([0xed, 0xab, 0xee, 0xdb]),
    minimumSize: 4_000,
  },
  {
    name: "OVIS-Workspace-Support.mobileconfig",
    magic: Buffer.from("<?xml"),
    minimumSize: 4_000,
  },
];

const checksumFile = await readFile(new URL("SHA256SUMS", downloads), "utf8");
const checksums = new Map(
  checksumFile
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, name] = line.trim().split(/\s+/, 2);
      return [name, hash];
    }),
);

for (const artifact of artifacts) {
  const bytes = await readFile(new URL(artifact.name, downloads));
  if (bytes.byteLength < artifact.minimumSize) {
    throw new Error(`${artifact.name} is unexpectedly small`);
  }
  if (!bytes.subarray(0, artifact.magic.length).equals(artifact.magic)) {
    throw new Error(`${artifact.name} has an invalid file signature`);
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (checksums.get(artifact.name) !== actual) {
    throw new Error(`${artifact.name} does not match SHA256SUMS`);
  }
  console.log(`${artifact.name} SHA-256: ${actual}`);
}

const mobileconfig = await readFile(
  new URL("OVIS-Workspace-Support.mobileconfig", downloads),
  "utf8",
);
for (const requiredValue of [
  "com.google.Chrome",
  "com.microsoft.Edge",
  "WebAppInstallForceList",
  "ManagedConfigurationPerOrigin",
  "WebUsbAllowDevicesForUrls",
  "https://ovis.aimorelogy.com",
  "<integer>13126</integer>",
  "<integer>4110</integer>",
  "<key>create_desktop_shortcut</key><false/>",
]) {
  if (!mobileconfig.includes(requiredValue)) {
    throw new Error(`mobileconfig is missing ${requiredValue}`);
  }
}
