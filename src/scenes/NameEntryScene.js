import Phaser from 'phaser';
import { FONT_FAMILY } from '../textStyle.js';
import { insert } from '../scoreboard.js';

/**
 * 4-letter arcade-style name entry. Each tap key (1..4) cycles its own
 * slot A→B→…→Z→A. After 20 seconds (or pressing all four held + ENTER?
 * no — strictly timer-based) the name is committed and we jump to the
 * scoreboard with the new row highlighted.
 */
const SLOT_COUNT = 4;
const KEY_NAMES = ['ONE', 'TWO', 'THREE', 'FOUR'];
const ENTRY_TIME_MS = 20000;

export default class NameEntryScene extends Phaser.Scene {
  constructor() {
    super('NameEntryScene');
  }

  init(data) {
    this.score = Math.max(0, Math.round(data?.score ?? 0));
    this.level = Math.max(1, Math.round(data?.level ?? 1));
    this.slots = ['A', 'A', 'A', 'A'];
    this.timeLeftMs = ENTRY_TIME_MS;
    this.submitted = false;
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRect(0, 0, 800, 600);

    // Headline
    this.add.text(400, 90, '¡NUEVO RÉCORD!', {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5);

    this.add.text(400, 140, `Puntaje: $${this.score}  ·  Nivel ${this.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#a89668',
    }).setOrigin(0.5, 0.5);

    // Instructions
    this.add.text(400, 180, 'TOCÁ 1 / 2 / 3 / 4 PARA CAMBIAR CADA LETRA', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#8a7a55',
    }).setOrigin(0.5, 0.5);

    // Slot boxes
    const slotW = 80;
    const slotGap = 16;
    const totalW = SLOT_COUNT * slotW + (SLOT_COUNT - 1) * slotGap;
    const startX = 400 - totalW / 2;
    const slotY = 300;

    this.slotBoxes = [];
    this.slotTexts = [];
    this.slotKeyLabels = [];

    for (let i = 0; i < SLOT_COUNT; i++) {
      const cx = startX + i * (slotW + slotGap) + slotW / 2;

      // Background box
      const box = this.add.graphics();
      this.drawSlotBox(box, cx, slotY, slotW, 80, false);
      this.slotBoxes.push(box);

      // Letter
      const letter = this.add.text(cx, slotY, this.slots[i], {
        fontFamily: FONT_FAMILY,
        fontSize: '54px',
        color: '#fff4d6',
        stroke: '#1a120a',
        strokeThickness: 5,
      }).setOrigin(0.5, 0.5);
      this.slotTexts.push(letter);

      // "[N]" key hint below each slot
      const hint = this.add.text(cx, slotY + 60, `[${i + 1}]`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#a89668',
      }).setOrigin(0.5, 0.5);
      this.slotKeyLabels.push(hint);
    }

    // Countdown bar
    const barW = totalW;
    const barH = 8;
    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(0x2a1f14, 1);
    this.timerBarBg.fillRect(startX, slotY + 110, barW, barH);
    this.timerBarBg.lineStyle(1, 0x4a3724, 1);
    this.timerBarBg.strokeRect(startX, slotY + 110, barW, barH);

    this.timerBar = this.add.graphics();
    this.timerBarStartX = startX;
    this.timerBarY = slotY + 110;
    this.timerBarW = barW;
    this.timerBarH = barH;

    // Numeric countdown text
    this.timerText = this.add.text(400, slotY + 140, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#e8d9a8',
      stroke: '#1a120a',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    // Footer prompt
    this.add.text(400, 540, 'esperá al timer para confirmar · por defecto AAAA', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: '#6a5a3d',
    }).setOrigin(0.5, 0.5);

    // Key bindings — each key cycles its own slot.
    this.keys = this.input.keyboard.addKeys(KEY_NAMES.join(','));
    KEY_NAMES.forEach((keyName, i) => {
      this.input.keyboard.on(`keydown-${keyName}`, () => this.cycleSlot(i));
    });

    this.refreshTimer();
  }

  drawSlotBox(g, cx, cy, w, h, highlighted) {
    g.clear();
    g.fillStyle(0x2a1f14, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    g.lineStyle(2, highlighted ? 0xffd93d : 0x4a3724, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
  }

  cycleSlot(i) {
    if (this.submitted) return;
    const code = this.slots[i].charCodeAt(0);
    const next = code === 90 /* Z */ ? 65 /* A */ : code + 1;
    this.slots[i] = String.fromCharCode(next);
    this.slotTexts[i].setText(this.slots[i]);

    // Quick pulse so the player sees the change.
    this.tweens.killTweensOf(this.slotTexts[i]);
    this.slotTexts[i].setScale(1.25);
    this.tweens.add({
      targets: this.slotTexts[i],
      scale: 1,
      duration: 140,
      ease: 'Back.out',
    });
  }

  update(_time, delta) {
    if (this.submitted) return;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    this.refreshTimer();
    if (this.timeLeftMs <= 0) this.submit();
  }

  refreshTimer() {
    const frac = this.timeLeftMs / ENTRY_TIME_MS;
    this.timerBar.clear();
    const color =
      frac > 0.5 ? 0x6acc4a : frac > 0.25 ? 0xf2d36b : 0xd44a2a;
    this.timerBar.fillStyle(color, 1);
    this.timerBar.fillRect(
      this.timerBarStartX,
      this.timerBarY,
      Math.round(this.timerBarW * frac),
      this.timerBarH,
    );
    const secs = Math.ceil(this.timeLeftMs / 1000);
    this.timerText.setText(`${secs}s`);
  }

  submit() {
    if (this.submitted) return;
    this.submitted = true;
    const name = this.slots.join('');
    const rank = insert({ name, score: this.score, level: this.level });
    this.scene.start('ScoreboardScene', { highlightRank: rank, fromRun: true });
  }
}
