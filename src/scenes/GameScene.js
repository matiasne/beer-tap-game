import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import Tap from '../objects/Tap.js';
import Glass from '../objects/Glass.js';
import ClientQueue from '../objects/ClientQueue.js';
import { evaluateAgainstPreference } from '../clientPreferences.js';
import { shuffleAndPickStyles } from '../beerStyles.js';
import { levelTimeSec, levelTarget } from '../levels.js';
import { FONT_FAMILY } from '../textStyle.js';

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
    // Timestamps for the feathering technique (tap-tap-tap = less foam).
    // -Infinity means "never released" so the first press isn't feathered.
    this.lastStopAt = [-Infinity, -Infinity, -Infinity, -Infinity];
    this.featherUntil = [0, 0, 0, 0];
    // Idle-to-auto-release countdown bar (per tap). One Graphics each.
    this.idleBars = [];

    for (let i = 0; i < 4; i++) {
      const x = GAME_CONFIG.tapXs[i];
      const style = this.beerStyles[i];
      // splashY = rim line (where the stream first contacts the cup).
      // streamBottomY = below the tallest possible glass bottom so the
      // stream visually reaches the floor of the cup; glass walls + the
      // liquid fill hide the submerged part naturally.
      const splashY = GAME_CONFIG.glassY - 40;
      const streamBottomY = GAME_CONFIG.glassY + 120;
      const tap = new Tap(this, x, GAME_CONFIG.tapY, splashY, style, streamBottomY);
      const glass = new Glass(this, x, GAME_CONFIG.glassY, /* shape */ null, style);
      // Each tap dispenses one beer style and can't be changed mid-level,
      // so clients at this queue only ever want that same style.
      const queue = new ClientQueue(this, x, [style]);
      queue.onAngryLeave(() => {
        this.score += GAME_CONFIG.clients.angryPenalty;
        this.refreshHud();
        this.showFeedback('left angry!', '#ff4a2a', x, GAME_CONFIG.clients.frontBottomY - 80);
      });
      this.taps.push(tap);
      this.glasses.push(glass);
      this.queues.push(queue);
      this.drawStyleLabel(x, GAME_CONFIG.glassY + 75, style);
      const idleBar = this.add.graphics();
      idleBar.setVisible(false);
      this.idleBars.push(idleBar);
    }

    // Input — keys 1..4.
    this.keys = this.input.keyboard.addKeys(KEY_NAMES.join(','));

    // Dev shortcut: press G to instantly force a game over. Useful for
    // testing the name-entry / scoreboard flow without playing a full level.
    // Bumps score so qualifies() passes; bumps target so passed=false.
    this.input.keyboard.on('keydown-G', () => {
      if (this.timeUp) return;
      this.score = Math.max(this.score, 1000);
      this.target = this.score + 1;
      this.timeRemainingMs = 0;
      this.handleTimeUp();
    });

    // HUD — top-left: score / target. Top-right: level + time remaining.
    this.hudText = this.add.text(16, 12, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#e8d9a8',
    });
    this.levelText = this.add.text(784, 12, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#a89668',
    }).setOrigin(1, 0);
    this.timeText = this.add.text(784, 34, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#e8d9a8',
      stroke: '#1a120a',
      strokeThickness: 3,
    }).setOrigin(1, 0);
    this.refreshHud();

    // Instructions
    this.add.text(400, 588, 'hold 1 / 2 / 3 / 4 to pour — serve fast, tips decay!', {
      fontFamily: FONT_FAMILY,
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

  drawStyleLabel(x, y, style) {
    const color = '#' + style.handleHighlight.toString(16).padStart(6, '0');
    const txt = this.add.text(x, y, style.label, {
      fontFamily: FONT_FAMILY,
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
        // Time-up: all cups drop straight down off the bar (no scoring,
        // no respawn — the level is over).
        this.idleMs[i] = null;
        this.idleBars[i]?.setVisible(false);
        glass.releaseDown();
        this.glasses[i] = null;
      }
    }

    // Banner
    const banner = this.add.text(400, 300, "TIME'S UP!", {
      fontFamily: FONT_FAMILY,
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
      // Feathering: if the last release was within the window, grant a
      // brief foam-growth reduction starting now.
      const F = GAME_CONFIG.foam;
      if (this.time.now - this.lastStopAt[i] <= F.featherWindowMs) {
        this.featherUntil[i] = this.time.now + F.featherEffectMs;
      }
    } else if (!wantsPour && tap.isPouring) {
      tap.stopPour();
      this.idleMs[i] = 0; // start the 2s idle countdown toward release
      this.lastStopAt[i] = this.time.now;
    }

    // Always tick the glass so foam settles even when not actively pouring.
    if (glass) {
      const F = GAME_CONFIG.foam;
      const foamMul =
        this.time.now < this.featherUntil[i] ? F.featherFoamMultiplier : 1;
      glass.addFill(delta, GAME_CONFIG.pourRatePerSecond, tap.isPouring, foamMul);
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

    this.refreshIdleBar(i);
  }

  /**
   * Thin minimal bar that drains during the 3s idle-to-auto-release
   * countdown. Only visible when idle countdown is running.
   */
  refreshIdleBar(i) {
    const bar = this.idleBars[i];
    if (!bar) return;
    const ms = this.idleMs[i];
    if (ms === null || ms <= 0) {
      bar.setVisible(false);
      return;
    }
    const max = GAME_CONFIG.glassReleaseAfterIdleMs;
    const remaining = Math.max(0, 1 - ms / max);
    const W = 40;
    const H = 2;
    const x = GAME_CONFIG.tapXs[i] - W / 2;
    const y = GAME_CONFIG.glassY + 60;
    bar.clear();
    bar.fillStyle(0x3a2a1a, 1);
    bar.fillRect(x, y, W, H);
    bar.fillStyle(0xe8d9a8, 1);
    bar.fillRect(x, y, Math.round(W * remaining), H);
    bar.setVisible(true);
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

    const { score, tipMultiplier } = this.scoreFor(
      totalPct,
      foamPct,
      liquidPct,
      overflow,
      frontPref,
    );
    this.score += score;

    // Primary feedback — describes the pour itself, independent of who's
    // waiting. The bartender's critique, not the client's reaction.
    const quality = this.pourQualityFor(liquidPct, foamPct, overflow);
    this.showFeedback(quality.label, quality.color, glass.x, glass.y - 70, true);

    // Overflow path: penalty applied, no client served, no glass swap.
    // The bartender dunks the same glass and brings it back empty.
    if (overflow) {
      this.refreshHud();
      this.idleMs[i] = null;
      glass.dumpAndReset();
      return;
    }

    // Secondary feedback — client's preference reaction, smaller. Only
    // when the pour misses what they asked for.
    if (frontPref) {
      const ev = evaluateAgainstPreference(liquidPct, foamPct, frontPref);
      if (!ev.fillInWindow || !ev.foamInWindow) {
        this.showFeedback(ev.label, '#a89668', glass.x, glass.y - 40, false);
      }
    }

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
      // Tip floats over the client (who's paying), not the cup.
      this.showFeedback(
        `+$${tip} tip${mulNote}`,
        '#ffd93d',
        GAME_CONFIG.tapXs[i],
        GAME_CONFIG.clients.frontBottomY - 80,
      );
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

  /**
   * Pour quality independent of any client preference. Judges the cup
   * purely on fill % and foam ratio — the bartender's critique.
   */
  pourQualityFor(liquidPct, foamPct, overflow) {
    const s = GAME_CONFIG.scoring;
    const F = GAME_CONFIG.foam;

    if (overflow || liquidPct > 100) {
      return { label: 'OVERFLOW!', color: '#ff7a4a' };
    }
    if (liquidPct + foamPct < s.wastedBelow) {
      return { label: 'barely poured', color: '#888888' };
    }
    if (liquidPct < 50) {
      return { label: 'half empty', color: '#cfe8a8' };
    }

    const foamRatio = liquidPct > 1 ? (foamPct / liquidPct) * 100 : 0;
    const foamLow = foamRatio < F.idealMinPct - 2;
    const foamHigh = foamRatio > F.idealMaxPct + 4;
    const foamIdeal = !foamLow && !foamHigh;

    if (foamLow) return { label: 'flat pour', color: '#cfe8a8' };
    if (foamHigh) return { label: 'too foamy', color: '#e89c6b' };

    // Foam is in the ideal window — grade by fill tier.
    if (liquidPct >= 99 && foamIdeal) {
      return { label: 'PERFECT POUR', color: '#ffd93d' };
    }
    if (liquidPct >= 90) return { label: 'great pour', color: '#f2d36b' };
    if (liquidPct >= 70) return { label: 'good pour', color: '#cfe8a8' };
    return { label: 'decent pour', color: '#cfe8a8' };
  }

  showFeedback(text, color, x, y, big = true) {
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontSize: big ? '24px' : '13px',
      fontStyle: big ? 'bold' : 'normal',
      color,
      stroke: big ? '#1a120a' : undefined,
      strokeThickness: big ? 3 : 0,
    });
    t.setOrigin(0.5, 0.5);

    // Rounded box behind the text for readability.
    const padX = big ? 12 : 6;
    const padY = big ? 6 : 3;
    const boxW = Math.ceil(t.width) + padX * 2;
    const boxH = Math.ceil(t.height) + padY * 2;
    const box = this.add.graphics();
    box.fillStyle(0x1a120a, big ? 0.85 : 0.7);
    box.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, big ? 6 : 4);
    box.lineStyle(big ? 2 : 1, 0x4a3724, 1);
    box.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, big ? 6 : 4);

    const container = this.add.container(x, y, [box, t]);
    container.setDepth(50);

    this.tweens.add({
      targets: container,
      y: y - 50,
      alpha: 0,
      duration: 1600,
      ease: 'Cubic.out',
      onComplete: () => container.destroy(),
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
