import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const staging = resolve(root, ".pc-package");
const releaseRoot = resolve(root, "正式发布资料", "03-正式安装包", "Windows");
const appFolderName = "LilysWardrobeAdventure-win32-x64";
const appFolder = resolve(releaseRoot, appFolderName);
const zipPath = resolve(releaseRoot, `lilys-wardrobe-pc-win-x64-v${packageJson.version}.zip`);
const nodePath = dirname(process.execPath);
const env = {
  ...process.env,
  VITE_BUILD_PROFILE: "pc",
  PATH: `${nodePath};${process.env.PATH ?? ""}`,
};

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

run("npx", ["vite", "build", "--config", "vite.pc.config.ts"]);

// These are exact, generated build targets inside this workspace.
await rm(staging, { recursive: true, force: true });
await rm(appFolder, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(staging, { recursive: true });
await mkdir(releaseRoot, { recursive: true });
await cp(resolve(root, "dist-pc"), resolve(staging, "dist-pc"), { recursive: true });
await cp(resolve(root, "desktop/main.cjs"), resolve(staging, "main.cjs"));
await writeFile(resolve(staging, "package.json"), JSON.stringify({
  name: "lilys-wardrobe-adventure",
  productName: "莉莉的衣橱冒险",
  version: packageJson.version,
  main: "main.cjs",
}, null, 2));

await cp(resolve(root, "node_modules/electron/dist"), appFolder, { recursive: true });
await rm(resolve(appFolder, "resources/default_app.asar"), { force: true });
await cp(staging, resolve(appFolder, "resources/app"), { recursive: true });
await rename(resolve(appFolder, "electron.exe"), resolve(appFolder, "LilysWardrobeAdventure.exe"));
const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
run(powershell, [
  "-NoProfile",
  "-Command",
  `Compress-Archive -LiteralPath '${appFolder}' -DestinationPath '${zipPath}' -CompressionLevel Optimal`,
]);
console.log(`PC_READY=${zipPath}`);
