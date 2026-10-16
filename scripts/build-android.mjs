import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const profile = process.argv[2];
if (!['mobile', 'pad'].includes(profile)) {
  throw new Error("Usage: node scripts/build-android.mjs <mobile|pad>");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const javaHome = resolve(root, ".toolchains/jdk-21.0.9-lite");
const androidSdk = resolve(root, ".toolchains/android-sdk");
const gradleHome = resolve(root, ".toolchains/gradle-8.14.3");
const androidDir = resolve(root, "android");
const gradleUserHome = resolve(root, ".gradle-user-temp");
const androidTemp = resolve(root, ".android-user-temp", profile);
const officialReleaseRoot = resolve(root, "正式发布资料");
const officialSigningDir = resolve(officialReleaseRoot, "01-私密签名");
const officialSigningPath = resolve(officialSigningDir, "release-signing.local.json");
const legacySigningPath = resolve(root, "signing/release-signing.local.json");
const localSigningPath = existsSync(officialSigningPath) ? officialSigningPath : legacySigningPath;
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const appId = profile === "pad" ? "com.lilywardrobe.quest.pad" : "com.lilywardrobe.quest";
const appName = profile === "pad" ? "莉莉的衣橱冒险 HD" : "莉莉的衣橱冒险";
const orientation = profile === "pad" ? "sensorLandscape" : "portrait";

await mkdir(gradleUserHome, { recursive: true });
await mkdir(androidTemp, { recursive: true });

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  ANDROID_USER_HOME: androidTemp,
  GRADLE_USER_HOME: gradleUserHome,
  TEMP: androidTemp,
  TMP: androidTemp,
  LILY_BUILD_PROFILE: profile,
  VITE_BUILD_PROFILE: profile,
  GRADLE_OPTS: `${process.env.GRADLE_OPTS ?? ""} -Duser.home=${androidTemp} -Djava.io.tmpdir=${androidTemp}`.trim(),
  PATH: `${resolve(javaHome, "bin")};${resolve(androidSdk, "platform-tools")};${process.env.PATH ?? ""}`,
};

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

for (const required of [
  resolve(javaHome, "bin/java.exe"),
  resolve(androidSdk, "platform-tools/adb.exe"),
  resolve(gradleHome, "bin/gradle.bat"),
]) {
  if (!existsSync(required)) throw new Error(`Missing Android build tool: ${required}`);
}

run("npx", ["vite", "build", "--config", "vite.android.config.ts"]);
if (!existsSync(androidDir)) run("npx", ["cap", "add", "android"]);
run("npx", ["cap", "sync", "android"]);
await writeFile(resolve(androidDir, ".build-mode"), `${profile}\n`);
await writeFile(resolve(androidDir, "local.properties"), `sdk.dir=${androidSdk.replaceAll("\\", "\\\\")}\n`);

let localSigning = null;
if (existsSync(localSigningPath)) {
  localSigning = JSON.parse(await readFile(localSigningPath, "utf8"));
}
const signing = {
  keystore: process.env.LILY_RELEASE_KEYSTORE
    ?? (localSigningPath === officialSigningPath
      ? resolve(officialSigningDir, "lilys-wardrobe-release.jks")
      : localSigning?.keystore),
  storePassword: process.env.LILY_RELEASE_KEYSTORE_PASSWORD ?? localSigning?.storePassword,
  alias: process.env.LILY_RELEASE_KEY_ALIAS ?? localSigning?.alias,
  keyPassword: process.env.LILY_RELEASE_KEY_PASSWORD ?? localSigning?.keyPassword,
};
const hasReleaseSigning = Object.values(signing).every(Boolean);
const resolvedKeystore = signing.keystore
  ? resolve(root, signing.keystore)
  : null;
if (hasReleaseSigning && !existsSync(resolvedKeystore)) {
  throw new Error(`Release keystore not found at ${resolvedKeystore}`);
}
if (hasReleaseSigning) {
  env.LILY_RELEASE_KEYSTORE_PASSWORD = signing.storePassword;
  env.LILY_RELEASE_KEY_ALIAS = signing.alias;
  env.LILY_RELEASE_KEY_PASSWORD = signing.keyPassword;
}

const versionCode = Number(process.env.LILY_ANDROID_VERSION_CODE ?? 5);
if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error("LILY_ANDROID_VERSION_CODE must be a positive integer");
}

const appGradlePath = resolve(androidDir, "app/build.gradle");
let appGradle = await readFile(appGradlePath, "utf8");
appGradle = appGradle
  .replace(/applicationId\s+"[^"]*"/, `applicationId "${appId}"`)
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${packageJson.version}"`);
if (hasReleaseSigning) {
  const keystorePath = resolvedKeystore.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  // Normalize an earlier/generated block before inserting the release binding.
  // Targeting the whole buildTypes/release prefix avoids matching the
  // identically named release entry inside signingConfigs.
  appGradle = appGradle.replace(/^\s*signingConfig signingConfigs\.release\s*$/gm, "");
  if (!appGradle.includes("signingConfigs {")) {
    appGradle = appGradle.replace(
      "    buildTypes {",
      `    signingConfigs {
        release {
            storeFile file('${keystorePath}')
            storePassword System.getenv("LILY_RELEASE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("LILY_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("LILY_RELEASE_KEY_PASSWORD")
        }
    }

    buildTypes {`,
    );
  } else {
    appGradle = appGradle.replace(
      /storeFile\s+file\((['"])[^'"]*\1\)/,
      `storeFile file('${keystorePath}')`,
    );
  }
  appGradle = appGradle.replace(
    /(buildTypes\s*\{\s*release\s*\{)/,
    `$1\n            signingConfig signingConfigs.release`,
  );
}
await writeFile(appGradlePath, appGradle);

const manifestPath = resolve(androidDir, "app/src/main/AndroidManifest.xml");
let manifest = await readFile(manifestPath, "utf8");
if (/android:screenOrientation="[^"]*"/.test(manifest)) {
  manifest = manifest.replace(/android:screenOrientation="[^"]*"/, `android:screenOrientation="${orientation}"`);
} else {
  manifest = manifest.replace("            android:name=\".MainActivity\"", `            android:name=".MainActivity"\n            android:screenOrientation="${orientation}"`);
}
await writeFile(manifestPath, manifest);

const stringsPath = resolve(androidDir, "app/src/main/res/values/strings.xml");
let strings = await readFile(stringsPath, "utf8");
strings = strings
  .replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${appName}</string>`)
  .replace(/<string name="title_activity_main">.*?<\/string>/, `<string name="title_activity_main">${appName}</string>`)
  .replace(/<string name="package_name">.*?<\/string>/, `<string name="package_name">${appId}</string>`)
  .replace(/<string name="custom_url_scheme">.*?<\/string>/, `<string name="custom_url_scheme">${appId}</string>`);
await writeFile(stringsPath, strings);

const task = hasReleaseSigning ? "assembleRelease" : "assembleDebug";
run(resolve(gradleHome, "bin/gradle.bat"), [task, "--no-daemon", "--stacktrace"], androidDir);

const variant = hasReleaseSigning ? "release" : "debug";
const sourceApk = resolve(androidDir, `app/build/outputs/apk/${variant}/app-${variant}.apk`);
if (!existsSync(sourceApk)) throw new Error(`APK not found at ${sourceApk}`);

const releaseDir = hasReleaseSigning
  ? resolve(officialReleaseRoot, "03-正式安装包", "Android")
  : resolve(root, "releases");
await mkdir(releaseDir, { recursive: true });
const signingLabel = hasReleaseSigning ? "release-signed" : "test-signed";
const outputApk = resolve(releaseDir, `lilys-wardrobe-${profile}-v${packageJson.version}-${signingLabel}.apk`);
await copyFile(sourceApk, outputApk);
console.log(`APK_READY=${outputApk}`);
if (!hasReleaseSigning) console.warn("APK_SIGNING=Android debug key (installable test build; not store-upload ready)");
