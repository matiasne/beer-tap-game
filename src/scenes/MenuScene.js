import Phaser from 'phaser';
import { onAnyTapKey } from '../tapKeyPrompt.js';
import { FONT_FAMILY } from '../textStyle.js';
import { gameModesEnabled, DEFAULT_MODE_ID } from '../gameModes.js';

const ATTRACT_IDLE_MS = 15000;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.idleMs = 0;
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    // Backdrop — same warm dark tone as the bar.
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, W, H);

    // A thin amber strip near the top — atmospheric, suggests the bar.
    const stripY = Math.round(H * 0.18);
    bg.fillStyle(0x3a2a1a, 1);
    bg.fillRect(0, stripY, W, 60);
    bg.fillStyle(0x4a3724, 1);
    bg.fillRect(0, stripY + 2, W, 4);
    bg.fillStyle(0x2a1f14, 1);
    bg.fillRect(0, stripY + 56, W, 4);

    // Title
    this.add.text(cx, Math.round(H * 0.38), 'SERVIDA PERFECTA', {
      fontFamily: FONT_FAMILY,
      fontSize: '80px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 8,
    }).setOrigin(0.5, 0.5);

    // Subtitle
    this.add.text(cx, Math.round(H * 0.48), 'serví la cerveza justa, como la piden, rápido', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Big tap-keys prompt — replaces the start button.
    this.promptText = this.add.text(cx, Math.round(H * 0.66), 'APRETÁ [1] [2] [3] o [4] PARA EMPEZAR', {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      color: '#fff4d6',
      stroke: '#1a120a',
      strokeThickness: 5,
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
    this.add.text(cx, H - 30, 'mantené 1 / 2 / 3 / 4 para servir de cada canilla', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
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
    if (gameModesEnabled()) {
      this.scene.start('GameModeScene');
    } else {
      // Modes disabled via VITE_GAME_MODES_ENABLED=false — skip selection
      // and start the classic flow directly.
      this.scene.start('LevelIntroScene', {
        level: 1,
        score: 0,
        mode: DEFAULT_MODE_ID,
      });
    }
  }
}
