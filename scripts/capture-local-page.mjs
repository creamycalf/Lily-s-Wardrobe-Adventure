import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , url, outputArg, widthArg = "430", heightArg = "932"] = process.argv;
if (!url || !outputArg) {
  throw new Error("Usage: node capture-local-page.mjs <url> <output.png> [width] [height]");
}

const playwrightModule = process.env.PLAYWRIGHT_MODULE;
const playwright = playwrightModule
  ? await import(pathToFileURL(playwrightModule).href)
  : await import("playwright");
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(widthArg), height: Number(heightArg) },
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  const output = resolve(outputArg);
  await mkdir(dirname(output), { recursive: true });
  await page.screenshot({ path: output });
  console.log(`SCREENSHOT_READY=${output}`);
} finally {
  await browser.close();
}
