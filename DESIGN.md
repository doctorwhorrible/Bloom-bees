# Bloom Bees — Design Doc (v0.5, working title)

**Pitch:** A calm, one-handed puzzle about chain reactions. Place a few bees; each one kicks off a wave of pollen that races across the field, blooming flowers that pass it on. Bloom the whole field within your bee limit.
**Platform:** iOS + Android, TypeScript + Phaser wrapped with Capacitor. Portrait, tap-only, ~30–90 s per level.

## Core rules (v1)
1. **Grid.** Tiles are flowers, empty tiles, or rocks. Empty/rock tiles hold no bee, accept no pulse, and block pulses. Neighbors = up/down/left/right only.
2. **Need.** Each flower needs 1, 2 (a *bud*), or later 3 pulses to bloom. Charge shows as petals opening (a bud with 1 pulse is half-open).
3. **Relay rule.** Every time a flower **accepts** a pulse (it isn't full yet), it relays **1 pulse to each cardinal neighbor**. A 1-flower relays once; a 2-bud relays twice (on half-charge and on bloom); a 3-bud three times. **Total relays from a tile = min(pulses received, need).** A pulse reaching a full flower is absorbed (no relay). Pulses may bounce back toward the tile that sent them.
4. **Bee.** A bee's pulse counts as a received pulse on its own tile: it half-charges a bud *and* relays, or blooms a 1-flower and relays. A bee does not pulse neighbors directly, only through its tile's relay.
5. **One bee per tile** in v1. (A later **bee pair** power-up lets two bees share a bud.)
6. **Taps.** Tapping an already-bloomed flower is **blocked** (shake, no bee spent). Tapping your own bee picks it up. Undo is unlimited; reset is free.
7. **Resolution:** breadth-first **waves**. Wave 0 = the bee's pulse; wave k+1 = relays accepted in wave k, arriving simultaneously. Animated wave by wave. A new bee cascades from the *current* state, so earlier charges count.
8. **Win:** every flower bloomed with **at most N bees** (N = par + spare bees; see Bee limit & stars).

## Core loop
Study the field → find where one bee floods the most, and which tiles stall at half-charge → place → watch the chain → adjust with free undo → full bloom → stars + garden reward → next level (~1 min).

## Hook
Big, satisfying chain reactions: one tap and a wave of petals sweeps across the screen. The skill is spotting which tile triggers the longest chain and how buds and rocks stop or gate it.

## Depth analysis
- **Order-independent (verified by reasoning).** Let r(i) = pulses tile i accepted (= its relays), b(i) = 1 if it has a bee, else 0. Then r(i) = min(need(i), b(i) + sum of r(j) over flower neighbors j). The right side is monotone and bounded, so the process converges to the **least fixed point**, regardless of placement order, wave order, or whether bees go in one at a time or together. A solution is a **set** of tiles; undo-safe, no sequencing.
- **Higher-need flowers are amplifiers.** A bud relays twice, a 3-bud thrice. Neighboring buds bounce pulses back and forth until full, so one bee can flood a whole connected cluster of buds. 1-flowers are weak relays: a bud fed only by a 1-flower dead end stalls at half-charge (needs its own bee or a second feeder).
- **Real depth.** It is bootstrap percolation with weighted thresholds, a hard class. All-1 fields are just "one bee per connected region" (a gentle tutorial). Skill: read which tiles amplify, which dead-ends stall, and where rocks cut the field. Greedy "biggest flood first" often fails because of stalls.
- **Solvability is not automatic:** a tile with need > 1 + (flower neighbors) can never bloom (e.g., an isolated bud). The solver must prove each level has a solution.
- **Risk:** one bee can flood open areas. **Firebreaks** are rocks, dead-end geometry, and later walls/wilted flowers. Monotone = more bees never hurts, so spare bees above par are the main difficulty dial.

## Progression (worlds; each teaches one idea, then mixes)
| World | Intro |
|---|---|
| 1 Meadow | 1-flowers + rocks/empty only; count the regions (3×3–5×5) |
| 2 Orchard | **Buds**, taught in steps: (a) a bud *cluster* floods from one bee (amplifier bounce); (b) a **dead-end bud** stalls half-charged (shiver + ring); (c) a bee on the bud itself completes it. |
| 3 Hedgerow | **Walls** on tile edges block pulses between two tiles |
| 4 Greenhouse | **One-way vines**: carry a pulse in one direction across a gap or turn |
| 5 Night Garden | **3-pulse buds** (relay three times: strong amplifiers) |
| 6 Thornpatch | **Wilted flowers**: absorb pulses, never pass them; only a bee revives it (then normal) |
| 7+ | Hex grid (6 neighbors); **bee pair** power-up (two bees may share a bud); same rules |
No text-heavy tutorials: teach with near-forced levels. Dropped: wind, overshoot-wilting.

## Level design rules
- **Solvability is NOT automatic** (an isolated bud can never bloom). The solver must prove each level has a solution.
- **Par = the solver's true minimum bees.** **Bee limit = par + spare bees**, where spare bees shrink as the player advances (see below). Players must win within the limit.
- **Solver:** simulate by BFS waves (bee pulse = +1 arrival on its tile); brute-force/DFS over bee sets of size k = 1, 2, ... until the field blooms (fine for ≤ ~6×6 and par ≤ 5), with pruning later (one bee per all-1 region, skip tiles already full). Count min solutions (uniqueness) and the longest chain (wave count). Runs at build time and powers hints.
- **Generator:** random fields with rocks + buds → reject unsolvable (isolated buds) → solver → keep levels with a tight par (min bees ≪ flower count), a long chain, and ≥ 1 decoy (a tempting big-flood tile not in the optimum). Campaign wants unique/near-unique solutions; Daily may be looser.
- **Firebreak rule:** no level where one bee blooms >70% of the field unless it's a tutorial.
- **Hints:** reveal one tile of a shortest completion of the current board. **Using a hint costs one star** (never below 1★ on a win).
- **Mechanic intros live in valleys:** a level that introduces a mechanic must be low-difficulty and near-forced, with generous spare bees, never a peak.

## Bee limit & stars
- **Limit = par + spare.** Spare bees (draft): **World 1 +3, World 2 +2, World 3 +1 for most levels, later worlds mostly +0/+1**, par exactly on capstones. Draft, to be tuned in playtesting.
- **Stars (by bees used):** ★★★ = par · ★★ = par+1 · ★ = any win within the limit. Using a hint costs one star (a win is never below 1★). Undos never cost stars. Where limit = par, any win is ★★★ (minus hint).
- Result: learners can win sloppily and replay for stars; experts get tight puzzles later.

## Difficulty curve ("rolling hills")
Not steadily harder. Each world has **its own hill shape** (different number/height of peaks), drifting up overall. Rules:
- **Dips and valleys:** after a hard peak, follow with 1–2 easy breather levels (big win-feel, often a flashy chain).
- **New mechanics debut in a valley** (an easy, near-forced level), get practiced on the climb, and are tested at the next peak.
- **Loose early, tighter later:** spare bees shrink as the game goes on, so the same puzzle size gets harder over time.
- Each world ends on a capstone peak, then the next world opens in a valley.
- Metrics for placing a level: par, field size, solution count, search nodes, optimum chain length, decoys, spare bees. World 1 target: at least 80 percent clear within 3 resets.

Sketch of one world (difficulty 1-8, 20 levels; new mechanics at valleys L2, L7, L12, L17; breathers after peaks at L10, L15, L19):
```
8 |                                                       #    
7 |                                           #           #    
6 |                            #           #  #           #    
5 |                         #  #           #  #        #  #    
4 |             #        #  #  #        #  #  #  #     #  #    
3 |          #  #  #     #  #  #  #     #  #  #  #     #  #  # 
2 | #     #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  # 
1 | #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  # 
  +------------------------------------------------------------
    1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 
```

## Juice
Wave-by-wave petal ripple; **chain combo counter** (flowers bloomed this chain); **rising pitch per wave**; light haptic per wave, strong on full bloom; half-charged buds visibly "shiver"; screen-wide bloom on win; "biggest chain" shown at level end.

## Retention
- **Daily Bloom:** one seeded puzzle/day (same for all), streak, no penalty for missing.
- **Stars:** by bees used (see Bee limit & stars), minus one if you used a hint; replaying loose early levels for 3★ is a built-in goal.
- **Garden collection:** each level adds a plant/bee/character piece; sets per world (room for CosplAI art); seasonal events.

## Monetization (fair)
Rewarded ads for hints (never forced); optional one-time remove-ads IAP; cosmetic garden packs; **no energy or timers**, no mid-level interstitials.

## Open questions for AiVyn
1. **Bounce-back:** pulses may return to the tile that sent them, so neighboring buds ping-pong until full and one bee can flood a whole bud cluster. Intended? (It makes buds amplifiers and 1-flowers weak links. A "no immediate return" rule would be the alternative.)
2. **Tapping your own bee picks it up** (besides Undo). OK, or Undo-only?
3. **Hint cost floor:** a win never drops below 1★ even with a hint. OK?
4. **Tile art / names:** are "buds" (2-pulse) and "flowers" (1-pulse) the right words, or call all "flowers" with a number?
