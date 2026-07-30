import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import worker from "../dist/server/index.js";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.slice(1));
const clientRoot = resolve(projectRoot, "dist/client");
const port = Number(process.env.PORT ?? process.argv.at(-1) ?? 3217);

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
]);

function safeAssetPath(pathname) {
  const decoded = decodeURIComponent(pathname.replace(/^\/+/, ""));
  const target = normalize(join(clientRoot, decoded));
  return target.startsWith(clientRoot) ? target : null;
}

async function assetFetch(request) {
  const url = new URL(request.url);
  const filePath = safeAssetPath(url.pathname);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "content-type": types.get(extname(filePath)) ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

createServer(async (req, res) => {
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
  });
  const url = new URL(request.url);
  const staticResponse = await assetFetch(request);

  const response =
    url.pathname.startsWith("/assets/") || staticResponse.status === 200
      ? staticResponse
      : await worker.fetch(
          request,
          { ASSETS: { fetch: assetFetch } },
          { waitUntil() {}, passThroughOnException() {} },
        );

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`Dressbox Quest local preview: http://localhost:${port}/`);
});
