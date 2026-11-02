import Phaser from "phaser";
import { H, SCALE, W } from "./art";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#cfeab8",
  width: W * SCALE,
  height: H * SCALE,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  render: { antialias: true, roundPixels: false },
  scene: [MenuScene, GameScene],
});
(window as unknown as { __game: Phaser.Game }).__game = game; // debug/test hook
