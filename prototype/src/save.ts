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
