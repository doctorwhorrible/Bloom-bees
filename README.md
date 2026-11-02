# Bloom Bees (working title)
Casual mobile puzzle game for App Store + Google Play, by Dr AiVyn Kabacinski.

Phase 1: Concept (done) · see `DESIGN.md` (v0.5) and `DECISIONS.md`
Phase 2: Playable prototype (in progress) · `prototype/` (TypeScript + Phaser 3 + Vite; Capacitor wrapper later)
Phase 3: Iteration
Phase 4: Release prep

## Prototype

Portrait, tap-only web prototype of the v0.5 rules. 10 solver-verified levels (3 worlds, rolling-hills curve).

### Run / build
```bash
cd prototype
npm install
npm run dev          # dev server with hot reload (http://localhost:5173, also on your LAN with --host)
npm run build        # runs the solver/verify step, type-checks, then builds ./dist
npm run serve        # serves ./dist on http://0.0.0.0:4173 (no dependencies)
npm run preview      # vite's own preview server of ./dist (port 4173)
```
Open the served URL on a phone on the same Wi-Fi: `http://<computer-LAN-IP>:4173`.
Add to Home Screen on iOS/Android for a full-screen feel.

### Solver / verification
`npm run verify` (also part of `npm run build`) runs `tools/verify.ts`:
- brute-force solver over ordered bee placements computes **par** (minimum bees) and the winning sequences for every level;
- rule unit checks (once-per-turn relay, no bud ping-pong, rocks, isolated bud unsolvable, an order-sensitive example);
- an order-sensitivity report for each level (whether two legal orders of the same bees leave different charges);
- writes `src/levels.generated.json` (par, one ordered solution, and whether the level is order-sensitive) used by the game for stars and hints.

Level layouts live in `src/levels.ts` (`.` empty, `#` rock, `1`/`2`/`3` = pulses needed). Add a level there, run `npm run verify`, and it appears in the menu.
`tools/uitest.mjs` is a headless smoke test of the built game (win/stars/blocked tap/pickup/undo/hint; slow, software GL).
`tools/gen.ts` is a random field generator for finding candidate levels (`npx tsx tools/gen.ts <seed> <w> <h> "1:4,2:3,#:2,.:1" <tries>`).

### Rules implemented (see DESIGN.md)
- A flower relays one pulse to each cardinal neighbor at most once per bee (once per turn), and only if it was not already in bloom when that bee was placed. Later pulses that turn still add charge. Pulses into a flower that started the turn in bloom are absorbed. A bee = one received pulse on its own tile. Rocks/empty block. Order can matter; it does not in the ten shipped levels.
- Waves resolve breadth-first; animated wave by wave with a chain counter and rising pitch.
- One bee per tile; tapping a bloomed flower is blocked (no bee spent); tapping your own bee picks it up; undo/reset are free.
- Limit = par + spare (World 1 +3, World 2 +2, World 3 +1). Stars: ≤ par 3★, par+1 2★, within limit 1★; a hint costs 1★ (never below 1★).
- Hint: highlights a tile from a shortest solution that fits your current bees (or a search of the remaining bees).

### Recording a demo (headless Chrome)
`node tools/record.mjs <url> <levelId> <outDir> [wrongTile]` steps the game with Playwright's fake clock (smooth frames even with slow software rendering). Frames are stitched with ffmpeg; output in `media/`.

### Not in the prototype yet
Walls, one-way vines, wilted flowers, hex grid, bee pair power-up, Daily Bloom, garden collection, monetization, Capacitor wrapper, real art, settings/mute button.
