import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const signingDir = resolve(root, "正式发布资料", "01-私密签名");
const keystorePath = resolve(signingDir, "lilys-wardrobe-release.jks");
const credentialsPath = resolve(signingDir, "release-signing.local.json");
const javaHome = resolve(root, ".toolchains/jdk-21.0.9-lite");
const keytool = resolve(javaHome, "bin/keytool.exe");
const alias = "lilys-wardrobe-release";

if (!existsSync(keytool)) throw new Error(`Missing keytool: ${keytool}`);
if (existsSync(keystorePath) || existsSync(credentialsPath)) {
  throw new Error("Release signing files already exist; refusing to replace the permanent app identity.");
}

await mkdir(signingDir, { recursive: true });
const password = randomBytes(32).toString("base64url");
const env = { ...process.env, LILY_KEYTOOL_PASSWORD: password };
const result = spawnSync(keytool, [
  "-genkeypair",
  "-keystore", keystorePath,
  "-storetype", "PKCS12",
  "-alias", alias,
  "-keyalg", "RSA",
  "-keysize", "4096",
  "-validity", "10000",
  "-dname", "CN=Mojie Studio, OU=Game Release, O=Mojie Studio, L=Shanghai, ST=Shanghai, C=CN",
  "-storepass:env", "LILY_KEYTOOL_PASSWORD",
  "-keypass:env", "LILY_KEYTOOL_PASSWORD",
], { env, stdio: "inherit" });

if (result.status !== 0) {
  throw new Error(`keytool failed with exit code ${result.status}`);
}

await writeFile(credentialsPath, `${JSON.stringify({
  keystore: "正式发布资料/01-私密签名/lilys-wardrobe-release.jks",
  alias,
  storePassword: password,
  keyPassword: password,
}, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

console.log(`RELEASE_KEYSTORE_READY=${keystorePath}`);
console.log(`RELEASE_CREDENTIALS_READY=${credentialsPath}`);
console.log("BACKUP_REQUIRED=Keep both files together; losing either prevents future app updates.");
