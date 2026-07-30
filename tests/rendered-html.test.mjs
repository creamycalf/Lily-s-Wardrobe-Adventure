import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Dressbox Quest game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>裙装推箱子<\/title>/);
  assert.match(html, /class="game-shell"/);
  assert.match(html, /class="board-frame"/);
  assert.match(html, /class="wardrobe-panel/);
  assert.match(html, /50 关/);
  assert.match(html, /换装系统/);
  assert.match(html, /\/game-scene-2p5d\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("build output includes game styles and image assets", async () => {
  const assetsRoot = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsRoot);
  const cssFile = files.find((file) => file.startsWith("index-") && file.endsWith(".css"));
  const gameFile = files.find((file) => file.startsWith("DressboxGame-") && file.endsWith(".js"));
  assert.ok(cssFile);
  assert.ok(gameFile);

  const css = await readFile(new URL(cssFile, assetsRoot), "utf8");
  const game = await readFile(new URL(gameFile, assetsRoot), "utf8");

  assert.match(css, /game-scene-2p5d\.png/);
  assert.match(css, /board-frame/);
  assert.match(css, /tile-goal/);
  assert.match(game, /dressbox-quest-save/);
  assert.match(game, /Array\.from\(\{length:e\}/);
  assert.match(game, /换装系统/);
});
