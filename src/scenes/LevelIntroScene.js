import Phaser from 'phaser';
import { levelTimeSec, levelTarget } from '../levels.js';
import { onAnyTapKey } from '../tapKeyPrompt.js';
import { FONT_FAMILY } from '../textStyle.js';

/**
 * Brief intro for an upcoming level. Shows the level number, time limit,
 * cumulative score target, and how much they need to earn this round.
 * Player clicks "Start" or presses Enter to begin.
 */
export default class LevelIntroScene extends Phaser.Scene {
  constructor() {
    super('LevelIntroScene');
  }

  init(data) {
    this.level = data?.level ?? 1;
    this.startingScore = data?.score ?? 0;
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, 800, 600);

    const time = levelTimeSec(this.level);
    const target = levelTarget(this.level);
    const earnThisRound = Math.max(0, target - this.startingScore);

    // Big level number
    this.add.text(400, 130, `NIVEL ${this.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5);

    // Stat block
    const statColor = '#e8d9a8';
    const labelColor = '#8a7a55';
    const lineH = 36;
    const startY = 230;

    this.addStatRow(220, startY, 'TIEMPO LÍMITE', `${time}s`, labelColor, statColor);
    this.addStatRow(220, startY + lineH, 'PUNTAJE OBJETIVO', `$${target}`, labelColor, statColor);
    this.addStatRow(220, startY + lineH * 2, 'PUNTAJE ACTUAL', `$${this.startingScore}`, labelColor, statColor);
    this.addStatRow(220, startY + lineH * 3, 'TE FALTAN', `$${earnThisRound}`, labelColor, '#ffd93d');

    // Tap-keys prompt — pressing any tap key advances into the level.
    const prompt = this.add.text(400, 470, 'APRETÁ [1] [2] [3] o [4] PARA EMPEZAR', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#fff4d6',
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

    onAnyTapKey(this, () => this.beginLevel());
  }

  addStatRow(x, y, label, value, labelColor, valueColor) {
    this.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: labelColor,
    }).setOrigin(0, 0.5);
    this.add.text(580, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: valueColor,
      stroke: '#1a120a',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);
  }

  beginLevel() {
    this.scene.start('GameScene', {
      level: this.level,
      score: this.startingScore,
    });
  }
}
