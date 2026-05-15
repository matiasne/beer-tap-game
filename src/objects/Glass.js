import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { pickRandomShape } from '../glassShapes.js';
import { BEER_STYLES } from '../beerStyles.js';

const SCALE = GAME_CONFIG.spriteScale;
const FOAM_COLOR = 0xfff4d6;
const FOAM_HIGHLIGHT = 0xffffff;
const FOAM_SHADOW = 0xe6d6a8;
const FOAM_BUBBLE_DARK = 0xc9b88a;

// Tiny deterministic PRNG so the foam's bubbles/edge are stable per-glass.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Per-tap glass. Picks one of 8 random shapes on construction. Tracks
 * two volumes:
 *
 *   fillLevel — liquid (% of total volume)
 *   foamLevel — foam   (% of total volume)
 *
 * Total = fillLevel + foamLevel. Overflow checks against total.
 *
 * Foam grows while pouring and settles (shrinks, partially converting
 * back to liquid) when idle. Rendering uses the shape's width profile so
 * both liquid and foam visually hug the glass.
 */
export default class Glass extends Phaser.GameObjects.Container {
  constructor(scene, x, y, shape = null, beerStyle = null) {
    super(scene, x, y);
    scene.add.existing(this);

    this.shape = shape || pickRandomShape();
    this.beerStyle = beerStyle || BEER_STYLES[0];
    this.fillLevel = 0; // liquid only
    this.foamLevel = 0; // foam only
    this.released = false;

    // Precompute cumulative volume per pixel row, bottom→top.
    const innerH = this.shape.innerHeightPx;
    const innerW = this.shape.innerWidthPx;
    this.volPerRow = new Array(innerH);
    this.cumVol = new Array(innerH);
    let acc = 0;
    for (let i = 0; i < innerH; i++) {
      const t = i / (innerH - 1);
      const w = Math.max(0, Math.min(1, this.shape.widthProfile(t)));
      this.volPerRow[i] = w;
      acc += w;
      this.cumVol[i] = acc;
    }
    this.totalVolume = acc;
    this.innerH = innerH;
    this.innerW = innerW;

    // Per-glass deterministic random — used for foam edge wave + bubble dots.
    this.rng = mulberry32(Math.floor(Math.random() * 1e9));
    // Precompute a wave pattern (one offset per "column" position).
    const colCount = Math.max(2, innerW);
    this.foamWave = new Array(colCount);
    for (let i = 0; i < colCount; i++) {
      this.foamWave[i] = Math.round(this.rng() * 2); // 0..2 px of extra height
    }
    // Precompute bubble dots (row offset 0..foamHeight-1, col 0..innerW-1).
    // Each entry: { rowFromTop, col, kind: 'dark'|'light' }.
    this.bubbles = [];
    for (let i = 0; i < 14; i++) {
      this.bubbles.push({
        rOff: this.rng(), // 0..1 — multiplied by current foam height at draw time
        cOff: this.rng(), // 0..1 — multiplied by current row width
        kind: this.rng() < 0.5 ? 'dark' : 'light',
      });
    }
    // Stable crown bubble offsets (computed once so they don't shimmer per-frame).
    this.crownBubbles = [];
    for (let i = 0; i < 5; i++) {
      this.crownBubbles.push({ rOff: this.rng(), cOff: this.rng() });
    }

    // Glass texture sprite.
    this.glassSprite = scene.add.image(0, 0, `glass_${this.shape.key}`);
    this.glassSprite.setScale(SCALE);
    this.glassSprite.setOrigin(0.5, 0.5);

    const halfH = this.shape.outerHeightPx / 2;
    this.innerBottomLocalY = (halfH - this.shape.bottomPaddingPx) * SCALE;
    this.innerTopLocalY = (-halfH + this.shape.topPaddingPx) * SCALE;

    this.fillGfx = scene.add.graphics();

    this.add(this.fillGfx);
    this.add(this.glassSprite);

    this.spawnAnim();
  }

  spawnAnim() {
    this.setScale(0.6);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.out',
    });
  }

  /**
   * Advance liquid + foam each frame.
   *   pouring=true  → add liquid at `pourRatePerSecond`, also grow foam.
   *   pouring=false → settle foam: shrink it, convert a fraction back to liquid.
   * Returns the new TOTAL level (liquid + foam) so the caller can detect overflow.
   */
  addFill(deltaMs, pourRatePerSecond, pouring, foamGrowthMultiplier = 1) {
    if (this.released) return this.fillLevel + this.foamLevel;
    const dt = deltaMs / 1000;
    const F = GAME_CONFIG.foam;

    if (pouring) {
      this.fillLevel += pourRatePerSecond * dt;
      this.foamLevel += F.growthPerSecond * foamGrowthMultiplier * dt;
    } else if (this.foamLevel > 0) {
      const shrink = Math.min(this.foamLevel, F.settlePerSecond * dt);
      this.foamLevel -= shrink;
      this.fillLevel += shrink * F.settleToLiquidRatio;
    }
    this.refreshFill();
    return this.fillLevel + this.foamLevel;
  }

  /** Total fill % (liquid + foam). */
  get totalLevel() {
    return this.fillLevel + this.foamLevel;
  }

  refreshFill() {
    this.fillGfx.clear();

    const liquidPct = Math.max(0, this.fillLevel);
    const foamPct = Math.max(0, this.foamLevel);
    const totalPct = liquidPct + foamPct;
    if (totalPct <= 0) return;

    // Liquid never goes past the rim visually — if it does it's an overflow.
    const visLiquidPct = Math.min(liquidPct, GAME_CONFIG.glassCapacity);
    // Foam can go up to (capacity - liquid) inside the glass + overshoot above the rim.
    const insideFoamRoom = GAME_CONFIG.glassCapacity - visLiquidPct;
    const visInsideFoamPct = Math.min(foamPct, insideFoamRoom);
    const aboveRimFoamPct = Math.max(0, foamPct - visInsideFoamPct);

    const liquidTargetVol =
      (visLiquidPct / GAME_CONFIG.glassCapacity) * this.totalVolume;
    const visTotalPct = visLiquidPct + visInsideFoamPct;
    const totalTargetVol =
      (visTotalPct / GAME_CONFIG.glassCapacity) * this.totalVolume;

    // --- Liquid: rows 0..liquidTopRow (+ a partial row) ---
    const liquidColor = this.beerStyle.liquidColor;
    const liquidEdge = this.beerStyle.liquidEdgeColor;
    const { topRow: liquidTopRow, partial: liquidPartial } = this.volumeToRow(
      liquidTargetVol,
    );
    for (let i = 0; i <= liquidTopRow; i++) {
      this.drawRow(i, this.volPerRow[i], 1, liquidColor, liquidEdge);
    }
    if (liquidPartial > 0 && liquidTopRow + 1 < this.innerH) {
      this.drawRow(
        liquidTopRow + 1,
        this.volPerRow[liquidTopRow + 1],
        liquidPartial,
        liquidColor,
        liquidEdge,
      );
    }

    // --- Foam inside the glass ---
    if (visInsideFoamPct > 0) {
      const foamStart = this.volumeToRow(liquidTargetVol);
      const foamEnd = this.volumeToRow(totalTargetVol);
      this.drawFoam(foamStart, foamEnd);
    }

    // --- Foam crown above the rim ---
    // Map the above-rim foam % to source-pixel height; reuses the same
    // "% volume → pixels" ratio as the inside rows so it visually matches.
    if (aboveRimFoamPct > 0) {
      // Max overshoot in source pixels — uses the foam config allowance as
      // the upper bound of how tall the crown can be.
      const maxOvershootPx = Math.max(
        2,
        Math.round(
          (GAME_CONFIG.foamOvershootAllowance / GAME_CONFIG.glassCapacity) *
            this.innerH,
        ) * 1.4, // a little extra room for the rounded mound
      );
      const overshootRatio = Math.min(
        1,
        aboveRimFoamPct / GAME_CONFIG.foamOvershootAllowance,
      );
      const overshootPx = Math.max(1, Math.round(maxOvershootPx * overshootRatio));
      this.drawCrownAboveRim(overshootPx);
    }
  }

  /**
   * Draw a domed foam crown sitting on top of the glass rim. The crown
   * narrows as it rises (mound profile) and gets the same bubbly/wavy
   * treatment as in-glass foam.
   */
  drawCrownAboveRim(overshootSrcPx) {
    // Use the topmost row's width as the base of the mound.
    const baseWidthFrac = this.volPerRow[this.innerH - 1];
    const baseHalfPx = Math.max(1, Math.round((this.innerW * baseWidthFrac) / 2));

    // Rim Y in container-local coords (top of the topmost inner row).
    const rimY = this.innerBottomLocalY - this.innerH * SCALE;

    // Draw the mound row-by-row, narrowing toward the top. Use a quarter-sine
    // shape so the dome looks rounded, not triangular.
    for (let r = 0; r < overshootSrcPx; r++) {
      const t = (r + 1) / overshootSrcPx; // 0..1 up the mound
      const widthFrac = Math.cos((Math.PI * t) / 2); // 1→0 (rounded)
      const halfPx = Math.max(0, Math.round(baseHalfPx * widthFrac));
      if (halfPx <= 0) continue;
      const w = halfPx * 2 * SCALE;
      const x = -halfPx * SCALE;
      const y = rimY - (r + 1) * SCALE;
      this.fillGfx.fillStyle(FOAM_COLOR, 1);
      this.fillGfx.fillRect(x, y, w, SCALE);
      // Soft shadow on the lower edge of the row for depth.
      this.fillGfx.fillStyle(FOAM_SHADOW, 0.5);
      this.fillGfx.fillRect(x, y + SCALE - 1, w, 1);
    }

    // A few bubble highlights scattered through the mound (stable per glass).
    for (const b of this.crownBubbles) {
      const r = Math.floor(b.rOff * overshootSrcPx);
      const t = (r + 1) / overshootSrcPx;
      const widthFrac = Math.cos((Math.PI * t) / 2);
      const halfPx = Math.max(0, Math.round(baseHalfPx * widthFrac));
      if (halfPx <= 0) continue;
      const col = Math.floor(b.cOff * (halfPx * 2));
      const x = -halfPx * SCALE + col * SCALE;
      const y = rimY - (r + 1) * SCALE;
      this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.85);
      this.fillGfx.fillRect(x, y, Math.max(1, SCALE - 1), Math.max(1, SCALE - 1));
    }
  }

  /**
   * Given a volume target, return { topRow, partial } where topRow is the
   * last fully-covered row index (or -1 if none) and partial is the
   * fractional fill (0..1) of the row above topRow.
   */
  volumeToRow(targetVol) {
    let topRow = -1;
    for (let i = 0; i < this.innerH; i++) {
      if (this.cumVol[i] <= targetVol) topRow = i;
      else break;
    }
    let partial = 0;
    if (topRow + 1 < this.innerH) {
      const consumed = topRow >= 0 ? this.cumVol[topRow] : 0;
      const sliceVol = this.volPerRow[topRow + 1];
      partial = sliceVol > 0 ? (targetVol - consumed) / sliceVol : 0;
      partial = Math.max(0, Math.min(1, partial));
    }
    return { topRow, partial };
  }

  drawRow(rowIdx, widthFrac, heightFrac, color, edge) {
    const halfPx = Math.max(1, Math.round((this.innerW * widthFrac) / 2));
    const w = halfPx * 2 * SCALE;
    const h = SCALE * heightFrac;
    const x = -halfPx * SCALE;
    const y = this.innerBottomLocalY - rowIdx * SCALE - h;
    this.fillGfx.fillStyle(color, 1);
    this.fillGfx.fillRect(x, y, w, h);
    this.fillGfx.fillStyle(edge, 0.6);
    this.fillGfx.fillRect(x, y, 1, h);
    this.fillGfx.fillRect(x + w - 1, y, 1, h);
  }

  /**
   * Draw foam from `start` (top of liquid) up to `end` (top of total).
   * Body is plain foam rows; the topmost row has an irregular wavy edge
   * and bubble texture dots scattered through the foam body.
   */
  drawFoam(start, end) {
    // Compute the inclusive band of full foam rows and the partial top row.
    // Convert (topRow, partial) pairs to a single "fractional row top" value.
    const startRowFrac = start.topRow + start.partial; // y in row-units where liquid ends
    const endRowFrac = end.topRow + end.partial;       // y in row-units where total ends
    if (endRowFrac <= startRowFrac + 0.001) return;

    // Full rows between startRowFrac and endRowFrac.
    const firstFoamRow = Math.max(0, Math.ceil(startRowFrac));
    const lastFoamRow = Math.min(this.innerH - 1, Math.floor(endRowFrac));

    // Draw the partial slice at the bottom of the foam (if any).
    if (startRowFrac < firstFoamRow && start.topRow + 1 < this.innerH) {
      const sliceHeight = firstFoamRow - startRowFrac;
      const rowIdx = start.topRow + 1; // row that holds the partial liquid + partial foam
      // The liquid already painted partial of this row; draw the foam slice on top of it.
      this.drawRowSlice(
        rowIdx,
        this.volPerRow[rowIdx],
        start.partial,
        start.partial + sliceHeight,
        FOAM_COLOR,
        FOAM_SHADOW,
      );
    }

    // Draw full foam rows.
    for (let i = firstFoamRow; i <= lastFoamRow; i++) {
      this.drawRow(i, this.volPerRow[i], 1, FOAM_COLOR, FOAM_SHADOW);
    }

    // Draw the partial slice at the top (foam crown).
    let crownRowIdx;
    let crownPartial;
    if (endRowFrac > lastFoamRow && lastFoamRow + 1 < this.innerH) {
      crownRowIdx = lastFoamRow + 1;
      crownPartial = endRowFrac - lastFoamRow;
      this.drawRow(crownRowIdx, this.volPerRow[crownRowIdx], crownPartial, FOAM_COLOR, FOAM_SHADOW);
    } else {
      crownRowIdx = lastFoamRow;
      crownPartial = 1;
    }

    // --- Texture: wavy top edge ---
    // Stipple a few extra/missing pixels along the crown's top to suggest
    // irregular foam. Limited to within the row width.
    const crownWidthFrac =
      crownRowIdx >= 0 && crownRowIdx < this.innerH ? this.volPerRow[crownRowIdx] : 0;
    if (crownWidthFrac > 0) {
      const crownHalfPx = Math.max(1, Math.round((this.innerW * crownWidthFrac) / 2));
      const crownW = crownHalfPx * 2; // in source pixels
      const crownXLeft = -crownHalfPx * SCALE;
      // Y of the very top of the crown:
      const crownTopY =
        this.innerBottomLocalY -
        crownRowIdx * SCALE -
        crownPartial * SCALE;
      // Add light highlights above the crown for "peaks" and dark notches below for "valleys".
      for (let c = 0; c < crownW; c++) {
        const wave = this.foamWave[c % this.foamWave.length];
        if (wave > 0) {
          // Peak: extend foam above the crown by `wave` source pixels (each = SCALE display px).
          this.fillGfx.fillStyle(FOAM_COLOR, 1);
          this.fillGfx.fillRect(
            crownXLeft + c * SCALE,
            crownTopY - wave * SCALE,
            SCALE,
            wave * SCALE,
          );
          // Highlight on the very top
          this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.8);
          this.fillGfx.fillRect(
            crownXLeft + c * SCALE,
            crownTopY - wave * SCALE,
            SCALE,
            1,
          );
        }
      }
    }

    // --- Texture: bubble dots inside the foam body ---
    const foamTopFrac = endRowFrac;
    const foamBottomFrac = Math.max(startRowFrac, 0);
    const foamThicknessRows = Math.max(0, foamTopFrac - foamBottomFrac);
    if (foamThicknessRows > 0.5) {
      for (const b of this.bubbles) {
        // Place the bubble within the foam band.
        const rowFrac = foamBottomFrac + b.rOff * foamThicknessRows;
        const rowIdxBubble = Math.floor(rowFrac);
        if (rowIdxBubble < 0 || rowIdxBubble >= this.innerH) continue;
        const widthFrac = this.volPerRow[rowIdxBubble];
        if (widthFrac <= 0) continue;
        const halfPx = Math.max(1, Math.round((this.innerW * widthFrac) / 2));
        const col = Math.floor(b.cOff * (halfPx * 2));
        const x = -halfPx * SCALE + col * SCALE;
        const y =
          this.innerBottomLocalY - rowIdxBubble * SCALE - (rowFrac - rowIdxBubble) * SCALE;
        if (b.kind === 'dark') {
          this.fillGfx.fillStyle(FOAM_BUBBLE_DARK, 0.7);
          this.fillGfx.fillRect(x, y, SCALE, SCALE);
        } else {
          this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.9);
          this.fillGfx.fillRect(x, y, Math.max(1, SCALE - 1), Math.max(1, SCALE - 1));
        }
      }
    }
  }

  /**
   * Draw a sub-slice of a row between `fromFrac` and `toFrac` (0..1, measured
   * from the bottom of the row). Used to overlay foam on the same row that
   * also holds the partial liquid slice.
   */
  drawRowSlice(rowIdx, widthFrac, fromFrac, toFrac, color, edge) {
    if (toFrac <= fromFrac) return;
    const halfPx = Math.max(1, Math.round((this.innerW * widthFrac) / 2));
    const w = halfPx * 2 * SCALE;
    const x = -halfPx * SCALE;
    const yBottom = this.innerBottomLocalY - rowIdx * SCALE; // bottom of this row
    const yTop = yBottom - toFrac * SCALE;
    const h = (toFrac - fromFrac) * SCALE;
    this.fillGfx.fillStyle(color, 1);
    this.fillGfx.fillRect(x, yTop, w, h);
    this.fillGfx.fillStyle(edge, 0.6);
    this.fillGfx.fillRect(x, yTop, 1, h);
    this.fillGfx.fillRect(x + w - 1, yTop, 1, h);
  }

  /**
   * Overflow recovery — the bartender dunks the glass under the bar to
   * dump it and brings it back up empty. Same shape/beer style, just
   * reset contents. Locks input during the animation.
   */
  dumpAndReset(onDone) {
    if (this.released) return;
    this.released = true; // pause addFill / refresh during the dunk

    const downDuration = Math.round(GAME_CONFIG.glassReleaseDuration * 0.4);
    const upDuration = Math.round(GAME_CONFIG.glassReleaseDuration * 0.5);
    const restY = this.y;

    this.scene.tweens.add({
      targets: this,
      y: restY + 60,
      alpha: 0,
      duration: downDuration,
      ease: 'Cubic.in',
      onComplete: () => {
        // Empty the glass while it's hidden below the bar.
        this.fillLevel = 0;
        this.foamLevel = 0;
        this.refreshFill();
        this.scene.tweens.add({
          targets: this,
          y: restY,
          alpha: 1,
          duration: upDuration,
          ease: 'Back.out',
          onComplete: () => {
            this.released = false;
            if (onDone) onDone();
          },
        });
      },
    });
  }

  release(onDone) {
    if (this.released) return;
    this.released = true;

    // Stage 1: brief zoom-up + lift — like the bartender raises the glass.
    // Stage 2: slide off the right edge of the screen, fading out.
    const zoomDuration = Math.round(GAME_CONFIG.glassReleaseDuration * 0.35);
    const slideDuration = GAME_CONFIG.glassReleaseDuration - zoomDuration;

    this.scene.tweens.add({
      targets: this,
      scale: 1.2,
      y: this.y - 18,
      duration: zoomDuration,
      ease: 'Sine.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          x: 900, // off the right edge of the 800-wide canvas
          alpha: 0,
          duration: slideDuration,
          ease: 'Cubic.in',
          onComplete: () => {
            if (onDone) onDone();
            this.destroy();
          },
        });
      },
    });
  }
}
