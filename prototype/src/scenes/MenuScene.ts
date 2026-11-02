import Phaser from "phaser";
import { COL, FONT, H, SCALE, W, addSpecks, beeTexture, makeButton, starTexture, txt } from "../art";
import { LEVELS, WORLD_NAMES } from "../levels";
import { clearStars, getStars } from "../save";
import { unlockAudio } from "../sfx";
import info from "../levels.generated.json";

export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(SCALE).centerOn(W / 2, H / 2);
    cam.setBackgroundColor(COL.bg);
    this.input.once("pointerdown", () => unlockAudio());

    addSpecks(this, 40);

    const bee = this.add.image(W / 2, 150, beeTexture(this, 150)).setScale(1 / SCALE);
    this.tweens.add({ targets: bee, y: 170, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    txt(this, W / 2, 290, "Bloom Bees", 84);
    txt(this, W / 2, 360, "prototype · pollen chain-reaction puzzle", 28, COL.soft, false);

    const cardW = 320, cardH = 128, gx = 28, gy = 20;
    let y = 430;
    let lastWorld = 0;
    let col = 0;
    LEVELS.forEach((L) => {
      if (L.world !== lastWorld) {
        if (col !== 0) { y += cardH + gy; col = 0; }
        lastWorld = L.world;
        txt(this, W / 2, y + 22, WORLD_NAMES[L.world], 32, COL.soft);
        y += 62;
      }
      const x = W / 2 + (col === 0 ? -(cardW + gx) / 2 : (cardW + gx) / 2);
      const stars = getStars(L.id);
      const par = (info as any)[L.id].par as number;
      const c = makeButton(this, x, y + cardH / 2, cardW, cardH, "", () => this.scene.start("Game", { id: L.id }), 30);
      const num = txt(this, -cardW / 2 + 48, -8, String(L.id), 48);
      const nm = txt(this, 28, -22, L.name, 28);
      const sub = txt(this, 28, 18, `par ${par} · ${par + L.spare} bees`, 24, COL.soft, false);
      c.add([num, nm, sub]);
      for (let i = 0; i < 3; i++) c.add(this.add.image(14 + i * 36, 46, starTexture(this, i < stars)).setScale(15 / 93));
      col++;
      if (col === 2) { col = 0; y += cardH + gy; }
    });
    if (col !== 0) y += cardH + gy;

    makeButton(this, W / 2, Math.min(H - 150, y + 60), 360, 84, "Reset progress", () => { clearStars(); this.scene.restart(); }, 28, 0xf3e6c8);
    txt(this, W / 2, H - 70, "Tap a flower to place a bee · free undo & reset", 26, COL.soft, false);
    void FONT;
  }
}
