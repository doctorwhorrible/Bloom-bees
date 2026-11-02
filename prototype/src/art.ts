import Phaser from "phaser";

export const W = 720; // logical design size (portrait). Rendered at 1.5x for crispness.
export const H = 1560;
// Render scale: backing pixels per design pixel, chosen from the screen so phones are crisp
// without over-rendering. Override with ?scale=1.5 for testing.
function pickScale(): number {
  const q = new URLSearchParams(location.search).get("scale");
  if (q && +q > 0) return Math.min(3, +q);
  const cssW = Math.min(window.innerWidth, (window.innerHeight * W) / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return Math.min(2, Math.max(0.75, (cssW * dpr) / W));
}
export const SCALE = pickScale();
export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const COL = {
  bg: 0xcfeab8,
  bgDark: 0xb7dc9d,
  tile: 0xeaf6d8,
  tileEdge: 0xa9cf8c,
  ink: 0x3b3a2e,
  inkCss: "#3b3a2e",
  soft: "#6b7a55",
  rock: 0x8f8f98,
  rockDark: 0x6e6e78,
  bee: 0xffd23f,
  beeDark: 0x2c2a1f,
  gold: 0xffc83d,
  pulse: 0xfff2a8,
  button: 0xfff7d6,
  buttonEdge: 0xd9b84a,
};
const PETAL: Record<number, number> = { 1: 0xff8fb1, 2: 0xb48cf0, 3: 0xff9f43 };
const PETAL_DARK: Record<number, number> = { 1: 0xe9628d, 2: 0x8d62d6, 3: 0xe8771a };
export const petalColor = (need: number) => PETAL[need] ?? 0xff8fb1;

export function drawTileBase(g: Phaser.GameObjects.Graphics, size: number) {
  const s = size * 0.94;
  g.fillStyle(0x000000, 0.08).fillRoundedRect(-s / 2 + 3, -s / 2 + 6, s, s, s * 0.18);
  g.fillStyle(COL.tile, 1).fillRoundedRect(-s / 2, -s / 2, s, s, s * 0.18);
  g.lineStyle(3, COL.tileEdge, 1).strokeRoundedRect(-s / 2, -s / 2, s, s, s * 0.18);
}

export function drawRock(g: Phaser.GameObjects.Graphics, size: number) {
  const s = size;
  g.fillStyle(0x000000, 0.12).fillEllipse(0, s * 0.26, s * 0.62, s * 0.18);
  g.fillStyle(COL.rockDark, 1).fillCircle(-s * 0.14, s * 0.08, s * 0.2).fillCircle(s * 0.16, s * 0.1, s * 0.22);
  g.fillStyle(COL.rock, 1).fillCircle(-s * 0.1, 0, s * 0.24).fillCircle(s * 0.12, s * 0.02, s * 0.24).fillCircle(0, -s * 0.08, s * 0.22);
  g.fillStyle(0xffffff, 0.25).fillCircle(-s * 0.12, -s * 0.12, s * 0.07);
}

/** Flower/bud art. `r` = pulses received, `need` = pulses needed. p = r/need drives how open it is. */
export function drawFlower(g: Phaser.GameObjects.Graphics, size: number, need: number, r: number) {
  const p = Math.min(1, r / need);
  const col = PETAL[need] ?? PETAL[1];
  const dark = PETAL_DARK[need] ?? PETAL_DARK[1];
  const s = size;
  // stem + leaves
  g.fillStyle(0x6fbf5a, 1).fillEllipse(-s * 0.2, s * 0.16, s * 0.2, s * 0.09).fillEllipse(s * 0.2, s * 0.16, s * 0.2, s * 0.09);
  if (p === 0) {
    // closed bud
    g.fillStyle(dark, 1).fillCircle(0, -s * 0.02, s * 0.2);
    g.fillStyle(col, 1).fillCircle(0, -s * 0.05, s * 0.17);
    g.fillStyle(0x6fbf5a, 1).fillTriangle(-s * 0.13, s * 0.06, s * 0.13, s * 0.06, 0, s * 0.2);
  } else {
    const open = 0.45 + 0.55 * p; // 1 pulse of 2 -> 0.725
    const n = 6;
    const dist = s * 0.17 * open;
    const pr = s * (0.1 + 0.07 * open);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(dark, 1).fillCircle(Math.cos(a) * dist, Math.sin(a) * dist + 2, pr);
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(col, 1).fillCircle(Math.cos(a) * dist, Math.sin(a) * dist, pr);
    }
    g.fillStyle(p >= 1 ? 0xffd23f : 0xf2e7a0, 1).fillCircle(0, 0, s * (0.07 + 0.04 * p));
    if (p >= 1) g.fillStyle(0xffffff, 0.45).fillCircle(-s * 0.02, -s * 0.03, s * 0.025);
  }
  // pips: need dots, filled for received pulses
  const pw = s * 0.11;
  const total = need;
  for (let i = 0; i < total; i++) {
    const x = (i - (total - 1) / 2) * pw;
    g.fillStyle(i < r ? dark : 0xffffff, 1).fillCircle(x, s * 0.34, s * 0.035);
    g.lineStyle(2, dark, 0.7).strokeCircle(x, s * 0.34, s * 0.035);
  }
}

export function drawBee(g: Phaser.GameObjects.Graphics, size: number, faded = false) {
  const a = faded ? 0.28 : 1;
  const s = size;
  g.fillStyle(0xffffff, 0.85 * a).fillEllipse(-s * 0.12, -s * 0.26, s * 0.26, s * 0.36);
  g.fillStyle(0xffffff, 0.85 * a).fillEllipse(s * 0.1, -s * 0.28, s * 0.24, s * 0.34);
  g.lineStyle(2, 0x9bb7c9, a).strokeEllipse(-s * 0.12, -s * 0.26, s * 0.26, s * 0.36).strokeEllipse(s * 0.1, -s * 0.28, s * 0.24, s * 0.34);
  const bw = s * 0.6, bh = s * 0.42;
  g.fillStyle(COL.bee, a).fillEllipse(0, 0, bw, bh);
  for (const x of [-s * 0.08, s * 0.1]) {
    const hh = bh * Math.sqrt(Math.max(0, 1 - Math.pow(x / (bw / 2), 2))) * 0.96;
    g.fillStyle(COL.beeDark, a).fillRect(x - s * 0.035, -hh / 2, s * 0.07, hh);
  }
  g.lineStyle(2.5, COL.beeDark, a).strokeEllipse(0, 0, bw, bh);
  g.fillStyle(COL.beeDark, a).fillCircle(-s * 0.2, -s * 0.03, s * 0.04);
  g.fillStyle(0xff9ab0, a * 0.8).fillCircle(-s * 0.15, s * 0.05, s * 0.035);
}

export function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, outer: number, filled: boolean) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : outer * 0.46;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad));
  }
  g.fillStyle(filled ? COL.gold : 0xd8dccb, 1).fillPoints(pts, true);
  g.lineStyle(4, filled ? 0xd99a1a : 0xb9bfa8, 1).strokePoints(pts, true);
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color = COL.inkCss, bold = true): Phaser.GameObjects.Text {
  return scene
    .add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal", align: "center", resolution: SCALE })
    .setOrigin(0.5);
}

export interface Btn extends Phaser.GameObjects.Container {
  label: Phaser.GameObjects.Text;
  setEnabled(v: boolean): void;
}

export function makeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onTap: () => void, size = 36, fill: number = COL.button): Btn {
  const c = scene.add.container(x, y) as Btn;
  const bg = scene.add.graphics();
  const draw = (down: boolean, on = true) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.12).fillRoundedRect(-w / 2 + 2, -h / 2 + (down ? 3 : 7), w, h, 28);
    bg.fillStyle(on ? fill : 0xe3e6d8, 1).fillRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h, 28);
    bg.lineStyle(4, on ? COL.buttonEdge : 0xc2c8b2, 1).strokeRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h, 28);
  };
  draw(false);
  const t = txt(scene, 0, 0, label, size);
  c.add([bg, t]);
  c.label = t;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  c.on("pointerdown", () => { if (enabled) { draw(true); t.y = 4; } });
  c.on("pointerout", () => { draw(false, enabled); t.y = 0; });
  c.on("pointerup", () => { draw(false, enabled); t.y = 0; if (enabled) onTap(); });
  c.setEnabled = (v: boolean) => { enabled = v; draw(false, v); t.setAlpha(v ? 1 : 0.45); };
  return c;
}

// ---------- cached textures (Graphics are re-tessellated every frame in WebGL; textures are cheap) ----------
function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.translateCanvas(w / 2, h / 2);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

/** Tile texture (base + rock or flower in state r/need). Baked at SCALE x; use image.setScale(1/SCALE). */
export function tileTexture(scene: Phaser.Scene, size: number, need: number, r: number, rock: boolean): string {
  const px = Math.round(size * SCALE);
  const key = rock ? `rock-${px}` : `fl-${px}-${need}-${r}`;
  const dim = px + 24;
  return bake(scene, key, dim, dim, (g) => {
    drawTileBase(g, px);
    if (rock) drawRock(g, px);
    else drawFlower(g, px, need, r);
  });
}

export function beeTexture(scene: Phaser.Scene, size: number, faded = false): string {
  const px = Math.round(size * SCALE);
  const key = `bee-${px}${faded ? "-f" : ""}`;
  const dim = Math.round(px * 1.25);
  return bake(scene, key, dim, dim, (g) => drawBee(g, px, faded));
}

export function ringTexture(scene: Phaser.Scene, color: number, thick: number): string {
  const key = `ring-${color}-${thick}`;
  return bake(scene, key, 160, 160, (g) => { g.lineStyle(thick, color, 1).strokeCircle(0, 0, 64); });
}

export function dotTexture(scene: Phaser.Scene): string {
  return bake(scene, "dot", 64, 64, (g) => { g.fillStyle(0xfff2a8, 1).fillCircle(0, 0, 22).lineStyle(5, 0xe0a100, 1).strokeCircle(0, 0, 22); });
}

export function starTexture(scene: Phaser.Scene, filled: boolean): string {
  return bake(scene, filled ? "star-on" : "star-off", 220, 220, (g) => drawStar(g, 0, 0, 93, filled));
}

export function speckTexture(scene: Phaser.Scene): string {
  return bake(scene, "speck", 72, 72, (g) => { g.fillStyle(0xffffff, 1).fillCircle(0, 0, 32); });
}

export function addSpecks(scene: Phaser.Scene, n: number) {
  const key = speckTexture(scene);
  for (let i = 0; i < n; i++) {
    const r = Phaser.Math.Between(6, 24);
    scene.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), key).setTint(COL.bgDark).setAlpha(0.3).setScale(r / 32).setDepth(-10);
  }
}
