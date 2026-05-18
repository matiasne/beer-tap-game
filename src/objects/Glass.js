import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { pickRandomShape } from '../glassShapes.js';
import { BEER_STYLES } from '../beerStyles.js';

const SCALE = GAME_CONFIG.glassSpriteScale ?? GAME_CONFIG.spriteScale;
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

    // --- Lumpy crown profile ---
    // The top edge of the foam reads as a sequence of bubble-cluster
    // "lumps" rather than per-column noise. Each lump spans `width`
    // columns and rises `height` source pixels above the base foam line.
    // Lumps are stable per glass.
    const lumps = [];
    let col = -1; // start a hair to the left so the leftmost lump can poke out
    while (col < innerW + 2) {
      const lumpW = 3 + Math.floor(this.rng() * 4); // 3..6 src px wide
      const lumpH = 2 + Math.floor(this.rng() * 4); // 2..5 src px tall
      lumps.push({ col, width: lumpW, height: lumpH });
      col += lumpW + (this.rng() < 0.3 ? 1 : 0); // occasional 1-col valley
    }
    this.foamLumps = lumps;

    // Bubble blobs — proper little circle-ish shapes rather than single
    // pixels. Each bubble has a row/col offset (0..1, multiplied at draw
    // time) and a radius of 1 or 2 source pixels. Radius-2 bubbles get a
    // dark outline ring + bright center; radius-1 are single dots.
    // Divisor scales with inner area (innerW × innerH). Original baseline at
    // ~800 was tuned for ~22×38 inner; the new 2× resolution makes that
    // ~3200. Keeps bubble density per visible pixel roughly constant.
    const areaFactor = Math.max(1, Math.round((innerW * innerH) / 3200));
    const bubbleCount = 14 * areaFactor;
    this.bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
      this.bubbles.push({
        rOff: this.rng(),
        cOff: this.rng(),
        // ~30% are bigger ringed bubbles, the rest are small dots.
        radius: this.rng() < 0.3 ? 2 : 1,
        kind: this.rng() < 0.4 ? 'dark' : 'light',
      });
    }
    // Stable crown bubble offsets (computed once so they don't shimmer per-frame).
    const crownCount = 6 * areaFactor;
    this.crownBubbles = [];
    for (let i = 0; i < crownCount; i++) {
      this.crownBubbles.push({
        rOff: this.rng(),
        cOff: this.rng(),
        radius: this.rng() < 0.4 ? 2 : 1,
      });
    }

    // Foam curtain — every source-pixel column across the rim gets a
    // downward foam strip with a varied "max drip length" so the bottom
    // edge reads as wavy/dripping rather than a flat skirt. A few stable
    // columns are tagged as "heavy" — they hang the lowest and get a
    // cartoony teardrop bead at the tip when at full overshoot.
    const topHalfFracInit = this.volPerRow[innerH - 1];
    const topHalfPxInit = Math.max(1, Math.round((innerW * topHalfFracInit) / 2));
    // Span: rim width (2 × topHalfPx) + 2 rim "ears" + 1 px extra spill
    // on each side so the curtain visibly hangs over the lip outline.
    const curtainCols = topHalfPxInit * 2 + 4;
    this.foamCurtain = new Array(curtainCols);
    for (let i = 0; i < curtainCols; i++) {
      // Most columns hang short; a smaller fraction are medium; a few are heavy.
      const roll = this.rng();
      let maxLenFrac;
      let heavy = false;
      if (roll < 0.55) {
        // Short fringe — base curtain that's always present.
        maxLenFrac = 0.05 + this.rng() * 0.12; // 5%-17%
      } else if (roll < 0.88) {
        // Medium drips — visible mid-pour.
        maxLenFrac = 0.18 + this.rng() * 0.22; // 18%-40%
      } else {
        // Heavy runs — the dramatic long drips with beads.
        maxLenFrac = 0.45 + this.rng() * 0.5; // 45%-95%
        heavy = true;
      }
      this.foamCurtain[i] = {
        maxLenFrac,
        heavy,
        // Some columns wait for more overshoot before appearing so the
        // curtain "grows" from the rim outward.
        startThreshold: this.rng() * 0.25,
      };
    }

    // All glasses share the same bottom baseline so they sit flat on the
    // bar regardless of their outer height. Baseline = half of the tallest
    // glass; shorter glasses get shifted down in local space so their
    // bottoms land at the same screen Y as the tallest one.
    const BASELINE_HALF_H = 232 / 2; // tallest outerHeightPx in glassShapes (weizen)
    const halfH = this.shape.outerHeightPx / 2;
    const bottomBaselineOffset = (BASELINE_HALF_H - halfH) * SCALE;

    // Glass texture sprite — origin centered, then shifted so the sprite
    // bottom lines up with the shared baseline.
    this.glassSprite = scene.add.image(0, bottomBaselineOffset, `glass_${this.shape.key}`);
    this.glassSprite.setScale(SCALE);
    this.glassSprite.setOrigin(0.5, 0.5);

    this.innerBottomLocalY = (halfH - this.shape.bottomPaddingPx) * SCALE + bottomBaselineOffset;
    this.innerTopLocalY = (-halfH + this.shape.topPaddingPx) * SCALE + bottomBaselineOffset;

    this.fillGfx = scene.add.graphics();
    // Drips are drawn ON TOP of the glass sprite so the foam runs visibly
    // over the outside of the cup rather than hiding behind the outline.
    this.dripGfx = scene.add.graphics();

    this.add(this.fillGfx);
    this.add(this.glassSprite);
    this.add(this.dripGfx);

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
      const shapeFoamFactor = this.shape.foamFactor ?? 1;
      this.foamLevel +=
        F.growthPerSecond * foamGrowthMultiplier * shapeFoamFactor * dt;
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
    this.dripGfx.clear();

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

    // --- Liquid surface ellipse — only visible when foam isn't covering ---
    // A tilted ellipse line drawn at the top of the liquid showing the
    // surface of the beer when viewed slightly from above. The back arc
    // is dark (deep liquid), the front edge bright (catches the light).
    if (liquidTargetVol > 0 && visInsideFoamPct <= 0.5) {
      const surfaceRow = liquidPartial > 0 ? liquidTopRow + 1 : liquidTopRow;
      const surfacePartial = liquidPartial > 0 ? liquidPartial : 1;
      if (surfaceRow >= 0 && surfaceRow < this.innerH) {
        this.drawLiquidSurface(surfaceRow, surfacePartial, liquidColor, liquidEdge);
      }
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
      // Cap the mound height relative to its BASE WIDTH, not glass height.
      // A dome that's taller than ~70% of its half-width starts to look
      // conical regardless of profile, so we hard-clamp it.
      const baseWidthFrac = this.volPerRow[this.innerH - 1];
      const baseHalfPx = Math.max(1, Math.round((this.innerW * baseWidthFrac) / 2));
      const heightFromGlass = Math.round(
        (GAME_CONFIG.foamOvershootAllowance / GAME_CONFIG.glassCapacity) *
          this.innerH,
      ) * 1.4;
      const heightFromBase = Math.round(baseHalfPx * 0.7); // dome aspect cap
      const maxOvershootPx = Math.max(2, Math.min(heightFromGlass, heightFromBase));
      const overshootRatio = Math.min(
        1,
        aboveRimFoamPct / GAME_CONFIG.foamOvershootAllowance,
      );
      const overshootPx = Math.max(1, Math.round(maxOvershootPx * overshootRatio));
      this.drawCrownAboveRim(overshootPx);
      // Foam runs down the outside of the cup. Driven by the same overshoot
      // ratio so drips lengthen progressively before the overflow trigger.
      this.drawFoamCurtain(overshootRatio);
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
    // The crown is drawn into `dripGfx` (above the glass sprite) so it
    // sits on top of the rim outline, matching the curtain below.
    const rimY = this.innerBottomLocalY - this.innerH * SCALE;
    const g = this.dripGfx;

    // Mound profile per row — half-ellipse so the silhouette stays wide
    // through most of the height and only narrows near the very top.
    // `cos((π/2)·t)` was too conical at large overshoots — it pinched to
    // a point. `sqrt(1 - t²)` bulges outward like a real foam dome.
    const halfByOvershootRow = new Array(overshootSrcPx);
    for (let r = 0; r < overshootSrcPx; r++) {
      const t = (r + 1) / overshootSrcPx;
      const widthFrac = Math.sqrt(Math.max(0, 1 - t * t));
      halfByOvershootRow[r] = Math.max(0, Math.round(baseHalfPx * widthFrac));
    }

    // Body of the mound — flat cream rows with a soft shadow stripe
    // on the lower edge for depth.
    for (let r = 0; r < overshootSrcPx; r++) {
      const halfPx = halfByOvershootRow[r];
      if (halfPx <= 0) continue;
      const w = halfPx * 2 * SCALE;
      const x = -halfPx * SCALE;
      const y = rimY - (r + 1) * SCALE;
      g.fillStyle(FOAM_COLOR, 1);
      g.fillRect(x, y, w, SCALE);
      g.fillStyle(FOAM_SHADOW, 0.5);
      g.fillRect(x, y + SCALE - 1, w, 1);
    }

    // Top highlight band — brighten the upper third of the mound so the
    // crown reads as catching the light.
    const brightStart = Math.floor(overshootSrcPx * 0.6);
    for (let r = brightStart; r < overshootSrcPx; r++) {
      const halfPx = halfByOvershootRow[r];
      if (halfPx <= 0) continue;
      const w = halfPx * 2 * SCALE;
      const x = -halfPx * SCALE;
      const y = rimY - (r + 1) * SCALE;
      g.fillStyle(FOAM_HIGHLIGHT, 0.3);
      g.fillRect(x, y, w, SCALE);
    }

    // Bubble blobs throughout the mound — bigger ringed ones + small dots.
    // drawFoamBubble writes to fillGfx; for the crown we want them on top
    // of the glass too, so call it after temporarily swapping the target.
    const fillGfx = this.fillGfx;
    this.fillGfx = g;
    try {
      for (const b of this.crownBubbles) {
        const r = Math.floor(b.rOff * overshootSrcPx);
        const halfPx = halfByOvershootRow[r];
        if (halfPx <= 0) continue;
        const innerWPx = halfPx * 2;
        const col = Math.max(0, Math.min(innerWPx - 1, Math.floor(b.cOff * innerWPx)));
        const x = -halfPx * SCALE + col * SCALE;
        const y = rimY - (r + 1) * SCALE;
        const radius = innerWPx >= 4 ? b.radius : 1;
        this.drawFoamBubble(x, y, radius, 'light');
      }
    } finally {
      this.fillGfx = fillGfx;
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
    const innerWidth = halfPx * 2;
    const w = innerWidth * SCALE;
    const h = SCALE * heightFrac;
    const x = -halfPx * SCALE;
    const y = this.innerBottomLocalY - rowIdx * SCALE - h;
    // Base fill
    this.fillGfx.fillStyle(color, 1);
    this.fillGfx.fillRect(x, y, w, h);
    // Side edges (slight darkening at the walls).
    this.fillGfx.fillStyle(edge, 0.6);
    this.fillGfx.fillRect(x, y, 1, h);
    this.fillGfx.fillRect(x + w - 1, y, 1, h);
    // Wide highlight + shadow bands — simulates a single light source
    // hitting the glass from the upper-left. Liquid uses a brighter
    // (lighter) tint and a stronger shadow; foam keeps it subtle.
    const isFoam = color === FOAM_COLOR;
    if (innerWidth >= 6) {
      const highlightCol = Math.floor(innerWidth * 0.22);
      const highlightW = Math.max(2, Math.floor(innerWidth * 0.12));
      const shadowCol = Math.floor(innerWidth * 0.72);
      const shadowW = Math.max(2, Math.floor(innerWidth * 0.14));
      if (isFoam) {
        this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.28);
        this.fillGfx.fillRect(x + highlightCol * SCALE, y, highlightW * SCALE, h);
        this.fillGfx.fillStyle(edge, 0.28);
        this.fillGfx.fillRect(x + shadowCol * SCALE, y, shadowW * SCALE, h);
      } else {
        this.fillGfx.fillStyle(0xffffff, 0.18);
        this.fillGfx.fillRect(x + highlightCol * SCALE, y, highlightW * SCALE, h);
        this.fillGfx.fillStyle(edge, 0.45);
        this.fillGfx.fillRect(x + shadowCol * SCALE, y, shadowW * SCALE, h);
      }
    }
  }

  /**
   * Paint the elliptical liquid surface at the top of the fill. Reads as
   * "seeing slightly into the cup from above". Shape:
   *
   *   ─ ─ ─ ─ ─ ─ ─    back-arc row (1 src px above surface) — dark liquid edge
   *   ░ ░ ░ ░ ░ ░ ░    surface front row — bright highlight catching light
   *
   * The back arc shows the rear of the liquid surface curving up; the
   * highlight row sits at the very top of the liquid front-face.
   */
  drawLiquidSurface(rowIdx, partialFrac, liquidColor, liquidEdge) {
    const widthFrac = this.volPerRow[rowIdx];
    const halfPx = Math.max(1, Math.round((this.innerW * widthFrac) / 2));
    const innerWidth = halfPx * 2;
    // y of the top of the (possibly partial) row.
    const yTop = this.innerBottomLocalY - rowIdx * SCALE - partialFrac * SCALE;

    // Back arc — 1 src px above yTop, slightly narrower than the row.
    // Glasses too narrow don't get a separate back arc (would just be 1 dot).
    if (innerWidth >= 6) {
      const backInset = Math.max(1, Math.floor(innerWidth * 0.12));
      const backW = innerWidth - backInset * 2;
      this.fillGfx.fillStyle(liquidEdge, 0.85);
      this.fillGfx.fillRect(
        -halfPx * SCALE + backInset * SCALE,
        yTop - SCALE,
        backW * SCALE,
        SCALE,
      );
    }

    // Front-face highlight along the very top row of the liquid.
    // Bright pale strip that reads as light catching the meniscus.
    this.fillGfx.fillStyle(0xffffff, 0.4);
    this.fillGfx.fillRect(
      -halfPx * SCALE + SCALE,
      yTop,
      (innerWidth - 2) * SCALE,
      Math.max(1, Math.floor(SCALE / 2)),
    );

    // Tiny sparkle on the upper-left of the surface for shine.
    if (innerWidth >= 8) {
      this.fillGfx.fillStyle(0xffffff, 0.9);
      this.fillGfx.fillRect(
        -halfPx * SCALE + Math.floor(innerWidth * 0.25) * SCALE,
        yTop,
        SCALE,
        Math.max(1, Math.floor(SCALE / 2)),
      );
    }
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

    // --- Vertical gradient inside the foam body ---
    // Top rows brighten toward pure white; bottom rows darken toward
    // cream/tan. Reads as a real foam layer with light catching the crown.
    const foamTopFracG = endRowFrac;
    const foamBottomFracG = Math.max(startRowFrac, 0);
    const foamRowsG = Math.max(0, foamTopFracG - foamBottomFracG);
    if (foamRowsG > 0.5) {
      const topY = this.innerBottomLocalY - foamTopFracG * SCALE;
      const botY = this.innerBottomLocalY - foamBottomFracG * SCALE;
      const heightDisplay = botY - topY;
      // Brightening band — top quarter, white at 0.35 alpha fading down.
      const brightH = Math.max(SCALE, Math.round(heightDisplay * 0.28));
      // Use the topmost foam row's profile to clip the band width-wise.
      const clipRow = Math.min(this.innerH - 1, Math.max(0, Math.floor(foamTopFracG) - 1));
      const clipWidthFrac = this.volPerRow[clipRow] ?? 1;
      const clipHalfPx = Math.max(1, Math.round((this.innerW * clipWidthFrac) / 2));
      this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.32);
      this.fillGfx.fillRect(-clipHalfPx * SCALE, topY, clipHalfPx * 2 * SCALE, brightH);
      // Darkening band — bottom quarter, foam-shadow tint.
      const darkH = Math.max(SCALE, Math.round(heightDisplay * 0.25));
      const darkRow = Math.min(this.innerH - 1, Math.max(0, Math.floor(foamBottomFracG)));
      const darkWidthFrac = this.volPerRow[darkRow] ?? 1;
      const darkHalfPx = Math.max(1, Math.round((this.innerW * darkWidthFrac) / 2));
      this.fillGfx.fillStyle(FOAM_SHADOW, 0.45);
      this.fillGfx.fillRect(-darkHalfPx * SCALE, botY - darkH, darkHalfPx * 2 * SCALE, darkH);
    }

    // --- Lumpy top edge ---
    // Each lump is a cluster of foam pixels that pokes up above the crown
    // row, with rounded shoulders so it reads as a bubble cluster rather
    // than a square block.
    const crownWidthFrac =
      crownRowIdx >= 0 && crownRowIdx < this.innerH ? this.volPerRow[crownRowIdx] : 0;
    if (crownWidthFrac > 0) {
      const crownHalfPx = Math.max(1, Math.round((this.innerW * crownWidthFrac) / 2));
      const crownW = crownHalfPx * 2;
      const crownXLeft = -crownHalfPx * SCALE;
      const crownTopY =
        this.innerBottomLocalY -
        crownRowIdx * SCALE -
        crownPartial * SCALE;
      this.drawFoamLumps(crownXLeft, crownTopY, crownW);
    }

    // --- Bubble blobs inside the foam body ---
    const foamTopFrac = endRowFrac;
    const foamBottomFrac = Math.max(startRowFrac, 0);
    const foamThicknessRows = Math.max(0, foamTopFrac - foamBottomFrac);
    if (foamThicknessRows > 0.5) {
      for (const b of this.bubbles) {
        const rowFrac = foamBottomFrac + b.rOff * foamThicknessRows;
        const rowIdxBubble = Math.floor(rowFrac);
        if (rowIdxBubble < 0 || rowIdxBubble >= this.innerH) continue;
        const widthFrac = this.volPerRow[rowIdxBubble];
        if (widthFrac <= 0) continue;
        const halfPx = Math.max(1, Math.round((this.innerW * widthFrac) / 2));
        // Inset a hair so bubbles don't hug the wall.
        const innerW = halfPx * 2;
        const col = 1 + Math.floor(b.cOff * Math.max(1, innerW - 2));
        const x = -halfPx * SCALE + col * SCALE;
        const y =
          this.innerBottomLocalY - rowIdxBubble * SCALE - (rowFrac - rowIdxBubble) * SCALE;
        this.drawFoamBubble(x, y, b.radius, b.kind);
      }
    }
  }

  /**
   * Paint the lumpy top edge of the foam — a row of bubble clusters
   * that pokes up above the crown. Each lump is a rounded mound (wider
   * at the base, narrower on top) with a bright crown pixel.
   */
  drawFoamLumps(crownXLeft, crownTopY, crownW) {
    for (const lump of this.foamLumps) {
      const lumpW = lump.width;
      const lumpH = lump.height;
      const cxLump = (lump.col + (lumpW - 1) / 2);
      // Half-width of the lump's base; we narrow each row toward the top
      // using a quarter-cosine profile so the silhouette is a rounded dome
      // (no pointy tip, no triangular taper).
      const baseHalf = (lumpW - 1) / 2;
      for (let r = 0; r < lumpH; r++) {
        // t goes 0 (base) → 1 (top of lump). cos((π/2)·t) curves 1 → 0
        // smoothly, with a fast drop near the top.
        const t = r / Math.max(1, lumpH);
        const halfThisRow = Math.max(0, baseHalf * Math.cos((Math.PI / 2) * t));
        // Snap to integer columns, but bias toward keeping the top row 1+ px wide.
        const halfRounded = r === lumpH - 1
          ? Math.max(0, Math.round(halfThisRow - 0.1))
          : Math.round(halfThisRow);
        const left = Math.floor(cxLump - halfRounded);
        const right = Math.ceil(cxLump + halfRounded);
        if (right < left) continue;
        for (let c = left; c <= right; c++) {
          if (c < 0 || c >= crownW) continue;
          const px = crownXLeft + c * SCALE;
          const py = crownTopY - (r + 1) * SCALE;
          this.fillGfx.fillStyle(FOAM_COLOR, 1);
          this.fillGfx.fillRect(px, py, SCALE, SCALE);
        }
        // Bright sparkle on the upper-left of the lump (inside the
        // silhouette, NOT poking above it — that would create a spire).
        if (r === lumpH - 1 && right > left) {
          const sparkleC = Math.max(left, Math.floor(cxLump) - 1);
          if (sparkleC >= 0 && sparkleC < crownW) {
            this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 1);
            this.fillGfx.fillRect(
              crownXLeft + sparkleC * SCALE,
              crownTopY - lumpH * SCALE,
              SCALE,
              SCALE,
            );
          }
        }
      }
      // Soft cream shadow on the lower-right shoulder of each lump for depth.
      const shoulderC = lump.col + lumpW - 1;
      if (shoulderC < crownW && shoulderC >= 0) {
        this.fillGfx.fillStyle(FOAM_SHADOW, 0.55);
        this.fillGfx.fillRect(
          crownXLeft + shoulderC * SCALE,
          crownTopY - SCALE,
          SCALE,
          SCALE,
        );
      }
    }
  }

  /**
   * Draw foam runs flowing down the outside of the glass. Cartoony
   * fat drips with a dark outline (so they pop over the glass texture)
   * and a big teardrop bead at the tip. Drips appear as soon as foam
   * crosses the rim and lengthen with `overshootRatio` (0..1).
   *
   * Renders into `dripGfx` which sits above the glass sprite, so the
   * runs visibly cling to the outside of the cup rather than getting
   * hidden by the outline.
   */
  drawFoamCurtain(overshootRatio) {
    const g = this.dripGfx;
    // Anchor the curtain so it OVERLAPS the rim outline (3 rows of dark
    // outline + bright lip above the inner liquid area). Without this
    // overlap the rim's blue-grey edge is still visible above the foam,
    // which looks like the curtain is hanging inside the glass.
    const topHalfFrac = this.volPerRow[this.innerH - 1];
    const topHalfPx = Math.max(1, Math.round((this.innerW * topHalfFrac) / 2));
    // The rim outline extends from `innerTop - 3` to `innerTop - 1` above
    // the inner area, plus rim "ears" 1 px wider on each side. We start
    // the curtain ABOVE the rim's top so the foam visibly covers the lip.
    const rimOverlapSrcPx = 4; // 3 rim rows + 1 px breathing room above
    const innerTopY = this.innerBottomLocalY - this.innerH * SCALE;
    const rimY = innerTopY - rimOverlapSrcPx * SCALE;
    const maxAvailableDripPx = Math.max(4, Math.floor(this.innerH * 1.0));

    const outline = 0xc9b88a; // dark cream — readable over both glass and bar

    const colCount = this.foamCurtain.length;
    // Start two pixels past the left rim ear, end two past the right.
    // Rim ears sit at ±(topHalfPx + 1), so leftStart = -(topHalfPx + 2).
    const leftStartSrc = -topHalfPx - 2;

    // ---- 1) Compute per-column raw length ----
    const raw = new Array(colCount);
    for (let i = 0; i < colCount; i++) {
      const col = this.foamCurtain[i];
      const effRatio = (overshootRatio - col.startThreshold) /
        Math.max(0.01, 1 - col.startThreshold);
      if (effRatio <= 0) {
        raw[i] = 0;
        continue;
      }
      const clamped = Math.min(1, effRatio);
      raw[i] = Math.round(maxAvailableDripPx * col.maxLenFrac * clamped);
    }

    // ---- 2) Smooth lengths with a 3-tap blur, three passes ----
    // Replaces saw-tooth tips with rounded dome-shaped bulges. Three
    // passes give a much softer profile than two — neighbor columns
    // trend strongly toward each other so isolated tall spikes flatten.
    const smooth = (src) => {
      const out = new Array(src.length);
      for (let i = 0; i < src.length; i++) {
        const a = src[Math.max(0, i - 1)];
        const b = src[i];
        const c = src[Math.min(src.length - 1, i + 1)];
        out[i] = (a + b + b + c) / 4;
      }
      return out;
    };
    let lenF = smooth(smooth(smooth(raw)));

    // ---- 3) Clamp every column to within 1 px of its neighbors' max ----
    // Iterative pass: any column more than 1 px taller than BOTH of its
    // neighbors gets clamped down to (max(neighbor) + 1). This eliminates
    // single-column spikes — apex columns become rounded plateaus.
    const lens = new Array(colCount);
    for (let i = 0; i < colCount; i++) lens[i] = Math.round(lenF[i]);
    // Two passes so that flattening one spike doesn't expose a new one.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < colCount; i++) {
        const left = i > 0 ? lens[i - 1] : lens[i];
        const right = i < colCount - 1 ? lens[i + 1] : lens[i];
        const maxNeighbor = Math.max(left, right);
        if (lens[i] > maxNeighbor + 1) lens[i] = maxNeighbor + 1;
      }
    }
    // Apex rounding: a column whose two neighbors are BOTH equal to it
    // (a plateau) is fine. But if it's a true single-column peak (taller
    // than both, only by 1 now), trim by 1 to round the apex.
    for (let i = 1; i < colCount - 1; i++) {
      if (lens[i] > lens[i - 1] && lens[i] > lens[i + 1]) {
        lens[i] = Math.max(0, lens[i] - 1);
      }
    }

    // ---- 4) Top outline strip just below the rim ----
    g.fillStyle(outline, 1);
    g.fillRect(leftStartSrc * SCALE, rimY - 1, colCount * SCALE, 1);

    // ---- 5) Per-column foam strips ----
    for (let i = 0; i < colCount; i++) {
      const lenPx = lens[i];
      if (lenPx <= 0) continue;
      const col = this.foamCurtain[i];
      const x = (leftStartSrc + i) * SCALE;
      const stripHeight = lenPx * SCALE;

      // Cream foam fill
      g.fillStyle(FOAM_COLOR, 1);
      g.fillRect(x, rimY, SCALE, stripHeight);

      // Per-column highlight/shadow — lit from upper-left.
      const colFrac = i / Math.max(1, colCount - 1);
      if (colFrac < 0.35) {
        g.fillStyle(FOAM_HIGHLIGHT, 0.55);
        g.fillRect(x, rimY, SCALE, stripHeight);
      } else if (colFrac > 0.7) {
        g.fillStyle(FOAM_SHADOW, 0.45);
        g.fillRect(x, rimY, SCALE, stripHeight);
      }

      // Bottom-of-column outline pixel (the rounded "drip cap").
      g.fillStyle(outline, 1);
      g.fillRect(x, rimY + stripHeight, SCALE, 1);

      // Heavy beads dangling from the longest columns.
      if (col.heavy && lenPx >= 6 && lenPx >= maxAvailableDripPx * 0.35) {
        this.drawDripBead(g, x, rimY + stripHeight, outline);
      }
    }

    // ---- 6) Step outlines between adjacent columns with different lengths ----
    // These give the curtain a clean silhouette without jagged edges since
    // the smoothing already minimized large jumps.
    for (let i = 0; i < colCount - 1; i++) {
      const aLen = lens[i];
      const bLen = lens[i + 1];
      const diff = aLen - bLen;
      if (Math.abs(diff) >= 1) {
        g.fillStyle(outline, 1);
        const stepHeight = Math.abs(diff) * SCALE;
        const stepX = (leftStartSrc + i + 1) * SCALE;
        const stepTop = diff > 0
          ? rimY + bLen * SCALE
          : rimY + aLen * SCALE;
        g.fillRect(stepX - 1, stepTop, 1, stepHeight);
      }
    }
  }

  /**
   * Rounded teardrop bead hanging off the bottom of a heavy drip column.
   * Real water droplets are narrow where they meet the source and bulge
   * out toward a rounded bottom — the opposite of a diamond. 5 src-px rows:
   *
   *     ##        row 0 — neck (narrow, attached to drip)
   *    ####       row 1
   *    ####       row 2 — fattest part
   *    ####       row 3
   *     ##        row 4 — rounded bottom tip
   *
   * Drawn with a dark outline ring and a bright sparkle on the upper-left.
   */
  drawDripBead(g, columnX, beadTopY, outline) {
    const beadCenterX = columnX + Math.floor(SCALE / 2);
    const half1 = SCALE;       // 1 src-px each side of center → 2 px wide
    const half2 = SCALE * 2;   // 2 src-px each side → 4 px wide

    // Row offsets in display px (0 = topmost row, +SCALE per src-px row).
    const r0 = beadTopY;                  // narrow neck
    const r1 = beadTopY + SCALE;          // fat upper
    const r2 = beadTopY + SCALE * 2;      // fattest middle
    const r3 = beadTopY + SCALE * 3;      // fat lower
    const r4 = beadTopY + SCALE * 4;      // narrow rounded tip

    // ---- Outline ring ----
    g.fillStyle(outline, 1);
    // Top neck — 2 px wide, 1-px-thick outline arch above it.
    g.fillRect(beadCenterX - half1, r0 - 1, half1 * 2, 1);
    // Neck side walls
    g.fillRect(beadCenterX - half1 - 1, r0, 1, SCALE);
    g.fillRect(beadCenterX + half1, r0, 1, SCALE);
    // Fattest section side walls (rows 1-3)
    g.fillRect(beadCenterX - half2 - 1, r1, 1, SCALE * 3);
    g.fillRect(beadCenterX + half2, r1, 1, SCALE * 3);
    // Bottom — symmetrical to the top: 2 px wide, outline arch below.
    g.fillRect(beadCenterX - half1 - 1, r4, 1, SCALE);
    g.fillRect(beadCenterX + half1, r4, 1, SCALE);
    g.fillRect(beadCenterX - half1, r4 + SCALE, half1 * 2, 1);

    // ---- Cream foam interior ----
    g.fillStyle(FOAM_COLOR, 1);
    g.fillRect(beadCenterX - half1, r0, half1 * 2, SCALE);          // neck
    g.fillRect(beadCenterX - half2, r1, half2 * 2, SCALE);          // row 1
    g.fillRect(beadCenterX - half2, r2, half2 * 2, SCALE);          // row 2
    g.fillRect(beadCenterX - half2, r3, half2 * 2, SCALE);          // row 3
    g.fillRect(beadCenterX - half1, r4, half1 * 2, SCALE);          // rounded tip

    // ---- Sparkle highlight on the upper-left of the bulge ----
    g.fillStyle(FOAM_HIGHLIGHT, 1);
    g.fillRect(beadCenterX - half2 + SCALE, r1, SCALE, SCALE);

    // ---- Soft shadow on the lower-right of the bulge ----
    g.fillStyle(FOAM_SHADOW, 0.55);
    g.fillRect(beadCenterX + half2 - SCALE, r3, SCALE, SCALE);
  }

  /**
   * Draw a bubble blob at (x, y). Radius 1 = single dot; radius 2 =
   * a 2×2 cluster with a darker outline pixel and a bright center pixel.
   * `kind` is 'light' (bright bubble) or 'dark' (faint shadow bubble).
   */
  drawFoamBubble(x, y, radius, kind) {
    const isDark = kind === 'dark';
    if (radius >= 2) {
      // 2×2 ringed bubble: 3 outline pixels + 1 bright highlight.
      const ringColor = isDark ? FOAM_BUBBLE_DARK : FOAM_SHADOW;
      const ringAlpha = isDark ? 0.75 : 0.85;
      const coreColor = isDark ? FOAM_SHADOW : FOAM_HIGHLIGHT;
      const coreAlpha = isDark ? 0.9 : 1;
      this.fillGfx.fillStyle(ringColor, ringAlpha);
      this.fillGfx.fillRect(x, y, SCALE * 2, SCALE);
      this.fillGfx.fillRect(x, y + SCALE, SCALE, SCALE);
      this.fillGfx.fillStyle(coreColor, coreAlpha);
      this.fillGfx.fillRect(x + SCALE, y + SCALE, SCALE, SCALE);
    } else {
      // Single dot.
      if (isDark) {
        this.fillGfx.fillStyle(FOAM_BUBBLE_DARK, 0.75);
        this.fillGfx.fillRect(x, y, SCALE, SCALE);
      } else {
        this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 1);
        this.fillGfx.fillRect(x, y, Math.max(1, SCALE - 1), Math.max(1, SCALE - 1));
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
    const innerWidth = halfPx * 2;
    const w = innerWidth * SCALE;
    const x = -halfPx * SCALE;
    const yBottom = this.innerBottomLocalY - rowIdx * SCALE; // bottom of this row
    const yTop = yBottom - toFrac * SCALE;
    const h = (toFrac - fromFrac) * SCALE;
    this.fillGfx.fillStyle(color, 1);
    this.fillGfx.fillRect(x, yTop, w, h);
    this.fillGfx.fillStyle(edge, 0.6);
    this.fillGfx.fillRect(x, yTop, 1, h);
    this.fillGfx.fillRect(x + w - 1, yTop, 1, h);
    const isFoam = color === FOAM_COLOR;
    if (innerWidth >= 6) {
      const highlightCol = Math.floor(innerWidth * 0.22);
      const highlightW = Math.max(2, Math.floor(innerWidth * 0.12));
      const shadowCol = Math.floor(innerWidth * 0.72);
      const shadowW = Math.max(2, Math.floor(innerWidth * 0.14));
      if (isFoam) {
        this.fillGfx.fillStyle(FOAM_HIGHLIGHT, 0.28);
        this.fillGfx.fillRect(x + highlightCol * SCALE, yTop, highlightW * SCALE, h);
        this.fillGfx.fillStyle(edge, 0.28);
        this.fillGfx.fillRect(x + shadowCol * SCALE, yTop, shadowW * SCALE, h);
      } else {
        this.fillGfx.fillStyle(0xffffff, 0.18);
        this.fillGfx.fillRect(x + highlightCol * SCALE, yTop, highlightW * SCALE, h);
        this.fillGfx.fillStyle(edge, 0.45);
        this.fillGfx.fillRect(x + shadowCol * SCALE, yTop, shadowW * SCALE, h);
      }
    }
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
          x: this.scene.scale.width + 100, // off the right edge of the canvas
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

  /**
   * Time-up exit: drop straight down past the bottom of the canvas as the
   * bartender clears all glasses at once.
   */
  releaseDown(onDone) {
    if (this.released) return;
    this.released = true;

    this.scene.tweens.add({
      targets: this,
      y: this.y + 200,
      alpha: 0,
      duration: GAME_CONFIG.glassReleaseDuration,
      ease: 'Cubic.in',
      onComplete: () => {
        if (onDone) onDone();
        this.destroy();
      },
    });
  }
}
