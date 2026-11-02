import { readFileSync } from "node:fs";
import { parseGrid, solve } from "../src/engine";
const cands: Record<string, string[]> = JSON.parse(process.argv[2] ? readFileSync(process.argv[2], "utf8") : "{}");
for (const [name, rows] of Object.entries(cands)) {
  const g = parseGrid(rows);
  const t0 = Date.now();
  const s = solve(g, 6);
  console.log(name, s ? `par=${s.par} sols=${s.solutions} waves=${s.maxWaves} sol=${s.solution.map(i=>`(${i%g.w},${Math.floor(i/g.w)})`).join("")}` : "UNSOLVABLE", `${Date.now()-t0}ms`);
}
