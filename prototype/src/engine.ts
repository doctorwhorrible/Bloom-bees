// Pure game engine: no Phaser. Shared by the game, the solver and the verify script.
//
// Rules (DESIGN.md v0.5):
//  - A flower with need n accepts up to n pulses. Each time it ACCEPTS a pulse it relays
//    1 pulse to every cardinal flower neighbour. Pulses at a full flower are absorbed.
//  - A bee's pulse counts as a pulse received on its own tile.
//  - Waves: wave 0 = the bee's pulse; wave k+1 = relays accepted in wave k (simultaneous).
//  - Final state is the least fixed point r(i) = min(need(i), bee(i) + sum r(neighbours)),
//    so it does not depend on placement order.

export interface LevelDef {
  id: number;
  name: string;
  world: number;
  note: string; // short teaching hint shown in the level
  rows: string[]; // '.' empty, '#' rock, '1' '2' '3' = pulses needed
  spare: number; // spare bees above par
  // filled in by tools/verify.ts -> src/levels.generated.json
}

export interface SolvedInfo {
  par: number;
  solutions: number; // number of distinct minimum bee sets
  solution: number[]; // one minimum set (tile indices)
  maxWaves: number; // longest chain (total waves over the placements) among minimum solutions
  all: number[][]; // up to 16 minimum bee sets
}

export interface Grid {
  w: number;
  h: number;
  need: Uint8Array; // 0 = no flower
  rock: Uint8Array; // 1 = rock
  adj: number[][]; // flower neighbours (cardinal)
  flowers: number[]; // indices of flower tiles
}

export interface WaveEvent {
  tile: number;
  accepted: number; // pulses accepted this wave (<= need)
  arrived: number; // pulses that arrived (>= accepted)
}
export type Wave = WaveEvent[];

export function parseGrid(rows: string[]): Grid {
  const h = rows.length;
  const w = rows[0].length;
  const need = new Uint8Array(w * h);
  const rock = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error("ragged level rows");
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      const i = y * w + x;
      if (c === "#") rock[i] = 1;
      else if (c >= "1" && c <= "9") need[i] = +c;
    }
  }
  const adj: number[][] = [];
  const flowers: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a: number[] = [];
      if (need[i]) {
        flowers.push(i);
        if (y > 0 && need[i - w]) a.push(i - w);
        if (y < h - 1 && need[i + w]) a.push(i + w);
        if (x > 0 && need[i - 1]) a.push(i - 1);
        if (x < w - 1 && need[i + 1]) a.push(i + 1);
      }
      adj.push(a);
    }
  return { w, h, need, rock, adj, flowers };
}

export function newState(g: Grid): Uint8Array {
  return new Uint8Array(g.w * g.h);
}

export function isFull(g: Grid, r: Uint8Array, i: number): boolean {
  return g.need[i] > 0 && r[i] >= g.need[i];
}

export function isWon(g: Grid, r: Uint8Array): boolean {
  for (const i of g.flowers) if (r[i] < g.need[i]) return false;
  return true;
}

/** Place a bee on tile `t`: mutates r, returns the waves. Caller checks legality. */
export function placeBee(g: Grid, r: Uint8Array, t: number): Wave[] {
  const waves: Wave[] = [];
  let cur = new Map<number, number>([[t, 1]]);
  while (cur.size) {
    const wave: Wave = [];
    const next = new Map<number, number>();
    for (const [i, arrived] of cur) {
      const acc = Math.min(arrived, g.need[i] - r[i]);
      if (acc > 0) {
        r[i] += acc;
        wave.push({ tile: i, accepted: acc, arrived });
        for (const nb of g.adj[i]) next.set(nb, (next.get(nb) ?? 0) + acc);
      }
    }
    if (wave.length) waves.push(wave);
    cur = next;
  }
  return waves;
}

/** Recompute state from a list of bee tiles (order independent). */
export function stateFor(g: Grid, bees: number[]): Uint8Array {
  const r = newState(g);
  for (const b of bees) if (!isFull(g, r, b)) placeBee(g, r, b);
  return r;
}

/** Can the board still be completed with at most `max` extra bees? Returns tiles or null. */
export function findCompletion(g: Grid, r: Uint8Array, bees: number[], max: number): number[] | null {
  if (isWon(g, r)) return [];
  const taken = new Set(bees);
  const cand = g.flowers.filter((i) => !taken.has(i));
  for (let k = 1; k <= max; k++) {
    const res = dfs(g, r, cand, 0, k, []);
    if (res) return res;
  }
  return null;
}

function dfs(g: Grid, r: Uint8Array, cand: number[], from: number, k: number, chosen: number[]): number[] | null {
  if (k === 0) return isWon(g, r) ? chosen : null;
  for (let c = from; c <= cand.length - k; c++) {
    const t = cand[c];
    const r2 = r.slice();
    if (isFull(g, r2, t)) continue; // a bee on a full tile is redundant (and blocked)
    placeBee(g, r2, t);
    const res = dfs(g, r2, cand, c + 1, k - 1, [...chosen, t]);
    if (res) return res;
  }
  return null;
}

/** Brute-force minimum solution: smallest k such that some k-set blooms everything. */
export function solve(g: Grid, maxK = 8): SolvedInfo | null {
  const r0 = newState(g);
  for (let k = 1; k <= maxK; k++) {
    const sols: number[][] = [];
    const rec = (from: number, left: number, r: Uint8Array, chosen: number[]) => {
      if (left === 0) {
        if (isWon(g, r)) sols.push(chosen.slice());
        return;
      }
      for (let c = from; c <= g.flowers.length - left; c++) {
        const t = g.flowers[c];
        const r2 = r.slice();
        // order independence: tile may already be full from other bees in this set, in which
        // case the bee is redundant; the set is still counted at its true size only if useful.
        placeBee(g, r2, t);
        chosen.push(t);
        rec(c + 1, left - 1, r2, chosen);
        chosen.pop();
      }
    };
    rec(0, k, r0, []);
    // keep only sets that are genuinely minimal-size (no smaller set solves: guaranteed since k ascending)
    if (sols.length) {
      let maxWaves = 0;
      for (const s of sols) {
        const r = newState(g);
        let total = 0;
        for (const b of s) if (!isFull(g, r, b)) total += placeBee(g, r, b).length;
        maxWaves = Math.max(maxWaves, total);
      }
      return { par: k, solutions: sols.length, solution: sols[0], maxWaves, all: sols.slice(0, 16) };
    }
  }
  return null;
}

export function limitFor(par: number, spare: number): number {
  return par + spare;
}

export function starsFor(used: number, par: number, limit: number, hintUsed: boolean): number {
  if (used > limit) return 0;
  let s = used <= par ? 3 : used <= par + 1 ? 2 : 1;
  if (hintUsed) s = Math.max(1, s - 1);
  return s;
}
