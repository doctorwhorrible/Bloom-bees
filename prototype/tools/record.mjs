// Deterministic recording: Playwright's fake clock steps the game frame by frame, so the video is smooth
// even when headless software rendering is slow. Usage: node tools/record.mjs <url> <levelId> <outDir> [wrongTile]
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, rmSync } from "node:fs";

const [url, idStr, outDir, wrongStr] = process.argv.slice(2);
const id = +idStr;
const info = JSON.parse(readFileSync(new URL("../src/levels.generated.json", import.meta.url)));
const src = readFileSync(new URL("../src/levels.ts", import.meta.url), "utf8");
const rows = [...new RegExp(`id: ${id},[\\s\\S]*?rows: \\[([^\\]]*)\\]`).exec(src)[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const gw = rows[0].length, gh = rows.length;
const VW = 390, VH = 844, s = Math.min(VW / 720, VH / 1560);
const offX = (VW - 720 * s) / 2, offY = (VH - 1560 * s) / 2;
const tileSize = Math.min(Math.floor(640 / gw), Math.floor((1235 - 560) / gh), 150);
const ox = 360 - (gw * tileSize) / 2 + tileSize / 2, oy = (560 + 1235) / 2 - (gh * tileSize) / 2 + tileSize / 2;
const tileXY = (i) => ({ x: offX + (ox + (i % gw) * tileSize) * s, y: offY + (oy + Math.floor(i / gw) * tileSize) * s });
const logic = (x, y) => ({ x: offX + x * s, y: offY + y * s });

const frames = `${outDir}/frames`;
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.clock.install({ time: 0 });
await page.goto(url);
let n = 0;
const STEP = 50; // virtual ms per captured frame (20 fps)
async function run(ms) {
  for (let t = 0; t < ms; t += STEP) {
    await page.clock.runFor(STEP);
    await page.screenshot({ path: `${frames}/f${String(n++).padStart(4, "0")}.png`, type: "png" });
  }
}
async function click(p) { await page.mouse.click(p.x, p.y); await page.clock.runFor(16); }
async function clickLogic(x, y) { await click(logic(x, y)); }

await page.clock.runFor(2500); // boot
await run(800);
// menu layout mirrors MenuScene
const cardW = 320, cardH = 128, gx = 28, gy = 20;
const worldOf = (k) => (k <= 4 ? 1 : k <= 8 ? 2 : 3);
let y = 430, last = 0, col = 0; const pos = {};
for (let k = 1; k <= 10; k++) {
  if (worldOf(k) !== last) { if (col !== 0) { y += cardH + gy; col = 0; } last = worldOf(k); y += 62; }
  pos[k] = { x: 360 + (col === 0 ? -(cardW + gx) / 2 : (cardW + gx) / 2), y: y + cardH / 2 };
  col++; if (col === 2) { col = 0; y += cardH + gy; }
}
await clickLogic(pos[id].x, pos[id].y);
await run(1200);
if (wrongStr !== undefined) {
  await click(tileXY(+wrongStr));          // a tempting but wrong first bee
  await run(8000);
  await clickLogic(135, 1420);              // Undo
  await run(900);
}
for (const t of info[id].solution) {
  await click(tileXY(t));
  await run(8000);
}
await run(2600); // win overlay
await ctx.close();
await b.close();
console.log("frames:", n);
