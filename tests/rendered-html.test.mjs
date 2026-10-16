import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Lily wardrobe adventure start screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>莉莉的衣橱冒险<\/title>/);
  assert.match(html, /class="start-screen(?:\s|\")/);
  assert.doesNotMatch(html, /测试版|全关卡与服装已解锁|50关\s*[·•]/);
  assert.match(html, /开始游戏/);
  assert.match(html, /每次启动必读/);
  assert.match(html, /适龄提示与隐私保护/);
  assert.match(html, /同意以上内容并继续/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("build output includes generated art and playable game code", async () => {
  const assetsRoot = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsRoot);
  const cssFile = files.find((file) => file.startsWith("index-") && file.endsWith(".css"));
  const gameFile = files.find((file) => file.startsWith("DressboxGame-") && file.endsWith(".js"));
  assert.ok(cssFile);
  assert.ok(gameFile);

  const css = await readFile(new URL(cssFile, assetsRoot), "utf8");
  const game = await readFile(new URL(gameFile, assetsRoot), "utf8");

  assert.match(css, /art-v3\/start-screen-clean\.png/);
  assert.match(css, /art-v3\/start-screen-mobile\.png/);
  assert.doesNotMatch(css, /watermark-cover/);
  assert.match(css, /board-frame/);
  assert.match(css, /--tile-goal/);
  assert.match(css, /--crate-art/);
  assert.match(css, /art-v3\/level-map-clean\.png/);
  assert.doesNotMatch(css, /art\/level-map\.png/);
  assert.match(game, /lilys-wardrobe-adventure/);
  assert.match(game, /皇冠终章礼服/);
  assert.match(game, /art-v2\/objects/);
  assert.match(game, /art-v2\/character/);
  assert.match(game, /art-v3\/scene-board-chapter-05/);
  assert.match(game, /100/);
});
