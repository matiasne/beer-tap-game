import Phaser from 'phaser';
import { onAnyTapKey } from '../tapKeyPrompt.js';
import { FONT_FAMILY } from '../textStyle.js';

const ATTRACT_IDLE_MS = 15000;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.idleMs = 0;
    // Backdrop — same warm dark tone as the bar.
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, 800, 600);

    // A thin amber strip near the top — atmospheric, suggests the bar.
    bg.fillStyle(0x3a2a1a, 1);
    bg.fillRect(0, 110, 800, 60);
    bg.fillStyle(0x4a3724, 1);
    bg.fillRect(0, 112, 800, 4);
    bg.fillStyle(0x2a1f14, 1);
    bg.fillRect(0, 166, 800, 4);

    // Title
    this.add.text(400, 230, 'SERVIDA PERFECTA', {
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5);

    // Subtitle
    this.add.text(400, 285, 'serví la cerveza justa, como la piden, rápido', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Big tap-keys prompt — replaces the start button.
    this.promptText = this.add.text(400, 400, 'APRETÁ [1] [2] [3] o [4] PARA EMPEZAR', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#fff4d6',
      stroke: '#1a120a',
      strokeThickness: 4,
    });
    this.promptText.setOrigin(0.5, 0.5);

    // Subtle pulse so it reads as interactive.
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.55 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Footer instructions
    this.add.text(400, 560, 'mantené 1 / 2 / 3 / 4 para servir de cada canilla', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: '#6a5a3d',
    }).setOrigin(0.5, 1);

    onAnyTapKey(this, () => this.startGame());
  }

  update(_time, delta) {
    this.idleMs += delta;
    if (this.idleMs >= ATTRACT_IDLE_MS) {
      this.scene.start('ScoreboardScene', { attract: true });
    }
  }

  startGame() {
    this.scene.start('LevelIntroScene', { level: 1, score: 0 });
  }
}
