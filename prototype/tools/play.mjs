// Drive the built game in headless Chrome. Usage:
//   node tools/play.mjs <url> <levelId> <outPrefix> [--video <dir>] [--solve]
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const url = args[0], id = +args[1], out = args[2];
const vi = args.indexOf("--video");
const videoDir = vi >= 0 ? args[vi + 1] : null;
const info = JSON.parse(readFileSync(new URL("../src/levels.generated.json", import.meta.url)));
const levelsSrc = readFileSync(new URL("../src/levels.ts", import.meta.url), "utf8");
// parse rows for this level id from levels.ts
const re = new RegExp(`id: ${id},[\\s\\S]*?rows: \\[([^\\]]*)\\]`);
const rows = [...re.exec(levelsSrc)[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const gw = rows[0].length, gh = rows.length;

const VW = 390, VH = 844;
const s = Math.min(VW / 720, VH / 1560);
const offX = (VW - 720 * s) / 2, offY = (VH - 1560 * s) / 2;
const tileSize = Math.min(Math.floor(640 / gw), Math.floor((1235 - 560) / gh), 150);
const ox = 360 - (gw * tileSize) / 2 + tileSize / 2;
const oy = (560 + 1235) / 2 - (gh * tileSize) / 2 + tileSize / 2;
const tileXY = (i) => ({ x: offX + (ox + (i % gw) * tileSize) * s, y: offY + (oy + Math.floor(i / gw) * tileSize) * s });
const logic = (x, y) => ({ x: offX + x * s, y: offY + y * s });

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: VW, height: VH } } } : {}),
});
const page = await ctx.newPage();
page.on("console", (m) => { if (!/GL Driver|Phaser v3/.test(m.text())) console.log("console:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(url);
await page.waitForTimeout(1200);
// open level from the menu
const idx = id - 1;
const worldOf = (n) => (n <= 4 ? 1 : n <= 8 ? 2 : 3);
// menu layout (logical coords) mirrors MenuScene
const cardW = 320, cardH = 128, gx = 28, gy = 20;
let y = 430, last = 0, col = 0, pos = {};
for (let n = 1; n <= 10; n++) {
  if (worldOf(n) !== last) { if (col !== 0) { y += cardH + gy; col = 0; } last = worldOf(n); y += 62; }
  pos[n] = { x: 360 + (col === 0 ? -(cardW + gx) / 2 : (cardW + gx) / 2), y: y + cardH / 2 };
  col++; if (col === 2) { col = 0; y += cardH + gy; }
}
let p = logic(pos[id].x, pos[id].y);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}-start.png` });
const sol = info[id].solution;
let n = 0;
for (const t of sol.slice(0, +(process.env.MAXBEES || 99))) {
  const q = tileXY(t);
  await page.mouse.click(q.x, q.y);
  n++;
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}-bee${n}-mid.png` });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${out}-bee${n}.png` });
}
await page.waitForTimeout(2800);
await page.screenshot({ path: `${out}-win.png` });
await ctx.close();
await b.close();
