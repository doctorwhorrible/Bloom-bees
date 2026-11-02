// Solver + sanity tests. Computes par for every level, verifies solvability and
// order independence, and writes src/levels.generated.json.
import { writeFileSync } from "node:fs";
import { LEVELS } from "../src/levels";
import { parseGrid, solve, stateFor, placeBee, newState, isWon, isFull } from "../src/engine";

let failed = 0;
const fail = (m: string) => { failed++; console.error("FAIL:", m); };

// --- rule unit checks -------------------------------------------------------
{
  // 1-flower region floods from one bee
  const g = parseGrid(["111", "1#1"]);
  const r = stateFor(g, [0]);
  if (!isWon(g, r)) fail("bee on 1-flower region should flood it");
  // bee on bud half-charges AND relays; a lone bud-with-1-flower dead end stalls
  const g2 = parseGrid(["21"]);
  const rA = stateFor(g2, [1]);
  if (!(rA[0] === 1 && rA[1] === 1)) fail("bee on 1-flower next to bud: bud should be half-charged only");
  const rB = stateFor(g2, [0]);
  if (!isWon(g2, rB)) fail("bee on bud next to 1-flower should bloom both (bounce-back)");
  // two adjacent buds ping-pong to full from a single bee
  const g3 = parseGrid(["22"]);
  if (!isWon(g3, stateFor(g3, [0]))) fail("two adjacent buds should bloom from one bee");
  // isolated bud can never bloom
  const g4 = parseGrid(["2"]);
  if (solve(g4, 3)) fail("isolated bud must be unsolvable");
  // rocks block
  const g5 = parseGrid(["1#1"]);
  if (stateFor(g5, [0])[2] !== 0) fail("rocks must block pulses");
  // total relays = min(received, need): 3-bud in a row of 1-flower, check pulses accepted
  const g6 = parseGrid(["13"]);
  const r6 = newState(g6);
  const waves = placeBee(g6, r6, 0);
  if (r6[0] !== 1 || r6[1] !== 1) fail("1 then 3: 3-bud gets only one pulse");
  if (waves.length !== 2) fail("expected 2 waves");
}

// --- per-level solve + order independence ------------------------------------
const out: Record<string, unknown> = {};
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

console.log("id  world name              diff role                               par limit sols waves flowers");
for (const L of LEVELS) {
  const g = parseGrid(L.rows);
  const s = solve(g, 7);
  if (!s) { fail(`level ${L.id} unsolvable`); continue; }
  // order independence: random bee sets in random orders give identical states
  for (let t = 0; t < 200; t++) {
    const k = 1 + Math.floor(rnd() * Math.min(6, g.flowers.length));
    const set = shuffle(g.flowers.slice()).slice(0, k);
    const a = stateFor(g, set);
    const b = stateFor(g, shuffle(set.slice()));
    if (a.some((v, i) => v !== b[i])) { fail(`level ${L.id}: order dependence for ${set}`); break; }
  }
  // every minimum solution must win in every order
  for (const sol of s.all) {
    const r = stateFor(g, shuffle(sol.slice()));
    if (!isWon(g, r)) fail(`level ${L.id}: solution does not win`);
    // placing in this order must be legal (no bee onto a full tile)
    const r2 = newState(g);
    const order = shuffle(sol.slice());
    let legalSomeOrder = false;
    for (let tries = 0; tries < 30 && !legalSomeOrder; tries++) {
      const rr = newState(g);
      let ok = true;
      for (const b of shuffle(order.slice())) { if (isFull(g, rr, b)) { ok = false; break; } placeBee(g, rr, b); }
      if (ok) legalSomeOrder = true;
    }
    void r2;
    if (!legalSomeOrder) fail(`level ${L.id}: no legal placement order for solution`);
  }
  const limit = s.par + L.spare;
  console.log(`${String(L.id).padEnd(3)} ${String(L.world).padEnd(5)} ${L.name.padEnd(17)} ${String(L.difficulty).padEnd(4)}${L.role.padEnd(36)}${String(s.par).padEnd(4)}${String(limit).padEnd(6)}${String(s.solutions).padEnd(5)}${String(s.maxWaves).padEnd(6)}${g.flowers.length}`);
  out[L.id] = { par: s.par, solutions: s.solutions, solution: s.solution, all: s.all, maxWaves: s.maxWaves };
}
writeFileSync(new URL("../src/levels.generated.json", import.meta.url), JSON.stringify(out, null, 1));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("verify OK: all levels solvable, rules + order-independence checks pass");
