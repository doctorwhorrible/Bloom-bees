import Phaser from "phaser";
import { COL, H, SCALE, W, addSpecks, beeTexture, dotTexture, makeButton, petalColor, ringTexture, starTexture, tileTexture, txt, type Btn } from "../art";
import { findCompletion, isFull, isWon, parseGrid, placeBee, stateFor, starsFor, type Grid, type Wave } from "../engine";
import { LEVELS, type LevelMeta } from "../levels";
import { getStars, saveStars } from "../save";
import { beepBlocked, beepPlace, beepUndo, beepWave, beepWin, unlockAudio } from "../sfx";
import info from "../levels.generated.json";

interface LevelInfo { par: number; solutions: number; solution: number[]; all: number[][]; }

const GRID_TOP = 560;
const GRID_BOTTOM = 1235;
const GRID_W = 640;

export class GameScene extends Phaser.Scene {
  private level!: LevelMeta;
  private g!: Grid;
  private par = 1;
  private limit = 1;
  private allSolutions: number[][] = [];

  private bees: number[] = [];
  private r!: Uint8Array; // true state
  private shown!: Uint8Array; // displayed state (lags during wave animation)
  private animating = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  private won = false;
  private hintUsed = false;
  private hintTile = -1;
  private chain = 0;

  private tileSize = 100;
  private ox = 0;
  private oy = 0;
  private tileG: Phaser.GameObjects.Image[] = [];
  private beeG = new Map<number, Phaser.GameObjects.Image>();
  private hintRing?: Phaser.GameObjects.Graphics;
  private beeText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private starLine!: Phaser.GameObjects.Text;
  private undoBtn!: Btn;
  private hintBtn!: Btn;
  private overlay: Phaser.GameObjects.GameObject[] = [];

  constructor() { super("Game"); }

  init(data: { id?: number }) {
    this.level = LEVELS.find((l) => l.id === (data.id ?? 1)) ?? LEVELS[0];
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(SCALE).centerOn(W / 2, H / 2);
    cam.setBackgroundColor(COL.bg);
    this.input.once("pointerdown", () => unlockAudio());
    // reset per-run state (scene objects are recreated on restart, fields are not)
    this.bees = []; this.animating = false; this.timers = []; this.won = false; this.hintUsed = false; this.hintTile = -1; this.chain = 0;
    this.tileG = []; this.beeG = new Map(); this.overlay = [];

    const L = this.level;
    this.g = parseGrid(L.rows);
    const li = (info as unknown as Record<string, LevelInfo>)[String(L.id)];
    this.par = li.par;
    this.limit = li.par + L.spare;
    this.allSolutions = li.all;
    this.r = new Uint8Array(this.g.w * this.g.h);
    this.shown = new Uint8Array(this.g.w * this.g.h);

    // background specks
    addSpecks(this, 28);

    // --- HUD ---
    makeButton(this, 112, 84, 180, 84, "◀ Levels", () => this.scene.start("Menu"), 28);
    txt(this, 440, 84, `${L.id} · ${L.name}`, 38);
    const note = txt(this, W / 2, 205, L.note, 29, COL.soft, false);
    note.setWordWrapWidth(640).setLineSpacing(4);
    this.starLine = txt(this, W / 2, 308, "", 29);
    this.updateStarLine();
    this.beeText = txt(this, W / 2, 440, "", 34);
    this.drawTray();
    this.comboText = txt(this, W / 2, 505, "", 46, "#c0561f");
    this.comboText.setAlpha(0);

    // --- grid ---
    const g = this.g;
    this.tileSize = Math.min(Math.floor(GRID_W / g.w), Math.floor((GRID_BOTTOM - GRID_TOP) / g.h), 150);
    this.ox = W / 2 - (g.w * this.tileSize) / 2 + this.tileSize / 2;
    this.oy = (GRID_TOP + GRID_BOTTOM) / 2 - (g.h * this.tileSize) / 2 + this.tileSize / 2;
    for (let i = 0; i < g.w * g.h; i++) {
      const p = this.tilePos(i);
      if (g.need[i] === 0 && !g.rock[i]) { this.tileG.push(undefined as unknown as Phaser.GameObjects.Image); continue; }
      const tg = this.add.image(p.x, p.y, tileTexture(this, this.tileSize, g.need[i], 0, !!g.rock[i])).setScale(1 / SCALE);
      this.tileG.push(tg);
      this.redrawTile(i);
    }
    this.hintRing = this.add.graphics().setDepth(5);

    // --- bottom buttons ---
    this.msgText = txt(this, W / 2, 1300, "", 29, COL.soft, false);
    this.msgText.setWordWrapWidth(660);
    this.undoBtn = makeButton(this, 135, 1420, 205, 104, "Undo", () => this.undo(), 38);
    makeButton(this, 360, 1420, 205, 104, "Reset", () => this.reset(), 38);
    this.hintBtn = makeButton(this, 585, 1420, 205, 104, "Hint −★", () => this.hint(), 38, 0xffe9a8);
    this.undoBtn.setEnabled(false);

    // taps on the grid
    this.input.on("pointerdown", (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length > 0) return;
      const t = this.tileAt(p.worldX, p.worldY);
      if (t >= 0) this.tap(t);
    });
    this.updateHud();
    this.say(this.bees.length === 0 ? "Tap a flower to place a bee." : "");
  }

  // ---------- geometry ----------
  private tilePos(i: number) {
    const x = i % this.g.w, y = Math.floor(i / this.g.w);
    return { x: this.ox + x * this.tileSize, y: this.oy + y * this.tileSize };
  }
  private tileAt(wx: number, wy: number): number {
    const x = Math.floor((wx - (this.ox - this.tileSize / 2)) / this.tileSize);
    const y = Math.floor((wy - (this.oy - this.tileSize / 2)) / this.tileSize);
    if (x < 0 || y < 0 || x >= this.g.w || y >= this.g.h) return -1;
    return y * this.g.w + x;
  }

  // ---------- drawing ----------
  private redrawTile(i: number) {
    const tg = this.tileG[i];
    if (!tg) return;
    tg.setTexture(tileTexture(this, this.tileSize, this.g.need[i], this.shown[i], !!this.g.rock[i]));
  }

  private drawTray() {
    const n = this.limit;
    const size = Math.min(62, 560 / n);
    const total = n * size * 1.05;
    for (let i = 0; i < n; i++) {
      const x = W / 2 - total / 2 + (i + 0.5) * size * 1.05;
      const left = i >= this.bees.length;
      const bg = this.add.circle(x, 398, size * 0.52, 0xffffff, left ? 0.55 : 0.25);
      const bee = this.add.image(x, 398, beeTexture(this, size * 0.9, !left)).setScale(1 / SCALE);
      this.trayIcons.push(bg, bee);
    }
    this.beeText.setText(`Bees: ${this.bees.length} / ${this.limit}`);
  }
  private trayIcons: Phaser.GameObjects.GameObject[] = [];

  private updateStarLine() {
    const par = this.par;
    const hint = this.hintUsed ? "   (hint: −1★)" : "";
    this.starLine.setText(`★★★ ${par}   ★★ ${par + 1}   ★ ${this.limit}${hint}`);
    this.starLine.setColor(this.hintUsed ? "#c0561f" : COL.inkCss);
  }

  private updateHud() {
    // clear old tray icons then redraw
    this.trayIcons.forEach((o) => o.destroy());
    this.trayIcons = [];
    this.drawTray();
    this.updateStarLine();
    this.undoBtn.setEnabled(this.bees.length > 0 && !this.won);
    this.hintBtn.setEnabled(!this.won);
  }

  private say(s: string) { this.msgText.setText(s); }

  private placeBeeSprite(i: number, animate: boolean) {
    const p = this.tilePos(i);
    const s = this.tileSize;
    const bg = this.add.image(p.x + s * 0.24, p.y - s * 0.24, beeTexture(this, s * 0.62)).setDepth(3);
    const base = 1 / SCALE;
    bg.setScale(base);
    this.beeG.set(i, bg);
    if (animate) {
      bg.setScale(base * 0.2).setAlpha(0);
      this.tweens.add({ targets: bg, scale: base, alpha: 1, duration: 220, ease: "Back.easeOut", onComplete: () => this.bob(bg, i) });
    } else this.bob(bg, i);
  }
  private bob(bg: Phaser.GameObjects.Image, i: number) {
    this.tweens.add({ targets: bg, y: bg.y - 5, duration: 500 + (i % 5) * 60, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private clearBeeSprites() {
    this.beeG.forEach((b) => { this.tweens.killTweensOf(b); b.destroy(); });
    this.beeG.clear();
  }

  // ---------- input ----------
  private tap(t: number) {
    if (this.won) return;
    this.cancelAnim(true);
    const g = this.g;
    if (g.need[t] === 0) {
      if (g.rock[t]) { this.shake(t); this.say("Rocks block pollen. Bees can't land here."); beepBlocked(); }
      return;
    }
    if (this.bees.includes(t)) { // pick up own bee
      this.bees = this.bees.filter((b) => b !== t);
      this.recompute();
      beepUndo();
      this.say("Bee picked up.");
      this.updateHud();
      return;
    }
    if (isFull(g, this.r, t)) {
      this.shake(t);
      beepBlocked();
      this.say("Already in bloom. Pick a flower that still needs pollen.");
      return;
    }
    if (this.bees.length >= this.limit) {
      beepBlocked();
      this.say("No bees left! Undo or reset to try a different plan.");
      this.tweens.add({ targets: this.beeText, scale: 1.2, yoyo: true, duration: 120, repeat: 1 });
      return;
    }
    this.clearHint();
    this.bees.push(t);
    beepPlace();
    this.placeBeeSprite(t, true);
    const waves = placeBee(g, this.r, t);
    this.say("");
    this.updateHud();
    this.playWaves(waves);
  }

  private shake(t: number) {
    const tg = this.tileG[t];
    if (!tg) return;
    const x = tg.x;
    this.tweens.add({ targets: tg, x: x + 10, duration: 50, yoyo: true, repeat: 3, onComplete: () => { tg.x = x; } });
  }

  private undo() {
    if (this.won || this.bees.length === 0) return;
    this.cancelAnim(true);
    this.bees.pop();
    this.recompute();
    beepUndo();
    this.say("Undid last bee.");
    this.updateHud();
  }

  private reset() {
    if (this.won) return;
    this.cancelAnim(true);
    this.bees = [];
    this.recompute();
    beepUndo();
    this.say("Field reset. Bees back in the hive!");
    this.updateHud();
  }

  /** Rebuild the true+shown state from the bee list (order independent) and redraw instantly. */
  private recompute() {
    this.clearHint();
    this.r = stateFor(this.g, this.bees);
    this.shown = this.r.slice();
    for (let i = 0; i < this.tileG.length; i++) this.redrawTile(i);
    this.clearBeeSprites();
    for (const b of this.bees) this.placeBeeSprite(b, false);
    this.chain = 0;
    this.comboText.setAlpha(0);
  }

  // ---------- hint ----------
  private clearHint() { this.hintTile = -1; this.hintRing?.clear(); if (this.hintTween) { this.hintTween.stop(); this.hintTween = undefined; } }
  private hintTween?: Phaser.Tweens.Tween;

  private hint() {
    if (this.won) return;
    this.cancelAnim(true);
    const have = new Set(this.bees);
    let tile = -1;
    // 1) a stored minimum solution that contains all current bees
    for (const sol of this.allSolutions) {
      if (this.bees.every((b) => sol.includes(b))) { tile = sol.find((t) => !have.has(t)) ?? -1; if (tile >= 0) break; }
    }
    // 2) otherwise search a completion of the current board within the remaining bees
    if (tile < 0) {
      const remaining = Math.min(this.limit - this.bees.length, 5);
      if (remaining > 0) {
        const comp = findCompletion(this.g, this.r, this.bees, remaining);
        if (comp && comp.length) tile = comp[0];
      }
    }
    if (tile < 0) {
      this.say("These bees can't finish the field. Try Undo (no hint used).");
      beepBlocked();
      return;
    }
    this.hintUsed = true;
    this.hintTile = tile;
    this.updateStarLine();
    this.say("Hint: try the glowing flower. (Hints cost 1★.)");
    const p = this.tilePos(tile);
    const ring = this.hintRing!;
    ring.clear();
    ring.setPosition(p.x, p.y).setScale(1).setAlpha(1);
    ring.lineStyle(10, 0xff9f1c, 1).strokeRoundedRect(-this.tileSize * 0.48, -this.tileSize * 0.48, this.tileSize * 0.96, this.tileSize * 0.96, this.tileSize * 0.18);
    this.hintTween = this.tweens.add({ targets: ring, alpha: 0.25, scale: 1.08, duration: 520, yoyo: true, repeat: -1 });
  }

  // ---------- wave animation ----------
  private playWaves(waves: Wave[]) {
    this.animating = true;
    this.chain = 0;
    const step = Phaser.Math.Clamp(Math.floor(3000 / Math.max(1, waves.length)), 150, 340);
    waves.forEach((wave, k) => {
      const ev = this.time.delayedCall(k * step + 10, () => this.applyWave(wave, k, step));
      this.timers.push(ev);
    });
    const end = this.time.delayedCall(waves.length * step + 260, () => this.finishAnim());
    this.timers.push(end);
  }

  private applyWave(wave: Wave, k: number, step: number) {
    let accepted = 0;
    for (const e of wave) {
      this.shown[e.tile] += e.accepted;
      accepted += e.accepted;
      this.redrawTile(e.tile);
      const tg = this.tileG[e.tile];
      this.tweens.killTweensOf(tg);
      tg.setScale(1 / SCALE);
      this.tweens.add({ targets: tg, scale: 1.16 / SCALE, duration: 90, yoyo: true, ease: "Quad.easeOut" });
      this.ring(e.tile, this.g.need[e.tile], this.shown[e.tile] >= this.g.need[e.tile]);
      // pulses travelling to neighbours (arrive next wave)
      for (const nb of this.g.adj[e.tile]) this.dot(e.tile, nb, step);
    }
    this.chain += accepted;
    beepWave(k);
    this.comboText.setText(`Chain ×${this.chain}`).setAlpha(1).setScale(1);
    this.tweens.add({ targets: this.comboText, scale: 1.18, duration: 90, yoyo: true });
  }

  private ring(i: number, need: number, bloomed: boolean) {
    const p = this.tilePos(i);
    const key = ringTexture(this, bloomed ? petalColor(need) : COL.gold, bloomed ? 12 : 8);
    const base = (this.tileSize * 0.3) / 64;
    const g = this.add.image(p.x, p.y, key).setDepth(2).setScale(base);
    this.tweens.add({ targets: g, scale: base * (bloomed ? 3.4 : 2.4), alpha: 0, duration: 420, ease: "Quad.easeOut", onComplete: () => g.destroy() });
  }

  private dot(from: number, to: number, step: number) {
    const a = this.tilePos(from), b = this.tilePos(to);
    const d = this.add.image(a.x, a.y, dotTexture(this)).setDepth(4).setScale((this.tileSize * 0.2) / 44);
    this.tweens.add({ targets: d, x: b.x, y: b.y, alpha: 0.4, duration: Math.max(100, step - 20), ease: "Sine.easeInOut", onComplete: () => d.destroy() });
  }

  private cancelAnim(snap: boolean) {
    if (!this.animating) return;
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    this.animating = false;
    if (snap) {
      this.shown = this.r.slice();
      for (let i = 0; i < this.tileG.length; i++) { this.redrawTile(i); this.tileG[i]?.setScale(1 / SCALE); }
      this.comboText.setAlpha(0);
    }
  }

  private finishAnim() {
    this.timers = [];
    this.animating = false;
    this.shown = this.r.slice();
    for (let i = 0; i < this.tileG.length; i++) this.tileG[i] && this.redrawTile(i);
    if (isWon(this.g, this.r)) {
      this.winLevel();
      return;
    }
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 900, duration: 400 });
    if (this.bees.length >= this.limit) this.say("Out of bees, but some flowers are still closed. Undo or reset.");
    else {
      const left = this.limit - this.bees.length;
      this.say(`${left} bee${left === 1 ? "" : "s"} left. Closed flowers need more pollen.`);
    }
  }

  // ---------- win ----------
  private winLevel() {
    this.won = true;
    this.clearHint();
    this.updateHud();
    const stars = starsFor(this.bees.length, this.par, this.limit, this.hintUsed);
    saveStars(this.level.id, stars);
    beepWin();
    const best = getStars(this.level.id);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.overlay.push(o); (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20); return o; };

    // confetti petals
    for (let i = 0; i < 36; i++) {
      const c = this.add.graphics().setDepth(19);
      c.fillStyle([0xff8fb1, 0xb48cf0, 0xff9f43, 0xffd23f, 0x7fd36a][i % 5], 1).fillCircle(0, 0, Phaser.Math.Between(7, 13));
      c.setPosition(Phaser.Math.Between(40, W - 40), -40 - Phaser.Math.Between(0, 400));
      this.tweens.add({ targets: c, y: H + 60, x: c.x + Phaser.Math.Between(-90, 90), duration: Phaser.Math.Between(1800, 3200), delay: Phaser.Math.Between(0, 900), onComplete: () => c.destroy() });
    }

    this.time.delayedCall(650, () => {
      const dim = add(this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a1f, 0.55)) as Phaser.GameObjects.Rectangle;
      dim.setInteractive(); // swallow taps behind the panel
      const panel = add(this.add.graphics()) as Phaser.GameObjects.Graphics;
      const pw = 600, ph = 640, px = W / 2 - pw / 2, py = 420;
      panel.fillStyle(0x000000, 0.15).fillRoundedRect(px + 4, py + 10, pw, ph, 44);
      panel.fillStyle(0xfffbe8, 1).fillRoundedRect(px, py, pw, ph, 44);
      panel.lineStyle(6, COL.buttonEdge, 1).strokeRoundedRect(px, py, pw, ph, 44);
      add(txt(this, W / 2, py + 80, "Full Bloom!", 68));
      for (let i = 0; i < 3; i++) {
        const x = W / 2 + (i - 1) * 150;
        add(this.add.image(x, py + 215, starTexture(this, false)).setScale(1 / SCALE * 1.0));
        if (i < stars) {
          const star = add(this.add.image(x, py + 215, starTexture(this, true))) as Phaser.GameObjects.Image;
          star.setScale(0.1).setAlpha(0).setDepth(21);
          this.tweens.add({ targets: star, scale: 1 / SCALE, alpha: 1, duration: 380, delay: 250 + i * 260, ease: "Back.easeOut" });
        }
      }
      const used = this.bees.length;
      let line = `Used ${used} bee${used === 1 ? "" : "s"} · par ${this.par}`;
      add(txt(this, W / 2, py + 340, line, 36));
      let sub = used <= this.par ? "Perfect, that's par!" : used <= this.par + 1 ? "One over par. Try for 3★?" : "Try fewer bees for more stars.";
      if (this.hintUsed) sub += "  Hint used: −1★";
      const subT = add(txt(this, W / 2, py + 395, sub, 28, COL.soft, false)) as Phaser.GameObjects.Text;
      subT.setWordWrapWidth(540);
      add(txt(this, W / 2, py + 450, `Best: ${"★".repeat(best)}${"☆".repeat(3 - best)}`, 32));
      const idx = LEVELS.findIndex((l) => l.id === this.level.id);
      const next = LEVELS[idx + 1];
      const row = py + 550;
      add(makeButton(this, W / 2 - 190, row, 170, 96, "Levels", () => this.scene.start("Menu"), 32));
      add(makeButton(this, W / 2, row, 170, 96, "Replay", () => this.scene.restart({ id: this.level.id }), 32));
      if (next) add(makeButton(this, W / 2 + 190, row, 170, 96, "Next ▶", () => this.scene.start("Game", { id: next.id }), 32, 0xffe9a8));
      else add(makeButton(this, W / 2 + 190, row, 170, 96, "Done", () => this.scene.start("Menu"), 32, 0xffe9a8));
    });
  }
}
