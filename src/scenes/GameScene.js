import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import Tap from '../objects/Tap.js';
import Glass from '../objects/Glass.js';
import ClientQueue from '../objects/ClientQueue.js';
import { evaluateAgainstPreference } from '../clientPreferences.js';
import { shuffleAndPickStyles } from '../beerStyles.js';
import { levelTimeSec, levelTarget } from '../levels.js';
import { FONT_FAMILY } from '../textStyle.js';
import { backgroundForLevel, bgTextureKey, bgBackTextureKey, BG_W, BG_H } from '../backgrounds.js';
import { getMode, DEFAULT_MODE_ID } from '../gameModes.js';

const KEY_NAMES = ['ONE', 'TWO', 'THREE', 'FOUR'];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.level = data?.level ?? 1;
    this.startingScore = data?.score ?? 0;
    this.score = this.startingScore;
    // Game mode — controls tap count, timer, lives, scoring rules.
    // Stored on the scene so methods can branch on it and so we can pass
    // it forward to the result + next-level scenes.
    this.modeId = data?.mode ?? DEFAULT_MODE_ID;
    this.mode = getMode(this.modeId);
    this.timeLimitSec = this.mode.timeOverrideSec ?? levelTimeSec(this.level);
    this.target = levelTarget(this.level);
    this.timeRemainingMs = this.timeLimitSec * 1000;
    this.timeUp = false;            // set when the timer hits 0
    this.endingDownAt = 0;          // when set, scene transitions out at this time
    // Brief input cooldown after scene start so the held key that
    // triggered the intro→game transition doesn't immediately start pouring.
    this.inputCooldownMs = 180;
    // Consecutive perfect-pour combo counter. Resets on any non-perfect.
    this.combo = 0;
    // Survival lives — only used when mode.livesOverride is set. Pulled
    // from init data on level-2+ entries so lives carry across levels.
    this.lives = data?.lives ?? this.mode.livesOverride;
    // Game-over flag separate from timeUp — survival ends the run when
    // lives hit 0, which takes a different exit path than the normal
    // time-up flow.
    this.outOfLives = false;
  }

  create() {
    // Pick 4 distinct beer styles for this session and assign one per tap.
    this.beerStyles = shuffleAndPickStyles(4);

    this.drawBackdrop();

    // Build the tap+glass+queue triples per active station.
    // Most modes use all 4 stations; Speed Run uses 1 (the center tap).
    // Inactive slots stay `undefined` in the per-tap arrays and are
    // skipped during updateTap.
    this.taps = new Array(4);
    this.glasses = new Array(4);
    this.queues = new Array(4);
    this.pendingSpawn = [false, false, false, false];
    this.idleMs = [null, null, null, null];
    this.lastStopAt = [-Infinity, -Infinity, -Infinity, -Infinity];
    this.featherUntil = [0, 0, 0, 0];
    this.idleBars = new Array(4);

    // activeTapIndices: which tap slots get a real tap built. Speed Run
    // uses just one tap (index 2 — near center for visual balance).
    const totalTaps = 4;
    let activeTapIndices;
    if (this.mode.taps === 1) {
      activeTapIndices = [2];
    } else {
      activeTapIndices = [0, 1, 2, 3];
    }
    this.activeTapIndices = activeTapIndices;

    for (let i = 0; i < totalTaps; i++) {
      if (!activeTapIndices.includes(i)) continue;
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
      this.taps[i] = tap;
      this.glasses[i] = glass;

      // Queue is only built for modes with clients. In Speed Run we skip
      // it entirely so no one ever shows up to be served — pouring is the
      // whole gameplay loop.
      if (!this.mode.noClients) {
        const queue = new ClientQueue(this, x, [style]);
        queue.onAngryLeave(() => {
          this.score += GAME_CONFIG.clients.angryPenalty;
          // Survival: each angry leave also costs a life.
          if (this.mode.livesOverride != null) {
            this.lives = Math.max(0, this.lives - 1);
            this.showFeedback('-1 VIDA', '#ff4a2a', x, GAME_CONFIG.clients.frontBottomY - 120);
            if (this.lives <= 0 && !this.outOfLives) {
              this.outOfLives = true;
              this.handleGameOver();
            }
          }
          this.refreshHud();
          this.showFeedback('¡se fue enojado!', '#ff4a2a', x, GAME_CONFIG.clients.frontBottomY - 80);
        });
        this.queues[i] = queue;
      }

      const idleBar = this.add.graphics();
      idleBar.setVisible(false);
      this.idleBars[i] = idleBar;
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
    // Lives HUD — only visible in modes with a lives system (Survival).
    // Drawn under the score: a "VIDAS" label + heart icons rendered with Graphics.
    this.livesLabel = this.add.text(20, 90, 'VIDAS', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#8a7a55',
    });
    this.livesGfx = this.add.graphics();
    if (this.mode.livesOverride == null) {
      // Classic + other modes: hide lives, show target.
      this.livesLabel.setVisible(false);
      this.livesGfx.setVisible(false);
    } else {
      // Survival: hide target row, show lives.
      this.targetLabel.setVisible(false);
      this.targetText.setVisible(false);
    }
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
    if (this.mode.noTimer) this.timeText.setVisible(false);
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
    const customerH = GAME_CONFIG.tapY - 80; // top portion above the bar strip

    // Level-specific background image fills the customer-side area.
    // Falls back to a flat dark fill if the texture isn't ready.
    const bgEntry = backgroundForLevel(this.level);
    const bgKey = bgTextureKey(bgEntry.id);
    if (this.textures.exists(bgKey)) {
      const img = this.add.image(0, 0, bgKey).setOrigin(0, 0);
      // BG_W × BG_H matches the canvas area precisely, but use displaySize
      // defensively in case the canvas size shifts later.
      img.setDisplaySize(W, customerH);
      img.setDepth(-10);
    } else {
      const bg = this.add.graphics();
      bg.fillStyle(0x231a14, 1);
      bg.fillRect(0, 0, W, customerH);
    }

    // Wooden bar strip behind the taps.
    const bar = this.add.graphics();
    bar.fillStyle(0x3a2a1a, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 80, W, 60);
    bar.fillStyle(0x4a3724, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 78, W, 4);
    bar.fillStyle(0x2a1f14, 1);
    bar.fillRect(0, GAME_CONFIG.tapY - 22, W, 4);

    // Back-bar wall — the wall behind the row of taps (between the bar
    // strip and the counter-top). Drawn at depth -9 so it sits in front
    // of the customer-side bg (depth -10) but behind the taps + glasses
    // + clients (default depth 0).
    const backY = GAME_CONFIG.tapY - 20;        // just below the bar strip
    const backH = GAME_CONFIG.glassY + 180 - backY; // up to the counter-top
    const backKey = bgBackTextureKey(bgEntry.id);
    if (this.textures.exists(backKey)) {
      const img = this.add.image(0, backY, backKey).setOrigin(0, 0);
      img.setDisplaySize(W, backH);
      img.setDepth(-9);
    }

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

    // Timer countdown — skipped for modes with no timer (Survival).
    // The run ends via lives instead.
    if (!this.timeUp && !this.mode.noTimer) {
      this.timeRemainingMs -= delta;
      if (this.timeRemainingMs <= 0) {
        this.timeRemainingMs = 0;
        this.handleTimeUp();
      }
    }

    for (let i = 0; i < 4; i++) {
      if (this.queues[i]) this.queues[i].update(delta);
      if (this.taps[i]) this.updateTap(i, delta);
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
      if (this.mode.infiniteLevels) {
        // Survival: time-up just advances to the next level, no result screen.
        // The run only ends via handleGameOver when lives hit 0.
        this.scene.start('LevelIntroScene', {
          level: this.level + 1,
          score: this.score,
          mode: this.modeId,
          lives: this.lives,
        });
        return;
      }
      // Speed Run is a one-shot run — never "passes" to a next level.
      // Combo Master + Classic use the score-vs-target check.
      const passed = this.mode.noClients ? false : (this.score >= this.target);
      this.scene.start('LevelResultScene', {
        level: this.level,
        score: this.score,
        target: this.target,
        passed,
        mode: this.modeId,
      });
    });
  }

  /**
   * Lives-based game over (Survival only). Stops gameplay, shows a
   * dramatic banner, then routes to LevelResultScene with passed=false
   * so the regular game-over flow (scoreboard etc.) runs.
   */
  handleGameOver() {
    // Stop pours + drop cups same as handleTimeUp.
    this.timeUp = true; // gates input + tap updates
    for (let i = 0; i < 4; i++) {
      const tap = this.taps[i];
      const glass = this.glasses[i];
      if (tap?.isPouring) tap.stopPour();
      if (glass && !glass.released) {
        this.idleMs[i] = null;
        this.idleBars[i]?.setVisible(false);
        glass.releaseDown();
        this.glasses[i] = null;
      }
    }

    // Banner — different from "time up" so the player knows why
    const banner = this.add.text(this.scale.width / 2, this.scale.height / 2, '¡SIN VIDAS!', {
      fontFamily: FONT_FAMILY,
      fontSize: '140px',
      color: '#ff4a2a',
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

    this.time.delayedCall(1800, () => {
      // Survival never "passes" in the classic sense — there's no target.
      // Send to LevelResultScene with passed=false so the existing
      // game-over → scoreboard pipeline triggers as usual.
      this.scene.start('LevelResultScene', {
        level: this.level,
        score: this.score,
        target: 0,
        passed: false,
        mode: this.modeId,
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
    // In noClients modes (Speed Run) there's no queue — scoring falls
    // through to the absolute-quality tier in scoreFor when preference is null.
    const queue = this.queues[i];
    const frontPref = queue ? queue.frontPreference() : null;
    const frontWantedStyle = queue ? queue.frontWantedBeerStyle() : null;
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
    // In noClients modes (Speed Run) there's no queue so no tip is paid.
    const effectiveMultiplier = styleMismatch ? 0 : tipMultiplier;
    const { tip } = queue ? queue.serveFront(effectiveMultiplier) : { tip: 0 };
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

    let result;
    if (!preference) {
      // No client — neutral grade based on fill tier alone.
      const tierPct = Math.min(totalPct, 100);
      if (tierPct >= 96) result = { score: 250, tipMultiplier: 1 };
      else if (tierPct >= 90) result = { score: 100, tipMultiplier: 1 };
      else if (tierPct >= 70) result = { score: 50, tipMultiplier: 1 };
      else result = { score: 25, tipMultiplier: 1 };
    } else {
      const ev = evaluateAgainstPreference(liquidPct, foamPct, preference);
      let score;
      if (ev.fillInWindow && ev.foamInWindow) score = 250;
      else if (ev.fillInWindow || ev.foamInWindow) {
        score = ev.matchScore > 0.6 ? 100 : 50;
      } else {
        score = ev.matchScore > 0.4 ? 50 : 25;
      }
      result = { score, tipMultiplier: ev.tipMultiplier };
    }

    // Combo Master: only perfect pours (score 250) count. Anything else
    // gets zeroed out, both points and tip.
    if (this.mode?.onlyPerfectsScore && result.score < 250) {
      result = { score: 0, tipMultiplier: 0 };
    }
    return result;
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
    // Hearts row (Survival only)
    if (this.mode?.livesOverride != null && this.livesGfx) {
      this.drawLives();
    }
  }

  /** Pixel-art heart row in the HUD — one heart per remaining life. */
  drawLives() {
    const g = this.livesGfx;
    g.clear();
    const startX = 100;
    const y = 92;
    const size = 22;
    const gap = 6;
    const total = this.mode.livesOverride;
    for (let i = 0; i < total; i++) {
      const filled = i < this.lives;
      const x = startX + i * (size + gap);
      drawHeart(g, x, y, size, filled);
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

/**
 * Pixel-art heart at (x, y) of total `size`. `filled` toggles between a
 * full red heart (life remaining) and a dim outline-only heart (lost life).
 * Built from rectangles arranged into a classic 2-lobe heart silhouette.
 */
function drawHeart(g, x, y, size, filled) {
  const s = size / 8; // each "pixel" of the heart is s display-px wide
  const heart = filled ? 0xff4a4a : 0x3a2a1a;
  const lite = filled ? 0xff9a9a : 0x4a3a2a;
  const outline = filled ? 0x8a1010 : 0x2a1a10;
  // The classic 8×7 pixel heart pattern:
  //   .##.##.
  //   #######
  //   #######
  //   .#####.
  //   ..###..
  //   ...#...
  // ('1' = body, '2' = highlight, '0' = transparent)
  const grid = [
    '0220220',
    '2112112',
    '1111111',
    '0111110',
    '0011100',
    '0001000',
  ];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const ch = grid[row][col];
      if (ch === '0') continue;
      const color = ch === '2' ? lite : heart;
      g.fillStyle(color, 1);
      g.fillRect(x + col * s, y + row * s, s, s);
    }
  }
  // Outline — render once around the pattern.
  g.lineStyle(Math.max(1, s * 0.5), outline, filled ? 1 : 0.6);
  // Top-left lobe outline
  for (const [r, c] of [[0, 1], [0, 2]]) {
    g.strokeRect(x + c * s, y + r * s, s, s);
  }
  // Top-right lobe outline
  for (const [r, c] of [[0, 4], [0, 5]]) {
    g.strokeRect(x + c * s, y + r * s, s, s);
  }
  // Bottom tip
  g.strokeRect(x + 3 * s, y + 5 * s, s, s);
}
