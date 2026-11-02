// Pure game engine: no Phaser. Shared by the game, the solver and the verify script.
//
// Rules (DESIGN.md v0.7):
//  - One turn = one bee placement and its whole cascade.
//  - A flower relays at most once per turn, and only if it was not already fully
//    bloomed at the start of that turn. It relays on the first wave in which it
//    receives a pulse. Later pulses that turn add charge only.
//  - No rebound: that relay skips any neighbor that already sent this flower a
//    pulse earlier this turn, including senders in the same wave.
//  - The bee's own pulse has no sender, so that tile relays to every neighbor.
//  - Pulses into rocks/empty are blocked. Pulses into a flower that was fully
//    bloomed at the start of the turn are absorbed (no charge, no relay).
//  - Charge still stacks. A bud left half-charged can relay again on a later turn.
//  - Placement order can matter, so par is the shortest legal bee sequence.

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
  solutions: number; // winning sequences of length par (ordered placements)
  solution: number[]; // one minimum sequence (tile indices, placement order)
  maxWaves: number; // longest chain (sum of per-turn waves) among counted minimum solutions
  all: number[][]; // up to 16 minimum sequences
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
  accepted: number; // pulses added to charge this wave
  arrived: number; // pulses that arrived this wave
  relayed: boolean; // fired its one relay this wave
  sent: number[]; // neighbors that actually received it (senders this turn are skipped)
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

/**
 * Place a bee on tile `t`. Mutates `r` (charge). Returns waves.
 * Caller must only call this when the tile is a flower, has no bee yet, and is not full.
 */
export function placeBee(g: Grid, r: Uint8Array, t: number): Wave[] {
  const n = r.length;
  const fullAtStart = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (g.need[i] > 0 && r[i] >= g.need[i]) fullAtStart[i] = 1;
  const relayed = new Uint8Array(n);

  const waves: Wave[] = [];
  // Who has already pulsed each tile this turn. Degree is at most 4.
  const senderN = new Uint8Array(n);
  const senderOf = new Int16Array(n * 4);
  const isSender = (i: number, nb: number) => {
    const base = i * 4;
    const k = senderN[i];
    for (let s = 0; s < k; s++) if (senderOf[base + s] === nb) return true;
    return false;
  };
  const addSender = (i: number, from: number) => {
    if (senderN[i] < 4) senderOf[i * 4 + senderN[i]] = from;
    senderN[i]++;
  };

  // Bee pulse: one arrival, no sender, so this tile may relay to every neighbor.
  let curTiles: number[] = [t];
  let curCount = new Uint8Array(n);
  curCount[t] = 1;
  const guardMax = g.flowers.length + 2;
  for (let guard = 0; guard < guardMax && curTiles.length; guard++) {
    const wave: Wave = [];
    const nextTiles: number[] = [];
    const nextCount = new Uint8Array(n);
    for (let k = 0; k < curTiles.length; k++) {
      const i = curTiles[k];
      const arrived = curCount[i];
      if (arrived <= 0 || g.need[i] === 0 || fullAtStart[i]) continue;
      const room = g.need[i] - r[i];
      const acc = room > 0 ? Math.min(arrived, room) : 0;
      if (acc > 0) r[i] += acc;
      let didRelay = false;
      let sent: number[] = [];
      if (!relayed[i]) {
        relayed[i] = 1;
        didRelay = true;
        const adj = g.adj[i];
        for (let a = 0; a < adj.length; a++) {
          const nb = adj[a];
          if (isSender(i, nb)) continue; // no rebound to anyone who pulsed us this turn
          sent.push(nb);
          if (nextCount[nb] === 0) nextTiles.push(nb);
          nextCount[nb]++;
          addSender(nb, i);
        }
      }
      if (acc > 0 || didRelay) wave.push({ tile: i, accepted: acc, arrived, relayed: didRelay, sent });
    }
    if (wave.length) waves.push(wave);
    curTiles = nextTiles;
    curCount = nextCount;
  }
  return waves;
}

/** Recompute charges by replaying a bee sequence in order. Skips a bee that can no longer be placed. */
export function stateFor(g: Grid, bees: number[]): Uint8Array {
  return replay(g, bees).r;
}

export interface Replay {
  r: Uint8Array;
  waves: number;
  /** true when every bee was placed on a not-yet-full flower that did not already hold a bee */
  legal: boolean;
  placed: number;
}

/** Replay bees in order. Stops at the first illegal placement (that bee is not placed). */
export function replay(g: Grid, bees: number[]): Replay {
  const r = newState(g);
  const used = new Uint8Array(g.w * g.h);
  let waves = 0;
  let placed = 0;
  for (const b of bees) {
    if (g.need[b] === 0 || used[b] || isFull(g, r, b)) return { r, waves, legal: false, placed };
    used[b] = 1;
    waves += placeBee(g, r, b).length;
    placed++;
  }
  return { r, waves, legal: true, placed };
}

/**
 * Same bee set, two fully legal orders, different charges.
 * Exhaustive over legal sequences of length 2..maxLen. Flower count must be <= 20.
 * Returns one diverging pair of sequences, or null if none is found within maxLen.
 */
export function findOrderSensitivity(g: Grid, maxLen: number): { a: number[]; b: number[] } | null {
  const flowers = g.flowers;
  const n = flowers.length;
  if (n < 2 || n > 26 || maxLen < 2) return null;
  const seen = new Map<number, { key: string; path: number[] }>();
  const path: number[] = [];
  let hit: { a: number[]; b: number[] } | null = null;

  const keyOf = (r: Uint8Array) => {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(r[flowers[i]] + 48);
    return s;
  };

  const rec = (r: Uint8Array, mask: number, depth: number) => {
    if (hit || depth === maxLen) return;
    for (let fi = 0; fi < n; fi++) {
      const bit = 1 << fi;
      if (mask & bit) continue;
      const t = flowers[fi];
      if (r[t] >= g.need[t]) continue;
      const r2 = r.slice();
      placeBee(g, r2, t);
      const mask2 = mask | bit;
      const key = keyOf(r2);
      path.push(t);
      const prev = seen.get(mask2);
      if (prev === undefined) seen.set(mask2, { key, path: path.slice() });
      else if (prev.key !== key) {
        hit = { a: prev.path.slice(), b: path.slice() };
        path.pop();
        return;
      }
      rec(r2, mask2, depth + 1);
      path.pop();
      if (hit) return;
    }
  };
  rec(newState(g), 0, 0);
  return hit;
}

/** Can the board still be completed with at most `max` extra bees? Returns the extra tiles in order, or null. */
export function findCompletion(g: Grid, r: Uint8Array, bees: number[], max: number): number[] | null {
  if (isWon(g, r)) return [];
  const used = new Uint8Array(g.w * g.h);
  for (const b of bees) used[b] = 1;
  const cand = g.flowers.filter((i) => !used[i]);
  const chosen: number[] = [];
  const dfs = (state: Uint8Array, k: number): boolean => {
    if (k === 0) return isWon(g, state);
    for (let c = 0; c < cand.length; c++) {
      const t = cand[c];
      if (used[t] || state[t] >= g.need[t]) continue;
      const r2 = state.slice();
      placeBee(g, r2, t);
      used[t] = 1;
      chosen.push(t);
      if (dfs(r2, k - 1)) return true;
      chosen.pop();
      used[t] = 0;
    }
    return false;
  };
  for (let k = 1; k <= max; k++) {
    chosen.length = 0;
    if (dfs(r, k)) return chosen.slice();
  }
  return null;
}

/** Brute-force minimum solution over ordered legal placements. */
export function solve(g: Grid, maxK = 8): SolvedInfo | null {
  const flowers = g.flowers;
  if (flowers.length === 0) return null;
  const chosen: number[] = [];
  const used = new Uint8Array(g.w * g.h);
  const cap = flowers.length;

  for (let k = 1; k <= maxK && k <= cap; k++) {
    let counted = 0;
    let maxWaves = 0;
    const all: number[][] = [];
    let nodes = 0;
    const rec = (r: Uint8Array, depth: number, waves: number): void => {
      if (++nodes > 8_000_000) throw new Error(`solver node cap on ${flowers.length} flowers at k=${k}`);
      if (depth === k) {
        if (isWon(g, r)) {
          counted++;
          if (waves > maxWaves) maxWaves = waves;
          if (all.length < 16) all.push(chosen.slice());
        }
        return;
      }
      for (let fi = 0; fi < flowers.length; fi++) {
        const t = flowers[fi];
        if (used[t] || r[t] >= g.need[t]) continue;
        const r2 = r.slice();
        const w = placeBee(g, r2, t);
        used[t] = 1;
        chosen.push(t);
        rec(r2, depth + 1, waves + w.length);
        chosen.pop();
        used[t] = 0;
      }
    };
    rec(newState(g), 0, 0);
    if (counted > 0) {
      return { par: k, solutions: counted, solution: all[0], maxWaves, all };
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
