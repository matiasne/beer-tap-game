import Phaser from 'phaser';
import { onAnyTapKey } from '../tapKeyPrompt.js';
import { FONT_FAMILY } from '../textStyle.js';
import { qualifies } from '../scoreboard.js';

/**
 * Post-level screen.
 *
 * passed=true  → "LEVEL CLEARED" with [Continue] (goes to LevelIntroScene N+1).
 * passed=false → "GAME OVER"     with [Back to Menu] (restart from level 1).
 */
export default class LevelResultScene extends Phaser.Scene {
  constructor() {
    super('LevelResultScene');
  }

  init(data) {
    this.level = data?.level ?? 1;
    this.score = data?.score ?? 0;
    this.target = data?.target ?? 0;
    this.passed = !!data?.passed;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, W, H);

    const headline = this.passed ? 'NIVEL SUPERADO' : 'FIN DEL JUEGO';
    const headlineColor = this.passed ? '#6acc4a' : '#ff4a2a';

    this.add.text(cx, Math.round(H * 0.18), headline, {
      fontFamily: FONT_FAMILY,
      fontSize: '88px',
      color: headlineColor,
      stroke: '#1a120a',
      strokeThickness: 8,
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, Math.round(H * 0.28), `Nivel ${this.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Stat block
    const labelColor = '#8a7a55';
    const valueColor = '#e8d9a8';
    const startY = Math.round(H * 0.45);
    const lineH = 60;
    const labelX = Math.round(W * 0.32);
    const valueX = Math.round(W * 0.68);
    this.addStatRow(labelX, startY, valueX, 'TU PUNTAJE', `$${Math.max(0, this.score)}`, labelColor, valueColor);
    this.addStatRow(labelX, startY + lineH, valueX, 'OBJETIVO', `$${this.target}`, labelColor, valueColor);
    if (this.passed) {
      const surplus = this.score - this.target;
      this.addStatRow(labelX, startY + lineH * 2, valueX, 'TE SOBRARON', `$${surplus}`, labelColor, '#ffd93d');
    } else {
      const deficit = this.target - this.score;
      this.addStatRow(labelX, startY + lineH * 2, valueX, 'TE FALTARON', `$${deficit}`, labelColor, '#ff7a4a');
    }

    // Tap-keys prompt — pressing any tap key continues / returns to menu.
    const promptLabel = this.passed
      ? `APRETÁ [1] [2] [3] o [4] PARA EL NIVEL ${this.level + 1}`
      : 'APRETÁ [1] [2] [3] o [4] PARA EL MENÚ';
    const promptColor = this.passed ? '#cfe8a8' : '#fff4d6';
    const prompt = this.add.text(cx, Math.round(H * 0.84), promptLabel, {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      color: promptColor,
      stroke: '#1a120a',
      strokeThickness: 5,
    });
    prompt.setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.55 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    onAnyTapKey(this, () => this.advance());
  }

  addStatRow(labelX, y, valueX, label, value, labelColor, valueColor) {
    this.add.text(labelX, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      color: labelColor,
    }).setOrigin(0, 0.5);
    this.add.text(valueX, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: valueColor,
      stroke: '#1a120a',
      strokeThickness: 4,
    }).setOrigin(1, 0.5);
  }

  advance() {
    if (this.passed) this.continueNext();
    else this.backToMenu();
  }

  continueNext() {
    this.scene.start('LevelIntroScene', {
      level: this.level + 1,
      score: this.score, // keep the cumulative score
    });
  }

  backToMenu() {
    // Game over: if the cumulative score earns a slot, capture a name first.
    if (qualifies(this.score)) {
      this.scene.start('NameEntryScene', {
        score: this.score,
        level: this.level,
      });
      return;
    }
    this.scene.start('MenuScene');
  }
}
