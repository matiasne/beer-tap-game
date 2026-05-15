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
    // Consecutive perfect-pour combo counter. Resets on any non-perfect.
    this.combo = 0;
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
      const splashY = GAME_CONFIG.glassY - 80;
      const streamBottomY = GAME_CONFIG.glassY + 240;
      const tap = new Tap(this, x, GAME_CONFIG.tapY, splashY, style, streamBottomY);
      const glass = new Glass(this, x, GAME_CONFIG.glassY, /* shape */ null, style);
      // Each tap dispenses one beer style and can't be changed mid-level,
      // so clients at this queue only ever want that same style.
      const queue = new ClientQueue(this, x, [style]);
      queue.onAngryLeave(() => {
        this.score += GAME_CONFIG.clients.angryPenalty;
        this.refreshHud();
        this.showFeedback('¡se fue enojado!', '#ff4a2a', x, GAME_CONFIG.clients.frontBottomY - 80);
      });
      this.taps.push(tap);
      this.glasses.push(glass);
      this.queues.push(queue);
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

    // Dev shortcut: press C to bump the combo counter for testing the
    // multiplier ramp + HUD chip without having to pour perfects.
    this.input.keyboard.on('keydown-C', () => {
      if (this.timeUp) return;
      this.combo += 1;
      this.refreshHud();
      if (this.combo >= 2 && this.comboGroup) {
        this.tweens.killTweensOf(this.comboGroup);
        this.comboGroup.setScale(1.25);
        this.tweens.add({
          targets: this.comboGroup,
          scale: 1,
          duration: 220,
          ease: 'Back.out',
        });
      }
    });

    // HUD — top-left: score (big) + target (small label below).
    //        top-right: level + time remaining.
    this.scoreLabel = this.add.text(20, 14, 'PUNTAJE', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#8a7a55',
    });
    this.scoreText = this.add.text(20, 38, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 4,
    });
    this.targetLabel = this.add.text(20, 90, 'OBJETIVO', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#8a7a55',
    });
    this.targetText = this.add.text(130, 88, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#e8d9a8',
    });
    // Combo display — bottom-left, big, with a row of stars below the
    // label showing progress toward the cap. Only visible when streak ≥ 2.
    this.comboGroup = this.add.container(20, this.scale.height - 200);
    this.comboGroup.setVisible(false);

    this.comboText = this.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '56px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 7,
    });
    this.comboMultText = this.add.text(0, 60, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      color: '#fff4d6',
      stroke: '#1a120a',
      strokeThickness: 4,
    });
    this.comboStars = this.add.graphics();
    this.comboGroup.add([this.comboText, this.comboMultText, this.comboStars]);
    // Legacy field kept for any external callers; updated each refresh.
    this.hudText = this.scoreText;

    this.levelText = this.add.text(this.scale.width - 20, 16, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#a89668',
    }).setOrigin(1, 0);
    this.timeText = this.add.text(this.scale.width - 20, 48, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: '#e8d9a8',
      stroke: '#1a120a',
      strokeThickness: 4,
    }).setOrigin(1, 0);
    this.refreshHud();

    // Instructions
    this.add.text(this.scale.width / 2, this.scale.height - 12, 'mantené 1 / 2 / 3 / 4 para servir — ¡rápido, las propinas bajan!', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: '#6a5a3d',
    }).setOrigin(0.5, 1);
  }

  drawBackdrop() {
    const W = this.scale.width;
    // Customer-side floor (above the bar) — slightly darker, suggests the patrons' side.
    const bg = this.add.graphics();
    bg.fillStyle(0x231a14, 1);
    bg.fillRect(0, 0, W, GAME_CONFIG.tapY - 80);

    // Wooden bar strip behind the taps.
    const bar = this.add.graphics();
    bar.fillStyle(0x3a2a1a, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 80, W, 60);
    bar.fillStyle(0x4a3724, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 78, W, 4);
    bar.fillStyle(0x2a1f14, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 22, W, 4);

    // Counter-top under the glasses.
    bar.fillStyle(0x2a1f14, 1);
    bar.fillRect(0, GAME_CONFIG.glassY + 180, W, 8);
    bar.fillStyle(0x1a120a, 1);
    bar.fillRect(0, GAME_CONFIG.glassY + 188, W, 200);
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
    const banner = this.add.text(this.scale.width / 2, this.scale.height / 2, '¡SE ACABÓ EL TIEMPO!', {
      fontFamily: FONT_FAMILY,
      fontSize: '120px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 12,
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
    const W = 72;
    const H = 4;
    const x = GAME_CONFIG.tapXs[i] - W / 2;
    // All glasses share a bottom baseline at glassY + 232 (BASELINE_HALF_H
    // × spriteScale). Sit the bar just below that so it reads as ground-line
    // beneath the cup.
    const y = GAME_CONFIG.glassY + 240;
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

    const scoreResult = this.scoreFor(
      totalPct,
      foamPct,
      liquidPct,
      overflow,
      frontPref,
    );
    let { score, tipMultiplier } = scoreResult;

    // Primary feedback — judged against the client's specific preference.
    // "PERFECT POUR" requires hitting both the client's fill and foam windows.
    const quality = this.pourQualityFor(liquidPct, foamPct, overflow, frontPref);

    // --- Combo logic ---
    // Perfect pour grows the streak; anything else (overflow, decent, foam
    // off, fill miss) breaks it. The multiplier ramps 1× → 4× over a few
    // perfects to reward sustained mastery.
    let comboBonus = 0;
    let comboLabel = quality.label;
    if (quality.perfect) {
      this.combo += 1;
      const multiplier = Math.min(4, 1 + (this.combo - 1) * 0.5);
      if (this.combo >= 2) {
        const baseScore = score; // perfect base = 250
        const totalWithCombo = Math.round(baseScore * multiplier);
        comboBonus = totalWithCombo - baseScore;
        score = totalWithCombo;
        comboLabel = `PERFECTA x${this.combo} (${multiplier}×)`;
        // Pop the combo display on growth so the player feels the streak.
        if (this.comboGroup) {
          this.tweens.killTweensOf(this.comboGroup);
          this.comboGroup.setScale(1.25);
          this.tweens.add({
            targets: this.comboGroup,
            scale: 1,
            duration: 220,
            ease: 'Back.out',
          });
        }
      }
    } else {
      const wasStreak = this.combo;
      this.combo = 0;
      if (wasStreak >= 2) {
        this.showFeedback(
          `combo x${wasStreak} perdido`,
          '#a89668',
          glass.x,
          glass.y - 110,
          false,
        );
      }
    }

    this.score += score;
    this.showFeedback(comboLabel, quality.color, glass.x, glass.y - 70, true);

    // Overflow path: penalty applied, no client served, no glass swap.
    // The bartender dunks the same glass and brings it back empty.
    if (overflow) {
      this.refreshHud();
      this.idleMs[i] = null;
      glass.dumpAndReset();
      return;
    }

    // Style mismatch: client took the glass but won't tip you for it.
    if (styleMismatch) {
      this.showFeedback(
        `¡quería ${frontWantedStyle.label}!`,
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
        tipMultiplier > 1.2 ? ' (¡generoso!)' :
        tipMultiplier < 0.6 ? ' (tacaño)' : '';
      // Tip floats over the client (who's paying), not the cup.
      this.showFeedback(
        `+$${tip} propina${mulNote}`,
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
   * Score the poured glass against the front client's specific preference.
   *   - Both axes (fill + foam) inside their tolerance windows → 250 + combo
   *   - One axis in window, the other slightly off              → 100
   *   - One axis in, the other way off                          → 50
   *   - Both off but at least some pour                         → 25
   *   - Below wasted threshold (almost empty)                   → 0
   *   - Overflow                                                → -50
   * Tip multiplier comes straight from evaluateAgainstPreference.
   * If no preference (defensive), fall back to a pure-volume tier.
   */
  scoreFor(totalPct, foamPct, liquidPct, overflow, preference) {
    const s = GAME_CONFIG.scoring;
    if (overflow || liquidPct > 100) {
      return { score: s.overflowPenalty, tipMultiplier: 0.3 };
    }
    if (totalPct < s.wastedBelow) {
      return { score: 0, tipMultiplier: 0.4 };
    }

    if (!preference) {
      // No client — neutral grade based on fill tier alone.
      const tierPct = Math.min(totalPct, 100);
      if (tierPct >= 96) return { score: 250, tipMultiplier: 1 };
      if (tierPct >= 90) return { score: 100, tipMultiplier: 1 };
      if (tierPct >= 70) return { score: 50, tipMultiplier: 1 };
      return { score: 25, tipMultiplier: 1 };
    }

    const ev = evaluateAgainstPreference(liquidPct, foamPct, preference);
    let score;
    if (ev.fillInWindow && ev.foamInWindow) score = 250;
    else if (ev.fillInWindow || ev.foamInWindow) {
      // One axis perfect, judge severity of the miss on the other.
      score = ev.matchScore > 0.6 ? 100 : 50;
    } else {
      score = ev.matchScore > 0.4 ? 50 : 25;
    }
    return { score, tipMultiplier: ev.tipMultiplier };
  }

  /**
   * Pour quality judged against the client's specific preference. Returns
   * the big-label feedback shown above the cup. "Perfect" requires both
   * fill and foam to be within the client's tolerance windows — what that
   * client called for, not an absolute 99% pour.
   */
  pourQualityFor(liquidPct, foamPct, overflow, preference) {
    const s = GAME_CONFIG.scoring;
    if (overflow || liquidPct > 100) {
      return { label: '¡SE REBALSÓ!', color: '#ff7a4a' };
    }
    if (liquidPct + foamPct < s.wastedBelow) {
      return { label: 'casi vacío', color: '#888888' };
    }

    // No client at the tap — fall back to absolute foam/fill grading.
    if (!preference) {
      if (liquidPct >= 96) {
        return { label: 'PERFECTA', color: '#ffd93d', perfect: true };
      }
      if (liquidPct >= 90) return { label: 'gran servida', color: '#f2d36b' };
      if (liquidPct >= 70) return { label: 'buena servida', color: '#cfe8a8' };
      return { label: 'servida pasable', color: '#cfe8a8' };
    }

    const ev = evaluateAgainstPreference(liquidPct, foamPct, preference);
    if (ev.fillInWindow && ev.foamInWindow) {
      return { label: 'PERFECT', color: '#ffd93d', perfect: true };
    }

    // Choose the worse miss to surface as the primary critique. If both
    // axes miss, use "wasted" tone; if one matches, name the one that's off.
    const foamRatio = liquidPct > 1 ? (foamPct / liquidPct) * 100 : 0;
    if (!ev.fillInWindow && !ev.foamInWindow) {
      return { label: 'no es su estilo', color: '#e89c6b' };
    }
    if (!ev.fillInWindow) {
      const tooMuch = liquidPct > preference.fill.fillTarget;
      return {
        label: tooMuch ? 'demasiada' : 'muy poca',
        color: '#f2d36b',
      };
    }
    // foam off
    const tooFoamy = foamRatio > preference.foam.foamRatioTarget;
    return {
      label: tooFoamy ? 'mucha espuma' : 'sin espuma',
      color: '#f2d36b',
    };
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
    this.scoreText.setText(`${sign}$${padded}`);
    if (this.targetText) this.targetText.setText(`$${this.target}`);
    if (this.levelText) this.levelText.setText(`NIVEL ${this.level}`);
    if (this.timeText) {
      const secsLeft = Math.max(0, Math.ceil(this.timeRemainingMs / 1000));
      const lowTime = secsLeft <= 10;
      this.timeText.setText(`${secsLeft}s`);
      this.timeText.setColor(lowTime ? '#ff7a4a' : '#e8d9a8');
    }
    if (this.comboGroup) {
      if (this.combo >= 2) {
        const multiplier = Math.min(4, 1 + (this.combo - 1) * 0.5);
        this.comboText.setText(`COMBO x${this.combo}`);
        this.comboMultText.setText(`${multiplier}× PUNTOS`);
        this.drawComboStars();
        this.comboGroup.setVisible(true);
      } else {
        this.comboGroup.setVisible(false);
      }
    }
  }

  /**
   * Row of stars under the combo label. Lit star = combo level reached,
   * dim star = remaining slot toward the 7-combo (4× multiplier) cap.
   */
  drawComboStars() {
    const g = this.comboStars;
    g.clear();
    const TOTAL = 7; // combos until 4× cap
    const lit = Math.min(this.combo, TOTAL);
    const starSize = 18;
    const gap = 6;
    const y = 110;
    for (let i = 0; i < TOTAL; i++) {
      const cx = i * (starSize + gap) + starSize / 2;
      const cy = y + starSize / 2;
      drawStar(g, cx, cy, starSize / 2, i < lit);
    }
  }
}

/**
 * Pixel-art star drawn as filled triangles via beginPath/fillPoints.
 * `filled` toggles between bright yellow (earned) and dim grey (empty).
 */
function drawStar(g, cx, cy, r, filled) {
  const points = [];
  const spikes = 5;
  const inner = r * 0.45;
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    points.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
  }
  if (filled) {
    g.fillStyle(0xffd93d, 1);
    g.lineStyle(2, 0x4a3724, 1);
  } else {
    g.fillStyle(0x3a2a1a, 1);
    g.lineStyle(2, 0x4a3724, 0.6);
  }
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}
