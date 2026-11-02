const KEY = "bloombees.stars.v1";
function load(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function getStars(id: number): number { return load()[id] ?? 0; }
export function saveStars(id: number, stars: number) {
  const d = load();
  if ((d[id] ?? 0) < stars) { d[id] = stars; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }
}
export function clearStars() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

const SPEED_KEY = "bloombees.speed.v1";
export type WaveSpeed = 1 | 2 | 4;
/** 1× is the slow default (about twice the original wave pace). */
export function getWaveSpeed(): WaveSpeed {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY));
    if (n === 2 || n === 4) return n;
  } catch { /* ignore */ }
  return 1;
}
export function saveWaveSpeed(v: WaveSpeed) {
  try { localStorage.setItem(SPEED_KEY, String(v)); } catch { /* ignore */ }
}
