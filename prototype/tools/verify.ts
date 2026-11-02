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

  // bee on the flower half-charges the bud; the bud relays once and the return is absorbed
  const g2 = parseGrid(["21"]);
  const rA = stateFor(g2, [1]);
  if (!(rA[0] === 1 && rA[1] === 1)) fail("bee on 1-flower next to bud: bud should be half-charged only");
  const rB = stateFor(g2, [0]);
  if (!isWon(g2, rB)) fail("bee on bud next to 1-flower should bloom both (one return pulse)");

  // two adjacent buds do NOT ping-pong to full from one bee
  const g3 = parseGrid(["22"]);
  const r3 = newState(g3);
  const w3 = placeBee(g3, r3, 0);
  if (isWon(g3, r3) || r3[0] !== 2 || r3[1] !== 1) fail(`pair of buds should end 2,1 from one bee, got ${r3[0]},${r3[1]}`);
  if (relays(w3, 0) !== 1 || relays(w3, 1) !== 1) fail("each bud relays once in that turn");
  // the half-charged bud relays again on the next turn; the full bud absorbs
  const w3b = placeBee(g3, r3, 1);
  if (!isWon(g3, r3) || r3[0] !== 2 || r3[1] !== 2) fail("second bee should finish the pair");
  if (relays(w3b, 1) !== 1) fail("half-charged bud should relay on the later turn");
  if (w3b.some((w) => w.some((e) => e.tile === 0))) fail("flower full at the start of the turn must absorb");

  // a 2-bud hit twice in one turn blooms and relays only once
  const gHit = parseGrid(["1", "2", "1"]);
  const rHit = newState(gHit);
  const wHit = placeBee(gHit, rHit, 1);
  const accepted = wHit.reduce((n, w) => n + w.filter((e) => e.tile === 1).reduce((a, e) => a + e.accepted, 0), 0);
  if (!isWon(gHit, rHit) || accepted !== 2 || relays(wHit, 1) !== 1) {
    fail(`bud between two flowers should bloom on 2 charge with 1 relay (accepted ${accepted}, relays ${relays(wHit, 1)}, won ${isWon(gHit, rHit)})`);
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

  // order can matter: 2 3 2. Bee on the left bud then the middle wins; the reverse leaves the right bud short.
  const gOrd = parseGrid(["232"]);
  const ordA = replay(gOrd, [0, 1]);
  const ordB = replay(gOrd, [1, 0]);
  if (!ordA.legal || !ordB.legal) fail("both orders of 232 should be legal placements");
  if (!isWon(gOrd, ordA.r) || isWon(gOrd, ordB.r)) fail("232 should win in order 0,1 and not in order 1,0");
  if (ordA.r.every((v, i) => v === ordB.r[i])) fail("232 orders should leave different charges");
  const found = findOrderSensitivity(gOrd, 2);
  if (!found) fail("order check should notice 232");

  // undo replays the prefix and restores charges exactly
  const step = newState(gOrd);
  placeBee(gOrd, step, 0);
  const undone = stateFor(gOrd, [0]);
  if (undone.some((v, i) => v !== step[i])) fail("undo should restore the state before the last bee");
  placeBee(gOrd, step, 1);
  const again = stateFor(gOrd, [0, 1]);
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
