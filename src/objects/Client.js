import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { CLIENT_VARIANTS } from '../scenes/BootScene.js';
import { pickRandomPreference, prefIconKey } from '../clientPreferences.js';
import { BEER_STYLES } from '../beerStyles.js';

const C = GAME_CONFIG.clients;

/**
 * A bar patron standing in line behind a tap. Carries a tip amount that
 * decays linearly over the patience window. The Client class is "dumb"
 * about queue position — the parent ClientQueue places/animates it.
 *
 * Public surface:
 *   .tipNow      — current tip value (rounded for display, exact internally)
 *   .isAlive     — false once leaveAngry() or leaveServed() runs
 *   .updatePatience(deltaMs) — call each frame; returns true if just expired
 *   .applyQueueSlot(slotIndex, anchorX) — place at queue position 0..N-1
 *   .leaveAngry(onDone) / .leaveServed(onDone) — exit animations
 */
export default class Client extends Phaser.GameObjects.Container {
  constructor(scene, x, y, wantedBeerStyle = null) {
    super(scene, x, y);
    scene.add.existing(this);

    this.variantKey = `client_${Phaser.Math.Between(0, CLIENT_VARIANTS.length - 1)}`;
    this.preference = pickRandomPreference();
    this.wantedBeerStyle = wantedBeerStyle || BEER_STYLES[0];
    this.elapsedMs = 0;
    this.patienceMs = C.patienceMs;
    this.tipMax = C.tipMax;
    this.tipMin = C.tipMin;
    this.tipExact = this.tipMax;
    this.isAlive = true;
    this.expired = false;

    // Body sprite. Origin at bottom-center so y is the "feet" anchor.
    this.body = scene.add.image(0, 0, this.variantKey);
    this.body.setOrigin(0.5, 1);
    this.body.setScale(C.queueScale);
    this.add(this.body);

    // Preference icon — mini glass pictogram colored to the wanted beer.
    this.prefIcon = scene.add.image(
      -14,
      -28 * C.queueScale - 16 - 10,
      prefIconKey(this.preference, this.wantedBeerStyle),
    );
    this.prefIcon.setOrigin(0.5, 0.5);
    this.prefIcon.setScale(1.4);
    this.add(this.prefIcon);

    // Tip text floating above the head, offset right of the icon.
    this.tipText = scene.add.text(8, -28 * C.queueScale - 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd93d',
      stroke: '#1a120a',
      strokeThickness: 3,
    });
    this.tipText.setOrigin(0.5, 1);
    this.add(this.tipText);

    // Patience bar (background + foreground).
    const barWidth = 36;
    const barHeight = 4;
    this.patienceBarBg = scene.add.rectangle(0, this.tipText.y + 4, barWidth, barHeight, 0x2a1f14, 1);
    this.patienceBarBg.setOrigin(0.5, 0);
    this.patienceBarBg.setStrokeStyle(1, 0x1a120a);
    this.patienceBar = scene.add.rectangle(-barWidth / 2 + 1, this.tipText.y + 5, barWidth - 2, barHeight - 2, 0x6acc4a, 1);
    this.patienceBar.setOrigin(0, 0);
    this.barWidth = barWidth - 2;
    this.add(this.patienceBarBg);
    this.add(this.patienceBar);

    this.refreshTipDisplay();
    this.spawnAnim();
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

  /**
   * Reposition for a slot in the queue. slotIndex 0 = front (at the tap),
   * 1, 2 = further back. Behind clients are smaller and dimmer.
   */
  applyQueueSlot(slotIndex, anchorX) {
    const targetX = anchorX + slotIndex * C.queueXOffset;
    const targetY = C.frontBottomY + slotIndex * C.queueYOffset;
    const scale = C.queueScale * Math.pow(C.queueScaleFalloff, slotIndex);
    const alpha = Math.pow(C.queueAlphaFalloff, slotIndex);

    // Hide tip text + patience bar for non-front clients to reduce clutter,
    // but keep the preference icon visible so the player can plan ahead.
    const isFront = slotIndex === 0;
    this.tipText.setVisible(isFront);
    this.patienceBar.setVisible(isFront);
    this.patienceBarBg.setVisible(isFront);
    this.prefIcon.setVisible(true);
    this.prefIcon.setScale(isFront ? 1.4 : 1.0);

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

  updatePatience(deltaMs) {
    if (!this.isAlive || this.expired) return false;
    this.elapsedMs = Math.min(this.elapsedMs + deltaMs, this.patienceMs);
    const remaining = 1 - this.elapsedMs / this.patienceMs;
    this.tipExact = this.tipMin + (this.tipMax - this.tipMin) * remaining;
    this.refreshTipDisplay();

    // Patience bar drains and shifts color from green → yellow → red.
    this.patienceBar.width = Math.max(0, this.barWidth * remaining);
    if (remaining > 0.6) this.patienceBar.fillColor = 0x6acc4a;
    else if (remaining > 0.3) this.patienceBar.fillColor = 0xf2d36b;
    else this.patienceBar.fillColor = 0xd44a2a;

    if (this.elapsedMs >= this.patienceMs) {
      this.expired = true;
      return true;
    }
    return false;
  }

  refreshTipDisplay() {
    const rounded = Math.round(this.tipExact);
    this.tipText.setText(`$${rounded}`);
  }

  /**
   * Take this client's tip and remove them. Returns the (rounded) tip value.
   */
  collectTip() {
    const tip = Math.max(0, Math.round(this.tipExact));
    this.isAlive = false;
    return tip;
  }

  leaveServed(onDone) {
    // Quick happy fade-down (got their beer).
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
    // Storm off to the right with a red flash.
    this.body.setTint(0xff4a2a);
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
