# Bloom Bees — Design Doc (v0.7, working title)

**Pitch:** A calm, one-handed puzzle about chain reactions. Place a few bees; each one kicks off a wave of pollen that races across the field, blooming flowers that pass it on. Bloom the whole field within your bee limit.
**Platform:** iOS + Android, TypeScript + Phaser wrapped with Capacitor. Portrait, tap-only, ~30–90 s per level.

## Core rules (v1)
1. **Grid.** Tiles are flowers, empty tiles, or rocks. Empty/rock tiles hold no bee, accept no pulse, and block pulses. Neighbors = up/down/left/right only.
2. **Need.** Each flower needs 1, 2 (a *bud*), or later 3 pulses to bloom. Charge shows as petals opening (a bud with 1 pulse is half-open).
3. **Relay rule (once per turn, no rebound).** One turn is one bee and its whole cascade. A flower **relays on a turn if and only if** it receives at least one pulse that turn **and** it was not already fully bloomed at the start of the turn. The relay is **one** pulse, sent on the first wave it accepts pollen that turn, to each cardinal neighbor **except any neighbor that sent it a pulse earlier in this same turn**. If two neighbors pulsed it in the same wave, skip both. The bee's own tile has no sender, so it pulses every neighbor. Later pulses in that same turn still add charge and do **not** relay again. A bud left half-charged relays again on a later turn, the next time it receives a pulse. After it has bloomed, every later turn sees it full at the start, so it never relays again. Pulses into a flower that was full at the start of the turn are absorbed. Rocks and empty tiles block. A bud is never topped up by its own echo.
4. **Bee.** A bee's pulse counts as a received pulse on its own tile: it half-charges a bud *and* relays once, or blooms a 1-flower and relays once. A bee does not pulse neighbors directly, only through its tile's relay.
5. **One bee per tile** in v1. (A later **bee pair** power-up lets two bees share a bud.)
6. **Taps.** Tapping an already-bloomed flower is **blocked** (shake, no bee spent). Tapping your own bee picks it up. Undo is unlimited; reset is free.
7. **Resolution:** breadth-first **waves**. Wave 0 = the bee's pulse; wave k+1 = the single relays fired in wave k, arriving simultaneously. Animated wave by wave, slowly enough to read (about twice the first prototype's pace), with a **1× / 2× / 4×** speed toggle saved on the device. While a cascade is playing, taps, undo, reset, and hint are ignored so the wave finishes and undo stays exact. A new bee cascades from the *current* state, so earlier charges count.
8. **Win:** every flower bloomed with **at most N bees** (N = par + spare bees; see Bee limit & stars).

## Core loop
Study the field → find where one bee floods the most, and which tiles stall at half-charge → place → watch the chain → adjust with free undo → full bloom → stars + garden reward → next level (~1 min).

## Hook
Big, satisfying chain reactions: one tap and a wave of petals sweeps across the screen. The skill is spotting which tile triggers the longest chain and how buds and rocks stop or gate it.

## Depth analysis
- **No rebound.** The flower that just got pollen does not hand it back. Tiles `2 1`: a bee on the bud blooms the flower, and that flower does not pulse the bud. Both sit at one charge, so the bud is stuck until you undo. Bee the flower first (the bud goes to 1 and does not echo), then bee the bud. Two neighbors can still fill a 2-bud in one wave if they pulse it together; that is not an echo.
- **Order can matter.** **Par is the length of the shortest legal sequence**, not just the smallest set. Undo replays the remaining bees from a fresh field, which restores every charge exactly. Constructed example: `1 2 1 2`. Bees on the two buds are legal in either order and leave different charges.
- **Shipped levels.** Meadows of only 1-flowers (levels 1–4) are not order-sensitive. Levels 5, 6, 8, and 9 are not order-sensitive within their bee limits. **Orchard Maze (7) and Night Garden (10) are:** two legal orders of the same bees leave different charges.
- **Buds.** A 2-bud is not finished by the neighbor it just woke. A single file leaves the end bud half open (Half Open). A fork can hit a bud from two sides at once (First Buds). A 3-bud still gets no echo, so a corner of Big Buds leaves it at 2 and the next bee goes on the bud.
- **Real depth.** All-1 fields are "one bee per connected region" (a gentle tutorial). Skill: see which bud a single file cannot finish, which fork hits a bud twice in one wave, and where rocks cut the field. Greedy "biggest flood first" still fails when a bud stalls one short.
- **Solvability is not automatic:** a tile with need greater than 1 plus the pulses its neighbors can actually deliver can never bloom (an isolated bud cannot). The solver must prove each level has a solution.
- **Risk:** one bee can still flood an open meadow. **Firebreaks** are rocks, dead-end buds, and later walls/wilted flowers. Extra bees never un-bloom a flower. Spare bees above par stay the main difficulty dial.

## Progression (worlds; each teaches one idea, then mixes)
| World | Intro |
|---|---|
| 1 Meadow | 1-flowers + rocks/empty only; count the regions (3×3–5×5) |
| 2 Orchard | **Buds** with no rebound: (a) two neighbors can hit a bud in the same wave; (b) a single file leaves a bud half open, then you bee the bud; a bee on the bud first does not get an echo |
| 3 Hedgerow | **Walls** on tile edges block pulses between two tiles |
| 4 Greenhouse | **One-way vines**: carry a pulse in one direction across a gap or turn |
| 5 Night Garden | **3-pulse buds** (need 3; still one relay per turn, and no rebound) |
| 6 Thornpatch | **Wilted flowers**: absorb pulses, never pass them; only a bee revives it (then normal) |
| 7+ | Hex grid (6 neighbors); **bee pair** power-up (two bees may share a bud); same rules |
No text-heavy tutorials: teach with near-forced levels. Dropped: wind, overshoot-wilting.

## Level design rules
- **Solvability is NOT automatic** (an isolated bud can never bloom). The solver must prove each level has a solution.
- **Par = the solver's true minimum bees.** **Bee limit = par + spare bees**, where spare bees shrink as the player advances (see below). Players must win within the limit.
- **Solver:** simulate by BFS waves (bee pulse = +1 arrival on its tile, with no sender; each flower relays at most once that turn and skips anyone who already pulsed it). Brute-force over **ordered** legal placements of length k = 1, 2, ... until the field blooms (skip tiles that are full or already hold a bee). Par is that minimum k. Count winning sequences and the longest chain (wave count). Runs at build time and powers hints, which follow a stored order or search onward from the current charges.
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
Wave-by-wave petal ripple, slow enough to read one wave at a time by default (about 2× the first build); a visible **Speed** button cycles **1× / 2× / 4×** and remembers the choice. **Chain combo counter**; **rising pitch per wave**; light haptic per wave, strong on full bloom; half-charged buds visibly "shiver"; screen-wide bloom on win; "biggest chain" shown at level end. Input waits out the cascade.

## Retention
- **Daily Bloom:** one seeded puzzle/day (same for all), streak, no penalty for missing.
- **Stars:** by bees used (see Bee limit & stars), minus one if you used a hint; replaying loose early levels for 3★ is a built-in goal.
- **Garden collection:** each level adds a plant/bee/character piece; sets per world (room for CosplAI art); seasonal events.

## Monetization (fair)
Rewarded ads for hints (never forced); optional one-time remove-ads IAP; cosmetic garden packs; **no energy or timers**, no mid-level interstitials.

## Open questions for AiVyn
1. **Bounce-back:** resolved 2026-11-02, then tightened the same day. No rebound: a flower does not pulse any neighbor that sent it pollen earlier in the turn. A bud is not topped up by its own echo.
2. **Tapping your own bee picks it up** (besides Undo). OK, or Undo-only?
3. **Hint cost floor:** a win never drops below 1★ even with a hint. OK?
4. **Tile art / names:** are "buds" (2-pulse) and "flowers" (1-pulse) the right words, or call all "flowers" with a number?
