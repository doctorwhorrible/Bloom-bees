import { parseGrid, solve } from "../src/engine";
let seed = +(process.argv[2] ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const W = +(process.argv[3] ?? 5), H = +(process.argv[4] ?? 5);
const mix = (process.argv[5] ?? "1:5,2:3,#:2,.:1").split(",").map((s) => s.split(":"));
const pick = () => { const tot = mix.reduce((a, [, w]) => a + +w, 0); let x = rnd() * tot; for (const [c, w] of mix) { x -= +w; if (x < 0) return c; } return "1"; };
const N = +(process.argv[6] ?? 3000);
const seen = new Set<string>();
const out: any[] = [];
for (let n = 0; n < N; n++) {
  const rows: string[] = [];
  for (let y = 0; y < H; y++) { let r = ""; for (let x = 0; x < W; x++) r += pick(); rows.push(r); }
  const key = rows.join("/"); if (seen.has(key)) continue; seen.add(key);
  const g = parseGrid(rows);
  if (g.flowers.length < 7) continue;
  const s = solve(g, 5);
  if (!s) continue;
  out.push({ rows, par: s.par, sols: s.solutions, waves: s.maxWaves, f: g.flowers.length });
}
out.sort((a, b) => a.sols - b.sols || b.par - a.par);
for (const o of out.filter((o) => o.par >= 2).slice(0, 8)) console.log(`par=${o.par} sols=${o.sols} waves=${o.waves} flowers=${o.f}\n  ${o.rows.join("\n  ")}`);
console.log("total solvable", out.length);
