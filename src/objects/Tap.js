import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { BEER_STYLES } from '../beerStyles.js';

export default class Tap extends Phaser.GameObjects.Container {
  constructor(scene, x, y, splashY, beerStyle = null, streamBottomY = null) {
    super(scene, x, y);
    scene.add.existing(this);

    this.beerStyle = beerStyle || BEER_STYLES[0];
    this.isPouring = false;
    this.elapsedMs = 0;

    // Per-style texture keys; the BootScene generated `tap_<key>` etc.
    this.idleKey = `tap_${this.beerStyle.key}`;
    this.activeKey = `tap_${this.beerStyle.key}_active`;
    this.streamKey = `stream_${this.beerStyle.key}`;

    // Tap sprite (idle by default)
    this.body = scene.add.image(0, 0, this.idleKey);
    this.body.setScale(GAME_CONFIG.spriteScale);
    this.body.setOrigin(0.5, 0.5);
    this.add(this.body);

    // Beer stream — runs from the tap spout down to the bottom of the cup
    // area (not just the rim). The glass walls + liquid fill cover the
    // portion that should be hidden, so the visible stream segment is
    // automatically the part between rim and current liquid surface.
    const tapHalfHeight = (40 * GAME_CONFIG.spriteScale) / 2;
    const spoutOffsetY = tapHalfHeight - 4 * GAME_CONFIG.spriteScale + 2;
    const streamStartY = y + spoutOffsetY;
    const streamEndY = streamBottomY != null ? streamBottomY : splashY;
    const streamHeight = Math.max(0, streamEndY - streamStartY);
    this.streamBaseX = x;
    this.streamStartY = streamStartY;
    this.streamTargetY = splashY;
    this.streamHeight = streamHeight;

    // TileSprite so we can scroll the texture downward to suggest flow.
    // Width is 8 display px (the source tile is 4 wide, scaled 2× via display size).
    const displayW = 8;
    this.stream = scene.add.tileSprite(x, streamStartY, displayW, streamHeight, this.streamKey);
    this.stream.setOrigin(0.5, 0);
    this.stream.setVisible(false);
    // Behind the glass + fill so the cup naturally covers the submerged part.
    this.stream.setDepth(-1);

    // Splash strip at the rim (where the stream first hits the cup).
    this.splash = scene.add.image(x, splashY, 'foam');
    this.splash.setDisplaySize(12, 3);
    this.splash.setVisible(false);
    this.splash.setDepth(2);
    if (this.beerStyle.key === 'stout' || this.beerStyle.key === 'red') {
      this.splash.setTint(this.beerStyle.liquidColor);
    }

    // Splash droplets — three small dots that orbit around the impact point.
    this.droplets = [];
    for (let i = 0; i < 3; i++) {
      const d = scene.add.image(x, splashY, 'foam');
      d.setDisplaySize(2, 2);
      d.setVisible(false);
      d.setDepth(2);
      if (this.beerStyle.key === 'stout' || this.beerStyle.key === 'red') {
        d.setTint(this.beerStyle.liquidColor);
      }
      this.droplets.push(d);
    }

    scene.events.on('update', this.onUpdate, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.onUpdate, this));
    scene.events.once('destroy', () => scene.events.off('update', this.onUpdate, this));
  }

  onUpdate(_time, delta) {
    if (!this.isPouring) return;
    this.elapsedMs += delta;

    // Scroll the tile downward to read as flowing liquid (~60 src px/sec).
    // Negative tilePositionY scrolls the source texture downward visually.
    this.stream.tilePositionY -= delta * 0.12;

    // Subtle horizontal wobble so the stream doesn't look like a rigid rod.
    const wobble = Math.sin(this.elapsedMs / 70) * 0.6;
    this.stream.x = this.streamBaseX + wobble;

    // Animate the splash strip — pulse width and alpha to suggest impact.
    const pulse = 0.85 + 0.15 * Math.sin(this.elapsedMs / 60);
    this.splash.setDisplaySize(12 * pulse, 3);
    this.splash.setAlpha(0.8 + 0.2 * Math.sin(this.elapsedMs / 90));

    // Animate splash droplets — three short-lived particles that float
    // outward + upward and loop on a stagger.
    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i];
      const phase = (this.elapsedMs / 1000 + i * 0.33) % 0.5; // 0..0.5s loop
      const t = phase / 0.5; // 0..1
      const angle = (i / this.droplets.length) * Math.PI - Math.PI; // upper hemisphere
      const radius = 6 + 8 * t;
      d.x = this.streamBaseX + Math.cos(angle) * radius;
      d.y = this.streamTargetY + Math.sin(angle) * radius * 0.6;
      d.setAlpha(1 - t);
    }
  }

  startPour() {
    if (this.isPouring) return;
    this.isPouring = true;
    this.elapsedMs = 0;
    this.body.setTexture(this.activeKey);
    this.stream.setVisible(true);
    this.splash.setVisible(true);
    this.droplets.forEach((d) => d.setVisible(true));
  }

  stopPour() {
    if (!this.isPouring) return;
    this.isPouring = false;
    this.body.setTexture(this.idleKey);
    this.stream.setVisible(false);
    this.splash.setVisible(false);
    this.droplets.forEach((d) => d.setVisible(false));
  }
}
