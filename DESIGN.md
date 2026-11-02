# Bloom Bees — Design Doc (v0.6, working title)

**Pitch:** A calm, one-handed puzzle about chain reactions. Place a few bees; each one kicks off a wave of pollen that races across the field, blooming flowers that pass it on. Bloom the whole field within your bee limit.
**Platform:** iOS + Android, TypeScript + Phaser wrapped with Capacitor. Portrait, tap-only, ~30–90 s per level.

## Core rules (v1)
1. **Grid.** Tiles are flowers, empty tiles, or rocks. Empty/rock tiles hold no bee, accept no pulse, and block pulses. Neighbors = up/down/left/right only.
2. **Need.** Each flower needs 1, 2 (a *bud*), or later 3 pulses to bloom. Charge shows as petals opening (a bud with 1 pulse is half-open).
3. **Relay rule (once per turn).** One turn is one bee and its whole cascade. A flower **relays on a turn if and only if** it receives at least one pulse that turn **and** it was not already fully bloomed at the start of the turn. The relay is **one** pulse to each cardinal neighbor, sent on the first wave it accepts pollen that turn. Later pulses in that same turn still add charge and do **not** relay again. A 2-bud hit twice in one turn blooms, but it relayed only once. A bud left half-charged relays again on a later turn, the next time it receives a pulse. After it has bloomed, every later turn sees it full at the start, so it never relays again. Pulses into a flower that was full at the start of the turn are absorbed. Rocks and empty tiles block.
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
- **Order can matter.** A flower spends at most one relay per turn, so the same bees in a different order can leave different charges. A bud that takes two pulses in one turn blooms and never emits the second relay a slower order would have used. **Par is the length of the shortest legal sequence**, not just the smallest set. Undo replays the remaining bees from a fresh field, which restores every charge exactly. Constructed example: three tiles `2 3 2`. Bees on the left bud, then the middle, bloom the row; the reverse order leaves the right bud one short. Both orders are legal.
- **Shipped prototype levels are not order-sensitive.** For all 10 levels, every fully legal order of every bee set the player can place (up to that level's bee limit) ends at the same charges. Meadows of only 1-flowers are order-independent by the rule: a 1-flower blooms on its first pulse and relays exactly once, ever. Order is real, and it just does not show up in these ten fields.
- **Buds are not ping-pong amplifiers.** Two adjacent buds do not fill each other from one bee (they end full and half-open). A single return still happens: the neighbor relays once, back into the sender, in the same turn. A 2-bud with one flower neighbor finishes if the bee starts on the bud (bee pulse + that flower's return) and stalls at half-charge if the bee starts on the flower. A **ring** of 2-buds can still bloom from one bee, because each bud is fed by two neighbors' single relays (First Buds). A 3-bud needs three pulses of charge and still relays at most once per turn.
- **Real depth.** All-1 fields are "one bee per connected region" (a gentle tutorial). Skill: see which bud is a dead end, which ring or stem actually closes, and where rocks cut the field. Greedy "biggest flood first" still fails when a bud stalls one short.
- **Solvability is not automatic:** a tile with need greater than 1 plus the pulses its neighbors can actually deliver can never bloom (an isolated bud cannot). The solver must prove each level has a solution.
- **Risk:** one bee can still flood an open meadow. **Firebreaks** are rocks, dead-end buds, and later walls/wilted flowers. Extra bees never un-bloom a flower. Spare bees above par stay the main difficulty dial.

## Progression (worlds; each teaches one idea, then mixes)
| World | Intro |
|---|---|
| 1 Meadow | 1-flowers + rocks/empty only; count the regions (3×3–5×5) |
| 2 Orchard | **Buds**, taught in steps: (a) a ring of buds can still open from one bee, each relaying once; (b) a **dead-end bud** stalls half-charged; (c) a bee on the bud itself, plus one return from a neighbor, completes it. |
| 3 Hedgerow | **Walls** on tile edges block pulses between two tiles |
| 4 Greenhouse | **One-way vines**: carry a pulse in one direction across a gap or turn |
| 5 Night Garden | **3-pulse buds** (need 3 charges; still relay at most once per turn) |
| 6 Thornpatch | **Wilted flowers**: absorb pulses, never pass them; only a bee revives it (then normal) |
| 7+ | Hex grid (6 neighbors); **bee pair** power-up (two bees may share a bud); same rules |
No text-heavy tutorials: teach with near-forced levels. Dropped: wind, overshoot-wilting.

## Level design rules
- **Solvability is NOT automatic** (an isolated bud can never bloom). The solver must prove each level has a solution.
- **Par = the solver's true minimum bees.** **Bee limit = par + spare bees**, where spare bees shrink as the player advances (see below). Players must win within the limit.
- **Solver:** simulate by BFS waves (bee pulse = +1 arrival on its tile; each flower relays at most once that turn). Brute-force over **ordered** legal placements of length k = 1, 2, ... until the field blooms (skip tiles that are full or already hold a bee). Par is that minimum k. Count winning sequences and the longest chain (wave count). Runs at build time and powers hints, which follow a stored order or search onward from the current charges.
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
1. **Bounce-back:** resolved 2026-11-02. Repeated bud ping-pong is out (one relay per turn). A neighbor still sends a single return pulse in that same turn. See the relay rule.
2. **Tapping your own bee picks it up** (besides Undo). OK, or Undo-only?
3. **Hint cost floor:** a win never drops below 1★ even with a hint. OK?
4. **Tile art / names:** are "buds" (2-pulse) and "flowers" (1-pulse) the right words, or call all "flowers" with a number?
