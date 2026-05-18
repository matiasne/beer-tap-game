import Phaser from 'phaser';
import { FONT_FAMILY } from '../textStyle.js';
import { GAME_MODES } from '../gameModes.js';

/**
 * Mode-selection screen between MenuScene and LevelIntroScene. The player
 * presses 1, 2, 3, or 4 to pick one of the four game modes. Each mode
 * shows as a "card" arranged in a horizontal row, matching the visual
 * vocabulary of the 4 in-game tap stations.
 *
 * Started by MenuScene; starts LevelIntroScene with `{ level: 1, score: 0, mode }`.
 */
export default class GameModeScene extends Phaser.Scene {
  constructor() {
    super('GameModeScene');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Backdrop
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, W, H);
    // Thin amber strip across the top — matches the bar visual on the menu.
    const stripY = Math.round(H * 0.16);
    bg.fillStyle(0x3a2a1a, 1);
    bg.fillRect(0, stripY, W, 60);
    bg.fillStyle(0x4a3724, 1);
    bg.fillRect(0, stripY + 2, W, 4);
    bg.fillStyle(0x2a1f14, 1);
    bg.fillRect(0, stripY + 56, W, 4);

    // Heading
    this.add.text(cx, Math.round(H * 0.32), 'ELEGÍ TU JUEGO', {
      fontFamily: FONT_FAMILY,
      fontSize: '72px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 8,
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, Math.round(H * 0.40), 'apretá [1] [2] [3] o [4] para empezar', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // ---- Mode cards: 4 columns spread across the canvas ----
    // Card layout — same horizontal pitch as the in-game taps so it feels
    // like picking one of the bar's 4 stations.
    const cardW = 380;
    const cardH = 360;
    const cardY = Math.round(H * 0.52);
    const totalW = GAME_MODES.length * cardW + (GAME_MODES.length - 1) * 40;
    const startX = cx - totalW / 2;

    GAME_MODES.forEach((mode, i) => {
      const x = startX + i * (cardW + 40);
      this.drawCard(x, cardY, cardW, cardH, mode, i + 1);
    });

    // Per-key handlers — each tap key picks a specific mode and starts.
    const KEYS = ['ONE', 'TWO', 'THREE', 'FOUR'];
    let fired = false;
    KEYS.forEach((keyName, i) => {
      const mode = GAME_MODES[i];
      if (!mode) return;
      this.input.keyboard.once(`keydown-${keyName}`, () => {
        if (fired) return;
        fired = true;
        this.scene.start('LevelIntroScene', {
          level: 1,
          score: 0,
          mode: mode.id,
        });
      });
    });
  }

  drawCard(x, y, w, h, mode, hotkey) {
    // Card body — dark warm with the mode's accent color as a top bar.
    const card = this.add.graphics();
    card.fillStyle(0x2a1f14, 0.95);
    card.fillRoundedRect(x, y, w, h, 12);
    card.lineStyle(3, mode.color, 1);
    card.strokeRoundedRect(x, y, w, h, 12);
    // Top accent bar
    card.fillStyle(mode.color, 1);
    card.fillRoundedRect(x, y, w, 14, { tl: 12, tr: 12, bl: 0, br: 0 });

    // Hotkey badge in the upper-left corner
    const badge = this.add.graphics();
    badge.fillStyle(mode.color, 1);
    badge.fillRoundedRect(x + 20, y + 28, 56, 56, 8);
    badge.lineStyle(3, 0x1a120a, 1);
    badge.strokeRoundedRect(x + 20, y + 28, 56, 56, 8);
    this.add.text(x + 48, y + 56, `${hotkey}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: '#1a120a',
    }).setOrigin(0.5, 0.5);

    // Mode label
    this.add.text(x + 90, y + 42, mode.label, {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: '#f2d36b',
      stroke: '#1a120a',
      strokeThickness: 4,
    }).setOrigin(0, 0);

    // Tagline
    this.add.text(x + 90, y + 78, mode.tagline, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#a89668',
      wordWrap: { width: w - 100 },
    }).setOrigin(0, 0);

    // Details — bullet list
    const detailsTop = y + 130;
    const lineH = 28;
    mode.details.forEach((detail, i) => {
      this.add.text(x + 28, detailsTop + i * lineH, `· ${detail}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#e8d9a8',
        wordWrap: { width: w - 56 },
      });
    });

    // Bottom hint
    this.add.text(x + w / 2, y + h - 28, `APRETÁ [${hotkey}]`, {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#fff4d6',
      stroke: '#1a120a',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);
  }
}
