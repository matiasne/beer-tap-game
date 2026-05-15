import Phaser from 'phaser';
import { onAnyTapKey } from '../tapKeyPrompt.js';

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
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, 800, 600);

    const headline = this.passed ? 'LEVEL CLEARED' : 'GAME OVER';
    const headlineColor = this.passed ? '#6acc4a' : '#ff4a2a';

    this.add.text(400, 150, headline, {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: headlineColor,
      stroke: '#1a120a',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5);

    this.add.text(400, 200, `Level ${this.level}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Stat block
    const labelColor = '#8a7a55';
    const valueColor = '#e8d9a8';
    const startY = 280;
    const lineH = 36;
    this.addStatRow(220, startY, 'YOUR SCORE', `$${Math.max(0, this.score)}`, labelColor, valueColor);
    this.addStatRow(220, startY + lineH, 'TARGET', `$${this.target}`, labelColor, valueColor);
    if (this.passed) {
      const surplus = this.score - this.target;
      this.addStatRow(220, startY + lineH * 2, 'OVER TARGET BY', `$${surplus}`, labelColor, '#ffd93d');
    } else {
      const deficit = this.target - this.score;
      this.addStatRow(220, startY + lineH * 2, 'MISSED BY', `$${deficit}`, labelColor, '#ff7a4a');
    }

    // Tap-keys prompt — pressing any tap key continues / returns to menu.
    const promptLabel = this.passed
      ? `PRESS [1] [2] [3] or [4] FOR LEVEL ${this.level + 1}`
      : 'PRESS [1] [2] [3] or [4] FOR MENU';
    const promptColor = this.passed ? '#cfe8a8' : '#fff4d6';
    const prompt = this.add.text(400, 480, promptLabel, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: promptColor,
      stroke: '#1a120a',
      strokeThickness: 4,
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

  addStatRow(x, y, label, value, labelColor, valueColor) {
    this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: labelColor,
    }).setOrigin(0, 0.5);
    this.add.text(580, y, value, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: valueColor,
      stroke: '#1a120a',
      strokeThickness: 3,
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
    this.scene.start('MenuScene');
  }
}
