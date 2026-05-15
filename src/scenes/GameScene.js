import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import Tap from '../objects/Tap.js';
import Glass from '../objects/Glass.js';
import ClientQueue from '../objects/ClientQueue.js';
import { evaluateAgainstPreference } from '../clientPreferences.js';
import { shuffleAndPickStyles } from '../beerStyles.js';
import { levelTimeSec, levelTarget } from '../levels.js';

const KEY_NAMES = ['ONE', 'TWO', 'THREE', 'FOUR'];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.level = data?.level ?? 1;
    this.startingScore = data?.score ?? 0;
    this.score = this.startingScore;
    this.timeLimitSec = levelTimeSec(this.level);
    this.target = levelTarget(this.level);
    this.timeRemainingMs = this.timeLimitSec * 1000;
    this.timeUp = false;            // set when the timer hits 0
    this.endingDownAt = 0;          // when set, scene transitions out at this time
    // Brief input cooldown after scene start so the held key that
    // triggered the intro→game transition doesn't immediately start pouring.
    this.inputCooldownMs = 180;
  }

  create() {
    // Pick 4 distinct beer styles for this session and assign one per tap.
    this.beerStyles = shuffleAndPickStyles(4);

    this.drawBackdrop();

    // Build the four tap+glass+queue triples.
    this.taps = [];
    this.glasses = [];
    this.queues = [];
    this.pendingSpawn = [false, false, false, false];
    // Ms since the tap last stopped pouring on a still-present glass.
    // null = either currently pouring, or there's no glass to release.
    this.idleMs = [null, null, null, null];

    for (let i = 0; i < 4; i++) {
      const x = GAME_CONFIG.tapXs[i];
      const style = this.beerStyles[i];
      const tap = new Tap(this, x, GAME_CONFIG.tapY, GAME_CONFIG.glassY - 40, style);
      const glass = new Glass(this, x, GAME_CONFIG.glassY, /* shape */ null, style);
      const queue = new ClientQueue(this, x, this.beerStyles);
      queue.onAngryLeave(() => {
        this.score += GAME_CONFIG.clients.angryPenalty;
        this.refreshHud();
        this.showFeedback('left angry!', '#ff4a2a', x, GAME_CONFIG.clients.frontBottomY - 80);
      });
      this.taps.push(tap);
      this.glasses.push(glass);
      this.queues.push(queue);
      this.drawKeyLabel(x, GAME_CONFIG.glassY + 100, GAME_CONFIG.keyLabels[i]);
      this.drawStyleLabel(x, GAME_CONFIG.glassY + 75, style);
    }

    // Input — keys 1..4.
    this.keys = this.input.keyboard.addKeys(KEY_NAMES.join(','));

    // HUD — top-left: score / target. Top-right: level + time remaining.
    this.hudText = this.add.text(16, 12, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e8d9a8',
    });
    this.levelText = this.add.text(784, 12, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#a89668',
    }).setOrigin(1, 0);
    this.timeText = this.add.text(784, 34, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#e8d9a8',
      stroke: '#1a120a',
      strokeThickness: 3,
    }).setOrigin(1, 0);
    this.refreshHud();

    // Instructions
    this.add.text(400, 588, 'hold 1 / 2 / 3 / 4 to pour — serve fast, tips decay!', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#6a5a3d',
    }).setOrigin(0.5, 1);
  }

  drawBackdrop() {
    // Customer-side floor (above the bar) — slightly darker, suggests the patrons' side.
    const bg = this.add.graphics();
    bg.fillStyle(0x231a14, 1);
    bg.fillRect(0, 0, 800, GAME_CONFIG.tapY - 80);

    // Wooden bar strip behind the taps.
    const bar = this.add.graphics();
    bar.fillStyle(0x3a2a1a, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 80, 800, 60);
    bar.fillStyle(0x4a3724, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 78, 800, 4);
    bar.fillStyle(0x2a1f14, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 22, 800, 4);

    // Counter-top under the glasses.
    bar.fillStyle(0x2a1f14, 1);
    bar.fillRect(0, GAME_CONFIG.glassY + 100, 800, 8);
    bar.fillStyle(0x1a120a, 1);
    bar.fillRect(0, GAME_CONFIG.glassY + 108, 800, 80);
  }

  drawKeyLabel(x, y, label) {
    const txt = this.add.text(x, y, `[${label}]`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e8d9a8',
    });
    txt.setOrigin(0.5, 0.5);
  }

  drawStyleLabel(x, y, style) {
    const color = '#' + style.handleHighlight.toString(16).padStart(6, '0');
    const txt = this.add.text(x, y, style.label, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color,
      stroke: '#1a120a',
      strokeThickness: 3,
    });
    txt.setOrigin(0.5, 0.5);
  }

  update(_time, delta) {
    if (this.inputCooldownMs > 0) {
      this.inputCooldownMs = Math.max(0, this.inputCooldownMs - delta);
    }

    if (!this.timeUp) {
      this.timeRemainingMs -= delta;
      if (this.timeRemainingMs <= 0) {
        this.timeRemainingMs = 0;
        this.handleTimeUp();
      }
    }

    for (let i = 0; i < 4; i++) {
      this.queues[i].update(delta);
      this.updateTap(i, delta);
    }

    this.refreshHud();
  }

  /**
   * Soft end: stop all pours, force-release any in-progress glass so its
   * pour points + tip register, then schedule the transition to the
   * result scene. Keeps the queue ticking so feedback animations finish.
   */
  handleTimeUp() {
    if (this.timeUp) return;
    this.timeUp = true;

    for (let i = 0; i < 4; i++) {
      const tap = this.taps[i];
      const glass = this.glasses[i];
      if (tap?.isPouring) tap.stopPour();
      if (glass && !glass.released) {
        this.releaseGlass(i);
      }
    }

    // Banner
    const banner = this.add.text(400, 300, "TIME'S UP!", {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 8,
    });
    banner.setOrigin(0.5, 0.5);
    banner.setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: { from: 0.6, to: 1 },
      duration: 280,
      ease: 'Back.out',
    });

    // Brief delay to let feedback animations settle, then transition.
    this.time.delayedCall(1400, () => {
      const passed = this.score >= this.target;
      this.scene.start('LevelResultScene', {
        level: this.level,
        score: this.score,
        target: this.target,
        passed,
      });
    });
  }

  updateTap(i, delta) {
    const tap = this.taps[i];
    const glass = this.glasses[i];
    const keyName = KEY_NAMES[i];
    const key = this.keys[keyName];
    // After time is up: ignore further input — taps were already stopped
    // and glasses force-released by handleTimeUp().
    // During the brief input cooldown (e.g., held key carried over from
    // the intro screen), also ignore.
    const wantsPour =
      !this.timeUp &&
      this.inputCooldownMs <= 0 &&
      key.isDown &&
      glass &&
      !glass.released;

    if (wantsPour && !tap.isPouring) {
      tap.startPour();
      this.idleMs[i] = null; // resuming on the same glass — cancel any idle countdown
    } else if (!wantsPour && tap.isPouring) {
      tap.stopPour();
      this.idleMs[i] = 0; // start the 2s idle countdown toward release
    }

    // Always tick the glass so foam settles even when not actively pouring.
    if (glass) {
      glass.addFill(delta, GAME_CONFIG.pourRatePerSecond, tap.isPouring);
      // Overflow conditions: liquid itself past the rim, OR liquid+foam past
      // the rim plus a foam overshoot allowance (a real "head" sits above the lip).
      const overLiquid = glass.fillLevel > GAME_CONFIG.overflowThreshold;
      const overTotal =
        glass.totalLevel >
        GAME_CONFIG.overflowThreshold + GAME_CONFIG.foamOvershootAllowance;
      if (tap.isPouring && (overLiquid || overTotal)) {
        tap.stopPour();
        this.releaseGlass(i, /* overflow */ true);
        return;
      }
    }

    // Idle countdown: if the tap has been off for `glassReleaseAfterIdleMs`
    // while a glass with any contents is sitting there, send it.
    if (!tap.isPouring && glass && this.idleMs[i] !== null) {
      this.idleMs[i] += delta;
      if (this.idleMs[i] >= GAME_CONFIG.glassReleaseAfterIdleMs) {
        this.idleMs[i] = null;
        this.releaseGlass(i);
      }
    }
  }

  releaseGlass(i, overflow = false) {
    const glass = this.glasses[i];
    if (!glass || glass.released) return;

    const totalPct = Math.min(glass.totalLevel, 150);
    const liquidPct = Math.max(0, glass.fillLevel);
    const foamPct = Math.max(0, glass.foamLevel);
    const frontPref = this.queues[i].frontPreference();
    const frontWantedStyle = this.queues[i].frontWantedBeerStyle();
    const pouredStyle = this.beerStyles[i];
    const styleMismatch =
      frontWantedStyle != null && pouredStyle.key !== frontWantedStyle.key;

    const { score, label, color, tipMultiplier } = this.scoreFor(
      totalPct,
      foamPct,
      liquidPct,
      overflow,
      frontPref,
    );
    this.score += score;
    this.showFeedback(label, color, glass.x, glass.y - 60);

    // Style mismatch: client took the glass but won't tip you for it.
    if (styleMismatch) {
      this.showFeedback(
        `wanted ${frontWantedStyle.label}!`,
        '#ff7a4a',
        glass.x,
        glass.y - 30,
      );
    }

    // Pay the front client at this tap (if any) — they take the glass.
    // Mismatched style → 0× multiplier (no tip). Otherwise scaled by preference fit.
    const effectiveMultiplier = styleMismatch ? 0 : tipMultiplier;
    const { tip } = this.queues[i].serveFront(effectiveMultiplier);
    if (tip > 0) {
      this.score += tip;
      const mulNote =
        tipMultiplier > 1.2 ? ' (generous!)' :
        tipMultiplier < 0.6 ? ' (stingy)' : '';
      this.showFeedback(`+$${tip} tip${mulNote}`, '#ffd93d', glass.x + 40, glass.y - 90);
    }
    this.refreshHud();

    this.pendingSpawn[i] = true;
    this.idleMs[i] = null;
    glass.release(() => {
      // Spawn the next glass after a short delay, unless the scene is shutting down.
      this.time.delayedCall(GAME_CONFIG.glassSpawnDelay, () => {
        if (!this.scene.isActive('GameScene')) return;
        this.glasses[i] = new Glass(
          this,
          GAME_CONFIG.tapXs[i],
          GAME_CONFIG.glassY,
          /* shape */ null,
          this.beerStyles[i],
        );
        this.pendingSpawn[i] = false;
      });
    });
    this.glasses[i] = null;
  }

  /**
   * Score a poured glass against the front client's preference.
   * - Always penalizes overflow.
   * - Base points from total fill volume tier (existing).
   * - Preference fill bonus/penalty (+50 in window, -25 way outside).
   * - Returns a tipMultiplier (0.4..1.5) reflecting overall match quality.
   *
   * If no client is waiting, falls back to a neutral evaluation
   * (base only, multiplier 1.0).
   */
  scoreFor(totalPct, foamPct, liquidPct, overflow, preference) {
    const s = GAME_CONFIG.scoring;
    // Overflow only when the caller already flagged it (the updateTap check
    // already accounts for the foam overshoot allowance), OR when liquid
    // alone is past the rim.
    if (overflow || liquidPct > 100) {
      return {
        score: s.overflowPenalty,
        label: 'OVERFLOW! -50',
        color: '#ff7a4a',
        tipMultiplier: 0.3,
      };
    }
    if (totalPct < s.wastedBelow) {
      return { score: 0, label: 'wasted', color: '#888888', tipMultiplier: 0.4 };
    }

    // Base score from total fill tier (capped at 100 for tier math).
    const tierPct = Math.min(totalPct, 100);
    let base, baseLabel, color;
    if (tierPct < s.decentBelow) {
      base = Math.round(10 * tierPct);
      baseLabel = `decent`;
      color = '#cfe8a8';
    } else if (tierPct < s.goodBelow) {
      base = 100;
      baseLabel = 'good';
      color = '#f2d36b';
    } else {
      base = 250;
      baseLabel = 'PERFECT pour';
      color = '#ffd93d';
    }

    // No client to please — neutral.
    if (!preference) {
      const sign = base >= 0 ? '+' : '';
      return {
        score: base,
        label: `${baseLabel} ${sign}${base}`,
        color,
        tipMultiplier: 1.0,
      };
    }

    // Evaluate against the client's preference.
    const ev = evaluateAgainstPreference(liquidPct, foamPct, preference);
    const total = base + ev.fillBonus;
    const sign = total >= 0 ? '+' : '';
    const prefNote =
      ev.fillInWindow && ev.foamInWindow ? ` — ${ev.label}` :
      !ev.fillInWindow || !ev.foamInWindow ? ` — ${ev.label}` : '';

    if (ev.fillInWindow && ev.foamInWindow) color = '#ffd93d';
    else if (!ev.fillInWindow && !ev.foamInWindow) color = '#e89c6b';

    return {
      score: total,
      label: `${baseLabel} ${sign}${total}${prefNote}`,
      color,
      tipMultiplier: ev.tipMultiplier,
    };
  }

  showFeedback(text, color, x, y) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color,
    });
    t.setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  refreshHud() {
    const padded = String(Math.max(0, this.score)).padStart(6, '0');
    const sign = this.score < 0 ? '-' : ' ';
    this.hudText.setText(`SCORE: ${sign}${padded}   TARGET: ${this.target}`);
    if (this.levelText) this.levelText.setText(`LEVEL ${this.level}`);
    if (this.timeText) {
      const secsLeft = Math.max(0, Math.ceil(this.timeRemainingMs / 1000));
      const lowTime = secsLeft <= 10;
      this.timeText.setText(`${secsLeft}s`);
      this.timeText.setColor(lowTime ? '#ff7a4a' : '#e8d9a8');
    }
  }
}
