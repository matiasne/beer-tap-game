import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { pickRandomPreference, prefIconKey } from '../clientPreferences.js';
import { BEER_STYLES } from '../beerStyles.js';
import { FONT_FAMILY } from '../textStyle.js';
import { pickCharacter, animKey, frameName } from '../clientSpriteSheet.js';

const C = GAME_CONFIG.clients;

/**
 * A bar patron standing in line behind a tap. Carries a tip amount that
 * decays linearly over the patience window. The Client class is "dumb"
 * about queue position — the parent ClientQueue places/animates it.
 *
 * Body rendering: a Phaser.Sprite reading from the `clients_atlas` texture.
 * Each character (common + special) has 6 animation states: idle, normal,
 * antsy, furious, talking_left, talking_right. The current state is driven
 * by mood (patience-based) and the queue's talking trigger.
 *
 * Public surface:
 *   .tipNow      — current tip value (rounded for display, exact internally)
 *   .isAlive     — false once leaveAngry() or leaveServed() runs
 *   .character   — sprite character config (id, special, ...) chosen at construction
 *   .updatePatience(deltaMs) — call each frame; returns true if just expired
 *   .applyQueueSlot(slotIndex, anchorX) — place at queue position 0..N-1
 *   .setTalking(dir)         — 'left' | 'right' | null, plays a talking anim
 *   .leaveAngry(onDone) / .leaveServed(onDone) — exit animations
 */
export default class Client extends Phaser.GameObjects.Container {
  constructor(scene, x, y, wantedBeerStyle = null) {
    super(scene, x, y);
    scene.add.existing(this);

    this.character = pickCharacter();
    this.preference = pickRandomPreference();
    this.wantedBeerStyle = wantedBeerStyle || BEER_STYLES[0];
    this.elapsedMs = 0;
    this.patienceMs = C.patienceMs;
    this.tipMax = C.tipMax;
    this.tipMin = C.tipMin;
    this.tipExact = this.tipMax;
    this.isAlive = true;
    this.expired = false;

    // Body sprite — bottom-anchored so y is the "feet" position.
    this.body = scene.add.sprite(
      0,
      0,
      'clients_atlas',
      frameName(this.character.id, 'normal', 0),
    );
    this.body.setOrigin(0.5, 1);
    this.body.setScale(C.queueScale);
    this.add(this.body);
    // Start in 'normal' breathing loop — the queue tick will override this
    // with 'antsy'/'furious'/'talking_*' as the situation changes.
    this.playState('normal');

    // Speech bubble + preference icon — chat bubble sits to the right of
    // the client at head height, with its down-left tail pointing back at
    // the head. Only shown for the front client (toggled in applyQueueSlot).
    // Body sprite is 32x44 at queueScale=2, bottom-anchored. Head center is
    // roughly at y = -(44-10)*2 = -68 in container-local coords.
    const headCenterY = -(44 - 10) * C.queueScale; // approx
    const bubbleScale = 1.6;
    const halfBodyW = 16 * C.queueScale; // 32/2 source × scale
    const halfBubbleW = (28 / 2) * bubbleScale;
    const bubbleX = halfBodyW + halfBubbleW + 2; // small gap from the body
    const bubbleY = headCenterY - 8; // slight lift so the down-left tail tip lands near the head
    this.prefBubble = scene.add.image(bubbleX, bubbleY, 'chat_bubble');
    this.prefBubble.setOrigin(0.5, 11 / 28);
    this.prefBubble.setScale(bubbleScale);
    this.add(this.prefBubble);

    this.prefIcon = scene.add.image(
      bubbleX,
      bubbleY,
      prefIconKey(this.preference, this.wantedBeerStyle),
    );
    this.prefIcon.setOrigin(0.5, 0.5);
    this.prefIcon.setScale(bubbleScale);
    this.add(this.prefIcon);

    // Tip text floating above the head, offset right of the icon.
    this.tipText = scene.add.text(8, -44 * C.queueScale - 16, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 3,
    });
    this.tipText.setOrigin(0.5, 1);
    this.tipText.setVisible(false);
    this.add(this.tipText);

    // Mood emoji floating above the head — empty when calm, '!' antsy, '‼' furious.
    this.moodIcon = scene.add.text(0, this.tipText.y - 2, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 3,
    });
    this.moodIcon.setOrigin(0.5, 1);
    this.moodIcon.setVisible(false);
    this.add(this.moodIcon);

    this.mood = 'calm';
    this.talkDir = null; // 'left' | 'right' | null — overrides mood when set
    this.currentState = 'normal';

    this.refreshTipDisplay();
    this.spawnAnim();
  }

  /** Play a state animation on the body sprite. No-op if already playing. */
  playState(state) {
    if (this.currentState === state) return;
    this.currentState = state;
    const key = animKey(this.character.id, state);
    if (this.scene.anims.exists(key)) {
      this.body.play(key);
    } else {
      // Defensive — should never happen since BootScene registers all anims.
      this.body.setTexture('clients_atlas', frameName(this.character.id, state, 0));
    }
  }

  /**
   * Reposition for a slot in the queue. slotIndex 0 = front (at the tap),
   * 1, 2 = further back. Behind clients are smaller and dimmer.
   */
  applyQueueSlot(slotIndex, anchorX) {
    const targetX = anchorX + slotIndex * C.queueXOffset;
    const targetY = C.frontBottomY + slotIndex * C.queueYOffset;
    const scale = C.queueScale * Math.pow(C.queueScaleFalloff, slotIndex);
    const alpha = Math.pow(C.queueAlphaFalloff, slotIndex);

    // Hide tip text + bubble for non-front clients to reduce clutter, but
    // keep the preference icon visible for the front so the player can plan.
    const isFront = slotIndex === 0;
    this.isFront = isFront;
    this.moodIcon.setVisible(isFront && this.mood !== 'calm');
    this.prefIcon.setVisible(isFront);
    this.prefBubble.setVisible(isFront);

    this.setDepth(100 - slotIndex); // front draws on top

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 260,
      ease: 'Cubic.out',
    });
    this.scene.tweens.add({
      targets: this.body,
      scale,
      duration: 260,
      ease: 'Cubic.out',
    });
    this.scene.tweens.add({
      targets: this,
      alpha,
      duration: 200,
    });
  }

  spawnAnim() {
    this.setAlpha(0);
    const targetX = this.x;
    this.x = targetX + 40; // slide in from the right
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      x: targetX,
      duration: 260,
      ease: 'Cubic.out',
    });
  }

  updatePatience(deltaMs) {
    if (!this.isAlive || this.expired) return false;
    this.elapsedMs = Math.min(this.elapsedMs + deltaMs, this.patienceMs);
    const remaining = 1 - this.elapsedMs / this.patienceMs;
    this.tipExact = this.tipMin + (this.tipMax - this.tipMin) * remaining;
    this.refreshTipDisplay();

    // Mood ramps green → yellow → red.
    const nextMood = remaining > 0.6 ? 'calm' : remaining > 0.3 ? 'antsy' : 'furious';
    if (nextMood !== this.mood) this.setMood(nextMood);

    if (this.elapsedMs >= this.patienceMs) {
      this.expired = true;
      return true;
    }
    return false;
  }

  setMood(mood) {
    this.mood = mood;
    if (mood === 'calm') {
      this.moodIcon.setVisible(false);
    } else {
      this.moodIcon.setVisible(!!this.isFront);
      if (mood === 'antsy') {
        this.moodIcon.setText('!');
        this.moodIcon.setColor('#f2d36b');
      } else if (mood === 'furious') {
        this.moodIcon.setText('‼');
        this.moodIcon.setColor('#ff4a2a');
      }
    }
    this.refreshBodyAnim();
  }

  /**
   * Trigger a talking animation toward a neighbor. `dir` is 'left' (chats
   * with the client to the left) or 'right' (chats with the right) or null
   * to clear. Talking overrides mood animation while set.
   */
  setTalking(dir) {
    if (this.talkDir === dir) return;
    this.talkDir = dir;
    this.refreshBodyAnim();
  }

  /** Pick the right body animation based on talkDir + mood. */
  refreshBodyAnim() {
    if (!this.isAlive) return;
    if (this.talkDir === 'left') {
      this.playState('talking_left');
    } else if (this.talkDir === 'right') {
      this.playState('talking_right');
    } else if (this.mood === 'furious') {
      this.playState('furious');
    } else if (this.mood === 'antsy') {
      this.playState('antsy');
    } else {
      this.playState('normal');
    }
  }

  refreshTipDisplay() {
    const rounded = Math.round(this.tipExact);
    this.tipText.setText(`$${rounded}`);
  }

  /** Take this client's tip and remove them. Returns the (rounded) tip value. */
  collectTip() {
    const tip = Math.max(0, Math.round(this.tipExact));
    this.isAlive = false;
    return tip;
  }

  leaveServed(onDone) {
    this.setMood('calm');
    this.setTalking(null);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 16,
      duration: 240,
      ease: 'Cubic.out',
      onComplete: () => {
        if (onDone) onDone();
        this.destroy();
      },
    });
  }

  leaveAngry(onDone) {
    this.isAlive = false;
    this.moodIcon.setVisible(false);
    // Stop animation so the storm-off pose is a single frame with the
    // furious mouth — looks more like a hard exit than a wiggling shake.
    this.body.anims.stop();
    this.body.setTexture('clients_atlas', frameName(this.character.id, 'furious', 0));
    this.body.setTint(0xff4a2a);
    this.body.setAlpha(1);
    this.scene.tweens.add({
      targets: this,
      x: this.x + 80,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.in',
      onComplete: () => {
        if (onDone) onDone();
        this.destroy();
      },
    });
  }
}
