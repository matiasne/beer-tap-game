import Phaser from 'phaser';
import { FONT_FAMILY } from '../textStyle.js';
import { getAll } from '../scoreboard.js';
import { onAnyTapKey } from '../tapKeyPrompt.js';

/**
 * Top-N high score table. Two entry modes:
 *
 *   fromRun=true  → just finished a qualifying run; the new row glows
 *                  (highlightRank). Any tap key returns to menu.
 *   attract=true → menu's idle attract loop. Auto-returns to menu after
 *                  ATTRACT_HOLD_MS, or immediately on any tap key.
 *   neither      → from menu directly (currently unused, but harmless).
 */
const ATTRACT_HOLD_MS = 10000;

export default class ScoreboardScene extends Phaser.Scene {
  constructor() {
    super('ScoreboardScene');
  }

  init(data) {
    this.highlightRank = data?.highlightRank ?? -1;
    this.fromRun = !!data?.fromRun;
    this.attract = !!data?.attract;
    this.holdMs = ATTRACT_HOLD_MS;
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, 800, 600);

    // Header strip (matches the menu)
    bg.fillStyle(0x3a2a1a, 1);
    bg.fillRect(0, 60, 800, 50);
    bg.fillStyle(0x4a3724, 1);
    bg.fillRect(0, 62, 800, 4);
    bg.fillStyle(0x2a1f14, 1);
    bg.fillRect(0, 106, 800, 4);

    this.add.text(400, 85, 'HIGH SCORES', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5);

    // Column headers
    const headerY = 145;
    const cols = {
      rank: 110,
      name: 200,
      score: 460,
      level: 580,
      date: 720,
    };
    this.drawHeaderCell('#', cols.rank, headerY, 0.5);
    this.drawHeaderCell('NAME', cols.name, headerY, 0);
    this.drawHeaderCell('SCORE', cols.score, headerY, 1);
    this.drawHeaderCell('LEVEL', cols.level, headerY, 1);
    this.drawHeaderCell('DATE', cols.date, headerY, 1);

    // Divider
    const div = this.add.graphics();
    div.fillStyle(0x4a3724, 1);
    div.fillRect(80, 165, 640, 2);

    // Rows
    const entries = getAll();
    const rowStartY = 185;
    const rowH = 30;

    if (entries.length === 0) {
      this.add.text(400, 330, 'No scores yet — be the first!', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#8a7a55',
      }).setOrigin(0.5, 0.5);
    } else {
      entries.forEach((entry, i) => {
        const y = rowStartY + i * rowH;
        const isHi = i === this.highlightRank;
        const baseColor = isHi ? '#ffd93d' : '#e8d9a8';

        if (isHi) {
          const glow = this.add.graphics();
          glow.fillStyle(0xffd93d, 0.12);
          glow.fillRoundedRect(80, y - rowH / 2, 640, rowH, 4);
          glow.lineStyle(1, 0xffd93d, 0.6);
          glow.strokeRoundedRect(80, y - rowH / 2, 640, rowH, 4);
          // Subtle pulse on the glow
          this.tweens.add({
            targets: glow,
            alpha: { from: 1, to: 0.5 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
          });
        }

        this.drawRowCell(`${i + 1}`, cols.rank, y, 0.5, baseColor);
        this.drawRowCell(entry.name, cols.name, y, 0, baseColor);
        this.drawRowCell(`$${entry.score}`, cols.score, y, 1, baseColor);
        this.drawRowCell(`${entry.level}`, cols.level, y, 1, baseColor);
        this.drawRowCell(formatDate(entry.date), cols.date, y, 1, baseColor);
      });
    }

    // Footer prompt
    const promptText = this.attract
      ? 'press [1] [2] [3] or [4] to play'
      : 'press [1] [2] [3] or [4] to continue';
    this.prompt = this.add.text(400, 555, promptText.toUpperCase(), {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#fff4d6',
      stroke: '#1a120a',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 1, to: 0.55 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    onAnyTapKey(this, () => this.exit(/* userTriggered */ true));
  }

  drawHeaderCell(text, x, y, originX) {
    this.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#8a7a55',
    }).setOrigin(originX, 0.5);
  }

  drawRowCell(text, x, y, originX, color) {
    this.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color,
    }).setOrigin(originX, 0.5);
  }

  update(_time, delta) {
    if (!this.attract) return;
    this.holdMs -= delta;
    if (this.holdMs <= 0) this.exit(/* userTriggered */ false);
  }

  exit(userTriggered) {
    if (this.attract && !userTriggered) {
      // Attract auto-return: back to menu, which will re-arm its own idle timer.
      this.scene.start('MenuScene');
      return;
    }
    if (this.attract && userTriggered) {
      // User interrupted attract — go straight to the level intro to play.
      this.scene.start('LevelIntroScene', { level: 1, score: 0 });
      return;
    }
    // Standard exit (came from a finished run or direct view).
    this.scene.start('MenuScene');
  }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  } catch {
    return '--';
  }
}
