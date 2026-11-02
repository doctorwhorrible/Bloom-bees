// Solver + rule checks. Computes par for every level, reports whether placement
// order changes the result, and writes src/levels.generated.json.
import { writeFileSync } from "node:fs";
import { LEVELS } from "../src/levels";
import {
  parseGrid, solve, stateFor, placeBee, newState, isWon, replay, findOrderSensitivity,
  type Wave,
} from "../src/engine";

let failed = 0;
const fail = (m: string) => { failed++; console.error("FAIL:", m); };
const relays = (waves: Wave[], tile: number) =>
  waves.reduce((n, w) => n + w.filter((e) => e.tile === tile && e.relayed).length, 0);

// --- rule unit checks -------------------------------------------------------
{
  // 1-flower region floods from one bee (a 1-flower still relays exactly once)
  const g = parseGrid(["111", "1#1"]);
  const r = stateFor(g, [0]);
  if (!isWon(g, r)) fail("bee on 1-flower region should flood it");

  // no rebound: a bee on the bud blooms the flower and does NOT get an echo back
  const g2 = parseGrid(["21"]);
  const onFlower = stateFor(g2, [1]);
  if (!(onFlower[0] === 1 && onFlower[1] === 1) || isWon(g2, onFlower)) fail("bee on the flower should leave the bud half-charged");
  const onBud = newState(g2);
  const budWaves = placeBee(g2, onBud, 0);
  if (isWon(g2, onBud) || onBud[0] !== 1 || onBud[1] !== 1) fail(`bee on the bud must not be topped up by an echo, got ${onBud[0]},${onBud[1]}`);
  const budSent = budWaves.flatMap((w) => w.filter((e) => e.tile === 0 && e.relayed).flatMap((e) => e.sent));
  const flowerSent = budWaves.flatMap((w) => w.filter((e) => e.tile === 1 && e.relayed).flatMap((e) => e.sent));
  if (budSent.join(",") !== "1" || flowerSent.length !== 0) fail(`bud should pulse the flower and the flower should not pulse back (${budSent} / ${flowerSent})`);
  if (!isWon(g2, stateFor(g2, [1, 0]))) fail("flower then bud should win once the echo is gone");

  // two adjacent buds: one bee leaves both half-charged; the second bee (no sender) finishes them
  const g3 = parseGrid(["22"]);
  const r3 = newState(g3);
  const w3 = placeBee(g3, r3, 0);
  if (isWon(g3, r3) || r3[0] !== 1 || r3[1] !== 1) fail(`pair of buds should end 1,1 from one bee, got ${r3[0]},${r3[1]}`);
  if (relays(w3, 0) !== 1 || relays(w3, 1) !== 1) fail("each bud relays once in that turn");
  if (w3.some((w) => w.some((e) => e.tile === 1 && e.sent.includes(0)))) fail("the second bud must not rebound");
  const w3b = placeBee(g3, r3, 1);
  if (!isWon(g3, r3) || r3[0] !== 2 || r3[1] !== 2) fail("second bee should finish the pair");
  if (relays(w3b, 1) !== 1) fail("the second bee's bud should relay");

  // two neighbors can still deliver two charges in one wave; the bud relays once and skips both senders
  const gHit = parseGrid(["11", "12"]);
  const rHit = newState(gHit);
  const wHit = placeBee(gHit, rHit, 0);
  const budEv = wHit.flatMap((w) => w.filter((e) => e.tile === 3));
  const accepted = budEv.reduce((a, e) => a + e.accepted, 0);
  if (!isWon(gHit, rHit) || accepted !== 2 || relays(wHit, 3) !== 1 || budEv.some((e) => e.sent.length !== 0)) {
    fail(`fork should bloom the bud with 2 charge and no rebound (accepted ${accepted})`);
  }

  // isolated bud can never bloom
  const g4 = parseGrid(["2"]);
  if (solve(g4, 3)) fail("isolated bud must be unsolvable");

  // rocks block
  const g5 = parseGrid(["1#1"]);
  if (stateFor(g5, [0])[2] !== 0) fail("rocks must block pulses");

  // a 1-flower still gives a 3-bud only one pulse
  const g6 = parseGrid(["13"]);
  const r6 = newState(g6);
  const waves = placeBee(g6, r6, 0);
  if (r6[0] !== 1 || r6[1] !== 1) fail("1 then 3: 3-bud gets only one pulse");
  if (waves.length !== 2) fail(`expected 2 waves, got ${waves.length}`);

  // order can matter: 1 2 1 2. The two buds in either order are legal and leave different charges.
  const gOrd = parseGrid(["1212"]);
  const ordA = replay(gOrd, [1, 3]);
  const ordB = replay(gOrd, [3, 1]);
  if (!ordA.legal || !ordB.legal) fail("both bud orders of 1212 should be legal");
  if (!ordA.r.some((v, i) => v !== ordB.r[i])) fail("1212 orders should leave different charges");
  const found = findOrderSensitivity(gOrd, 2);
  if (!found) fail("order check should notice 1212");

  // undo replays the prefix and restores charges exactly
  const step = newState(g2);
  placeBee(g2, step, 1);
  const undone = stateFor(g2, [1]);
  if (undone.some((v, i) => v !== step[i])) fail("undo should restore the state before the last bee");
  placeBee(g2, step, 0);
  const again = stateFor(g2, [1, 0]);
  if (again.some((v, i) => v !== step[i])) fail("replaying the sequence should match incremental placement");
}

// --- per-level solve + order-sensitivity report ------------------------------
const out: Record<string, unknown> = {};
console.log("id  world name              diff role                               par limit sols waves order depth flowers");
for (const L of LEVELS) {
  const g = parseGrid(L.rows);
  const s = solve(g, 8);
  if (!s) { fail(`level ${L.id} unsolvable`); continue; }
  for (const sol of [s.solution, ...s.all]) {
    const rep = replay(g, sol);
    if (!rep.legal || !isWon(g, rep.r)) fail(`level ${L.id}: stored sequence ${sol.join(",")} is not a legal win`);
  }
  const limit = s.par + L.spare;
  const depth = Math.min(g.flowers.length, limit);
  const t0 = Date.now();
  const hit = depth >= 2 ? findOrderSensitivity(g, depth) : null;
  const ms = Date.now() - t0;
  if (hit) {
    console.log(`  order example L${L.id}: ${hit.a.join(",")} vs ${hit.b.join(",")}`);
  }
  // all-1 meadows are order-independent by the rule; catch a checker bug if one flags
  if (g.flowers.every((i) => g.need[i] === 1) && hit) fail(`level ${L.id}: all-1 field reported order-sensitive`);
  console.log(`${String(L.id).padEnd(3)} ${String(L.world).padEnd(5)} ${L.name.padEnd(17)} ${String(L.difficulty).padEnd(4)}${L.role.padEnd(36)}${String(s.par).padEnd(4)}${String(limit).padEnd(6)}${String(s.solutions).padEnd(5)}${String(s.maxWaves).padEnd(6)}${(hit ? "YES" : "no").padEnd(6)}${String(depth).padEnd(6)}${g.flowers.length}  ${ms}ms`);
  out[L.id] = {
    par: s.par, solutions: s.solutions, solution: s.solution, all: s.all, maxWaves: s.maxWaves,
    orderSensitive: !!hit,
  };
}
writeFileSync(new URL("../src/levels.generated.json", import.meta.url), JSON.stringify(out, null, 1));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("verify OK: levels solvable, once-per-turn relay checked, order sensitivity reported");
