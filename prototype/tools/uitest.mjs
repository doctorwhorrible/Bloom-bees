// Headless UI/logic smoke test against the built game (fake clock). Usage: node tools/uitest.mjs <url>
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const url = process.argv[2] || "http://localhost:4173/?scale=0.75";
const info = JSON.parse(readFileSync(new URL("../src/levels.generated.json", import.meta.url)));
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
let errors = 0; page.on("pageerror", (e) => { errors++; console.log("pageerror", e.message); });
await page.clock.install({ time: 0 });
await page.goto(url);
await page.clock.runFor(2000);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const S = () => page.evaluate(() => { const s = window.__game.scene.getScene("Game"); return { bees: s.bees.slice(), won: s.won, anim: s.animating, hint: s.hintUsed, limit: s.limit, shown: Array.from(s.shown), r: Array.from(s.r), msg: s.msgText.text, stars: null }; });
const go = async (id) => { await page.evaluate((id) => window.__game.scene.start("Game", { id }), id); await page.clock.runFor(500); };
const tap = async (t) => { await page.evaluate((t) => window.__game.scene.getScene("Game").tap(t), t); await page.clock.runFor(60); };
const settle = async () => { await page.clock.runFor(9000); };

// every level: placing the stored minimum solution wins, 3 stars, saved
for (const id of (process.env.ALL ? Object.keys(info) : ["6"])) {
  await go(+id);
  for (const t of info[id].solution) { await tap(t); await settle(); }
  const s = await S();
  const stars = await page.evaluate((id) => JSON.parse(localStorage.getItem("bloombees.stars.v1") || "{}")[id], +id);
  ok(s.won && stars === 3, `level ${id}: min solution wins with 3 stars (par ${info[id].par})`);
}
// blocked tap on bloomed flower, pickup, limit
await page.evaluate(() => localStorage.clear());
await go(1);
await tap(0); await settle();
let s = await S();
ok(s.bees.length === 1 && s.r.every((v, i) => v === (i < 9 ? 1 : 0)), "L1: one bee floods all 9 flowers");
await tap(4); // won already: ignored
s = await S();
ok(s.bees.length === 1 && s.won, "L1: win locks the board");
// L6: bee on tile 1 blooms all but the left bud; tapping bloomed neighbour is blocked, own bee picks up
await go(6);
await tap(1); await settle();
s = await S();
ok(s.bees.length === 1 && !s.won, "L6: bee on tile 1 stalls (not won)");
await tap(2); // bloomed flower: blocked
s = await S();
ok(s.bees.length === 1, "L6: tapping a bloomed flower is blocked (no bee spent)");
await tap(1);
s = await S();
ok(s.bees.length === 0 && s.r.every((v) => v === 0), "L6: tapping own bee picks it up and resets pollen");
await tap(1); await settle(); await tap(0); await settle();
s = await S();
await page.evaluate(() => window.__game.scene.getScene("Game").undo());
await page.clock.runFor(100);
const un = await S();
ok(s.bees.length === 2 && un.bees.length === 1, "L6: undo removes last bee");
// out of bees: L9 par1 limit2 -> place 2 bees that don't win? (every tile wins) use L6 instead
await go(6);
for (const t of [1, 2, 3, 5]) { await tap(t); await settle(); }
s = await S();
ok(!s.won && s.bees.length <= 4, `L6: using limit without solving does not win (bees ${s.bees.length})`);
await tap(8); s = await S();
// hint cost
await go(6);
await page.evaluate(() => window.__game.scene.getScene("Game").hint());
await page.clock.runFor(200);
s = await S();
ok(s.hint === true, "L6: hint sets hintUsed");
const sol6 = info[6].solution;
for (const t of sol6) { await tap(t); await settle(); }
const st6 = await page.evaluate(() => JSON.parse(localStorage.getItem("bloombees.stars.v1") || "{}")[6]);
s = await S();
ok(s.won && st6 === 2, `L6: win at par with hint = 2 stars (got ${st6})`);
// 3-star decay: L4 par 4, use 5 bees (par+1) -> 2 stars
await go(4);
const g4 = info[4].solution.slice();
for (const t of g4) { await tap(t); await settle(); }
console.log("pageerrors:", errors);
await b.close();
process.exit(fails || errors ? 1 : 0);
