import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { BEER_STYLES } from '../beerStyles.js';

export default class Tap extends Phaser.GameObjects.Container {
  constructor(scene, x, y, streamTargetY, beerStyle = null) {
    super(scene, x, y);
    scene.add.existing(this);

    this.beerStyle = beerStyle || BEER_STYLES[0];
    this.isPouring = false;

    // Per-style texture keys; the BootScene generated `tap_<key>` etc.
    this.idleKey = `tap_${this.beerStyle.key}`;
    this.activeKey = `tap_${this.beerStyle.key}_active`;
    this.streamKey = `stream_${this.beerStyle.key}`;

    // Tap sprite (idle by default)
    this.body = scene.add.image(0, 0, this.idleKey);
    this.body.setScale(GAME_CONFIG.spriteScale);
    this.body.setOrigin(0.5, 0.5);
    this.add(this.body);

    // Beer stream — positioned from the tap spout down to the glass rim.
    const tapHalfHeight = (40 * GAME_CONFIG.spriteScale) / 2;
    const spoutOffsetY = tapHalfHeight - 4 * GAME_CONFIG.spriteScale + 2;
    const streamStartY = y + spoutOffsetY;
    const streamHeight = Math.max(0, streamTargetY - streamStartY);

    this.stream = scene.add.image(x, streamStartY, this.streamKey);
    this.stream.setOrigin(0.5, 0);
    this.stream.setDisplaySize(4, streamHeight);
    this.stream.setVisible(false);
    this.stream.setDepth(1);

    // Subtle splash dot at the impact point (only while pouring).
    // For dark beers we don't want a bright white splash — tint to beer color.
    this.splash = scene.add.image(x, streamTargetY, 'foam');
    this.splash.setDisplaySize(8, 3);
    this.splash.setVisible(false);
    this.splash.setDepth(2);
    if (this.beerStyle.key === 'stout' || this.beerStyle.key === 'red') {
      this.splash.setTint(this.beerStyle.liquidColor);
    }
  }

  startPour() {
    if (this.isPouring) return;
    this.isPouring = true;
    this.body.setTexture(this.activeKey);
    this.stream.setVisible(true);
    this.splash.setVisible(true);
  }

  stopPour() {
    if (!this.isPouring) return;
    this.isPouring = false;
    this.body.setTexture(this.idleKey);
    this.stream.setVisible(false);
    this.splash.setVisible(false);
  }
}
