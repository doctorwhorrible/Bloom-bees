// Minimal static server for dist/ (no dependencies). Usage: node tools/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = +(process.argv[2] || process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".map": "application/json" };
const cache = new Map();

createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    let file = join(root, p);
    try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { file = join(root, "index.html"); }
    const ext = extname(file);
    let body = ext === ".html" ? undefined : cache.get(file);
    if (!body) {
      body = await readFile(file);
      if ([".js", ".html", ".css", ".json"].includes(ext)) body = { raw: body, gz: gzipSync(body) };
      else body = { raw: body };
      if (ext !== ".html") cache.set(file, body);
    }
    const headers = { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" };
    if (body.gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) { headers["Content-Encoding"] = "gzip"; res.writeHead(200, headers); res.end(body.gz); }
    else { res.writeHead(200, headers); res.end(body.raw); }
  } catch (e) { res.writeHead(500); res.end("server error"); }
}).listen(port, "0.0.0.0", () => console.log(`serving ${root} on http://0.0.0.0:${port}`));
