import Phaser from 'phaser';
import { levelTimeSec, levelTarget } from '../levels.js';
import { onAnyTapKey } from '../tapKeyPrompt.js';
import { FONT_FAMILY } from '../textStyle.js';
import { getMode } from '../gameModes.js';

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
    this.modeId = data?.mode ?? 'classic';
    // Lives carry across levels in Survival. Only meaningful when the mode
    // sets livesOverride; otherwise it's just an ignored passthrough.
    this.lives = data?.lives ?? null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, W, H);

    const mode = getMode(this.modeId);
    const time = mode.timeOverrideSec ?? levelTimeSec(this.level);
    const target = levelTarget(this.level);
    const earnThisRound = Math.max(0, target - this.startingScore);

    // Big level number
    this.add.text(cx, Math.round(H * 0.18), `NIVEL ${this.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '80px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 8,
    }).setOrigin(0.5, 0.5);

    // Mode badge under the level number
    this.add.text(cx, Math.round(H * 0.27), mode.label, {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Stat block
    const statColor = '#e8d9a8';
    const labelColor = '#8a7a55';
    const lineH = 60;
    const startY = Math.round(H * 0.38);
    const labelX = Math.round(W * 0.32);
    const valueX = Math.round(W * 0.68);

    if (mode.livesOverride != null) {
      // Survival — no time limit; show lives + score.
      const livesNow = this.lives ?? mode.livesOverride;
      this.addStatRow(labelX, startY, valueX, 'VIDAS', `${livesNow}/${mode.livesOverride}`, labelColor, '#ff7a4a');
      this.addStatRow(labelX, startY + lineH, valueX, 'PUNTAJE ACUMULADO', `$${this.startingScore}`, labelColor, statColor);
    } else {
      // Classic / other modes — time + target-based stats
      this.addStatRow(labelX, startY, valueX, 'TIEMPO LÍMITE', `${time}s`, labelColor, statColor);
      this.addStatRow(labelX, startY + lineH, valueX, 'PUNTAJE OBJETIVO', `$${target}`, labelColor, statColor);
      this.addStatRow(labelX, startY + lineH * 2, valueX, 'PUNTAJE ACTUAL', `$${this.startingScore}`, labelColor, statColor);
      this.addStatRow(labelX, startY + lineH * 3, valueX, 'TE FALTAN', `$${earnThisRound}`, labelColor, '#ffd93d');
    }

    // Tap-keys prompt — pressing any tap key advances into the level.
    const prompt = this.add.text(cx, Math.round(H * 0.82), 'APRETÁ [1] [2] [3] o [4] PARA EMPEZAR', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: '#fff4d6',
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

    onAnyTapKey(this, () => this.beginLevel());
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

  beginLevel() {
    this.scene.start('GameScene', {
      level: this.level,
      score: this.startingScore,
      mode: this.modeId,
      lives: this.lives,
    });
  }
}
