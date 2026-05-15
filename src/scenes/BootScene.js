import Phaser from 'phaser';
import { GLASS_SHAPES } from '../glassShapes.js';
import { CLIENT_PREFERENCES } from '../clientPreferences.js';
import { BEER_STYLES } from '../beerStyles.js';

// Client palette variants (skin, hair, shirt). Indices map to client_0..client_N keys.
export const CLIENT_VARIANTS = [
  { skin: 0xe8c39a, hair: 0x3a2418, shirt: 0xc33a3a },
  { skin: 0xc99172, hair: 0x1a1a1a, shirt: 0x2a6acc },
  { skin: 0xf2d6b3, hair: 0xd9a64a, shirt: 0x2a8a3a },
  { skin: 0x9c6a4a, hair: 0x2a1a10, shirt: 0xd9a64a },
  { skin: 0xe8c39a, hair: 0x5a3a24, shirt: 0x6a3aa8 },
  { skin: 0xc99172, hair: 0xb84a24, shirt: 0x3a3a3a },
];

/**
 * Generates all pixel-art textures procedurally so the game ships with
 * zero external assets. Each texture is drawn at its natural pixel size
 * and scaled up by `spriteScale` when used as a sprite.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.makePixel('foam', 0xfff4d6);
    this.makePixel('shadow', 0x000000);

    // Per-beer tap textures (idle + active) and matching stream textures.
    BEER_STYLES.forEach((style) => {
      this.makeTap(`tap_${style.key}`, false, style);
      this.makeTap(`tap_${style.key}_active`, true, style);
      this.makeStream(`stream_${style.key}`, style);
    });
    // Generic fallbacks (used by anything that doesn't pass a beer style).
    this.makeTap('tap', false, BEER_STYLES[0]);
    this.makeTap('tap_active', true, BEER_STYLES[0]);
    this.makeStream('stream', BEER_STYLES[0]);
    this.makePixel('beer_fill', 0xf2b330);

    // 8 glass shape outline textures, keyed `glass_<shape.key>`.
    GLASS_SHAPES.forEach((shape) => this.makeGlassShape(shape));
    // Back-compat key — first shape doubles as the legacy `glass_empty`.
    if (!this.textures.exists('glass_empty')) {
      const first = GLASS_SHAPES[0];
      this.textures.addImage('glass_empty', this.textures.get(`glass_${first.key}`).getSourceImage());
    }

    // Client body variants — different skin/hair/shirt combos so the queue looks varied.
    CLIENT_VARIANTS.forEach((variant, i) => this.makeClient(`client_${i}`, variant));

    // Client-preference icons — one per (pref × beer style) combo so the
    // icon liquid color matches the desired beer.
    CLIENT_PREFERENCES.forEach((pref) => {
      BEER_STYLES.forEach((style) => this.makePreferenceIcon(pref, style));
    });

    this.scene.start('MenuScene');
  }

  // 1x1 pixel of a flat color — stretched at runtime for fills/streams.
  makePixel(key, color) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture(key, 1, 1);
    g.destroy();
  }

  // Thin beer stream, 2x1 px — stretched vertically between tap and glass.
  // Color comes from the beer style; the lighter highlight column is a
  // brightened version of the liquid edge.
  makeStream(key, style) {
    const g = this.add.graphics();
    g.fillStyle(style.liquidColor, 1);
    g.fillRect(0, 0, 2, 1);
    // For dark beers (stout) use a soft highlight column so the stream is visible.
    const highlight = style.key === 'stout' ? 0x6a3a20 : 0xfff4d6;
    g.fillStyle(highlight, 0.6);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture(key, 2, 1);
    g.destroy();
  }

  // Tap: dark wooden top, metal body, spout. 24x40 px.
  // The handle (lever) takes the beer style's handle color so each tap
  // can be visually distinguished from the others.
  makeTap(key, active, style) {
    const w = 24;
    const h = 40;
    const g = this.add.graphics();

    // Mount plate (back of tap, attaches to wall)
    g.fillStyle(0x4a3724, 1);
    g.fillRect(2, 0, w - 4, 6);
    g.fillStyle(0x6b4f33, 1);
    g.fillRect(3, 1, w - 6, 2);

    // Main metal body (cylindrical look via stripes)
    g.fillStyle(0x8a8a92, 1);
    g.fillRect(6, 6, w - 12, 22);
    g.fillStyle(0xc4c4cc, 1);
    g.fillRect(7, 7, 2, 20); // left highlight
    g.fillStyle(0x5a5a62, 1);
    g.fillRect(w - 9, 7, 2, 20); // right shadow

    // Handle (lever on top) — color from beer style.
    // Active = brighter highlight to signal pouring; idle = base handle color.
    const handleBase = style.handleColor;
    const handleBright = style.handleHighlight;
    g.fillStyle(active ? handleBright : handleBase, 1);
    g.fillRect(10, 2, 4, 8);
    g.fillStyle(active ? lighten(handleBright, 1.2) : handleBright, 1);
    g.fillRect(10, 2, 2, 8);

    // Spout (bottom)
    g.fillStyle(0x6a6a72, 1);
    g.fillRect(8, 28, w - 16, 6);
    g.fillStyle(0x3a3a42, 1);
    g.fillRect(9, 33, w - 18, 3); // dark hole at bottom

    // Active glow highlight
    if (active) {
      g.fillStyle(0xfff4d6, 0.35);
      g.fillRect(6, 6, w - 12, 2);
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Glass outline driven by a shape's width profile. Draws a layered look:
   * dark outer outline, bright rim, vertical specular streak on the left,
   * soft inner shadow on the right, base shadow ellipse, plus any extras
   * (handle for mug, stem+foot for goblet).
   */
  makeGlassShape(shape) {
    const W = shape.outerWidthPx;
    const H = shape.outerHeightPx;
    const innerH = shape.innerHeightPx;
    const innerW = shape.innerWidthPx;
    const innerTop = shape.topPaddingPx;
    const innerBottom = H - shape.bottomPaddingPx;
    const cx = Math.floor(W / 2);

    // Layered glass palette: a true outline (slight blue-grey), a bright
    // rim/highlight, a soft inner shadow, and a deeper base shadow.
    const outline = 0x7a9bbf;
    const outlineDark = 0x4a6a8a;
    const rim = 0xeaf6ff;
    const highlight = 0xffffff;
    const innerShadow = 0x8fb2d4;
    const baseShadow = 0x5f7d9a;

    const g = this.add.graphics();

    // Precompute halfPx per inner row so we can index neighbours when
    // anti-stepping the outline (avoid 1px gaps when the profile changes
    // by more than 1 column between adjacent rows).
    const halfByRow = new Array(innerH);
    for (let y = 0; y < innerH; y++) {
      const t = 1 - y / (innerH - 1);
      const widthFrac = Math.max(0, Math.min(1, shape.widthProfile(t)));
      halfByRow[y] = Math.max(1, Math.round((innerW * widthFrac) / 2));
    }

    // Side walls — draw outer outline, an inner highlight column on the
    // left (specular streak) and a soft inner shadow on the right.
    for (let y = 0; y < innerH; y++) {
      const halfPx = halfByRow[y];
      const rowY = innerTop + y;

      // Outer outline columns (cx - halfPx - 1 on the left, cx + halfPx on the right)
      g.fillStyle(outline, 1);
      g.fillRect(cx - halfPx - 1, rowY, 1, 1);
      g.fillRect(cx + halfPx, rowY, 1, 1);

      // Fill in diagonal step gaps so the outline reads as continuous
      // even when the profile narrows/widens quickly.
      if (y > 0) {
        const prev = halfByRow[y - 1];
        const diff = halfPx - prev;
        if (diff > 1) {
          for (let k = 1; k < diff; k++) {
            g.fillRect(cx - prev - 1 - k, rowY, 1, 1);
            g.fillRect(cx + prev + k, rowY, 1, 1);
          }
        } else if (diff < -1) {
          for (let k = 1; k < -diff; k++) {
            g.fillRect(cx - prev - 1 + k, rowY - 1, 1, 1);
            g.fillRect(cx + prev - k, rowY - 1, 1, 1);
          }
        }
      }

      // Specular streak — a brighter column one pixel inside the left wall.
      // Skip the topmost and bottommost row so it doesn't bleed into rim/base.
      if (y > 1 && y < innerH - 2) {
        g.fillStyle(highlight, 0.55);
        g.fillRect(cx - halfPx, rowY, 1, 1);
        // A second, dimmer streak one column further in for a subtle "thickness" feel.
        if (halfPx >= 4) {
          g.fillStyle(highlight, 0.18);
          g.fillRect(cx - halfPx + 1, rowY, 1, 1);
        }
      }

      // Inner shadow — soft tint on the right edge to suggest curvature.
      if (y > 0 && y < innerH - 1) {
        g.fillStyle(innerShadow, 0.4);
        g.fillRect(cx + halfPx - 1, rowY, 1, 1);
      }
    }

    // Top rim — thicker (2px) with a bright top edge for that "lip" look.
    const topHalf = halfByRow[0];
    g.fillStyle(outline, 1);
    // outer rim line (1px above the inner area)
    g.fillRect(cx - topHalf - 1, innerTop - 2, topHalf * 2 + 2, 1);
    // rim ears (the corners that tuck under the lip)
    g.fillRect(cx - topHalf - 1, innerTop - 1, 1, 1);
    g.fillRect(cx + topHalf, innerTop - 1, 1, 1);
    // bright lip
    g.fillStyle(rim, 1);
    g.fillRect(cx - topHalf, innerTop - 1, topHalf * 2, 1);
    // tiny sparkle on the upper-left of the rim
    g.fillStyle(highlight, 1);
    g.fillRect(cx - topHalf + 1, innerTop - 2, 2, 1);

    // Bottom — span based on the bottommost row's width, with a 2px base
    // (outer line + soft shadow below the liquid) so the glass has weight.
    const botHalf = halfByRow[innerH - 1];
    g.fillStyle(outline, 1);
    g.fillRect(cx - botHalf - 1, innerBottom, botHalf * 2 + 2, 1);
    // base shadow strip just below the inner bottom (sits on the table)
    if (!shape.stem && innerBottom + 1 < H - 1) {
      g.fillStyle(baseShadow, 0.6);
      g.fillRect(cx - botHalf, innerBottom + 1, botHalf * 2, 1);
      // outer "ground shadow" — slightly wider, dimmer ellipse-ish strip
      g.fillStyle(outlineDark, 0.35);
      g.fillRect(cx - botHalf - 1, innerBottom + 2, botHalf * 2 + 2, 1);
    }

    // Optional handle (mug/stein) — D-shape on the right with thickness.
    if (shape.handle) {
      const hxStart = cx + botHalf + 1;
      const hyTop = innerTop + Math.floor(innerH * 0.22);
      const hyBot = innerTop + Math.floor(innerH * 0.72);
      const hxEnd = Math.min(W - 1, hxStart + 5);

      g.fillStyle(outline, 1);
      // top arm (2px thick at the wall side, tapering)
      g.fillRect(hxStart, hyTop, hxEnd - hxStart + 1, 1);
      g.fillRect(hxStart, hyTop + 1, hxEnd - hxStart, 1);
      // bottom arm
      g.fillRect(hxStart, hyBot, hxEnd - hxStart + 1, 1);
      g.fillRect(hxStart, hyBot - 1, hxEnd - hxStart, 1);
      // outer arc (the curve of the D) — 2px thick
      g.fillRect(hxEnd, hyTop, 1, hyBot - hyTop + 1);
      g.fillRect(hxEnd - 1, hyTop + 1, 1, hyBot - hyTop - 1);
      // bright highlight on the outer curve
      g.fillStyle(rim, 0.7);
      g.fillRect(hxEnd, hyTop + 1, 1, Math.max(1, Math.floor((hyBot - hyTop) / 3)));
      // inner shadow on the inside of the handle
      g.fillStyle(outlineDark, 0.5);
      g.fillRect(hxStart, hyBot, 1, 1);
      g.fillRect(hxStart, hyTop, 1, 1);
    }

    // Optional stem + foot (goblet) — adds a thicker stem with a node and
    // a flared foot with a small ground shadow.
    if (shape.stem) {
      const stemTop = innerBottom + 1;
      const stemBot = H - 4;
      const stemHalf = 2;
      // stem body
      g.fillStyle(outline, 1);
      g.fillRect(cx - stemHalf, stemTop, stemHalf * 2, stemBot - stemTop);
      // stem highlight (left column)
      g.fillStyle(rim, 0.6);
      g.fillRect(cx - stemHalf, stemTop, 1, stemBot - stemTop);
      // stem shadow (right column)
      g.fillStyle(outlineDark, 0.55);
      g.fillRect(cx + stemHalf - 1, stemTop, 1, stemBot - stemTop);
      // decorative node halfway down the stem
      const nodeY = stemTop + Math.floor((stemBot - stemTop) / 2);
      g.fillStyle(outline, 1);
      g.fillRect(cx - stemHalf - 1, nodeY, stemHalf * 2 + 2, 2);
      g.fillStyle(rim, 0.7);
      g.fillRect(cx - stemHalf - 1, nodeY, 2, 1);

      // Foot — flared base with a bright top edge and shadow line.
      const footHalf = Math.floor(W * 0.32);
      g.fillStyle(outline, 1);
      g.fillRect(cx - footHalf, H - 3, footHalf * 2, 2);
      g.fillStyle(rim, 0.85);
      g.fillRect(cx - footHalf + 1, H - 3, footHalf * 2 - 2, 1);
      g.fillStyle(outlineDark, 0.55);
      g.fillRect(cx - footHalf, H - 1, footHalf * 2, 1);
    }

    g.generateTexture(`glass_${shape.key}`, W, H);
    g.destroy();
  }

  // Client portrait: head + torso + arms leaning on the bar. 20x28 px.
  // Anchored so the bottom of the texture aligns with the bar edge.
  makeClient(key, variant) {
    const w = 20;
    const h = 28;
    const g = this.add.graphics();

    const { skin, hair, shirt } = variant;
    const shirtDark = darken(shirt, 0.7);
    const skinShadow = darken(skin, 0.8);
    const hairLight = lighten(hair, 1.25);

    // Torso (lower portion — sits on the bar)
    g.fillStyle(shirt, 1);
    g.fillRect(3, 16, w - 6, h - 16);
    g.fillStyle(shirtDark, 1);
    g.fillRect(3, 16, 2, h - 16); // left shadow
    g.fillRect(w - 5, 16, 2, h - 16); // right shadow
    // Collar / neckline
    g.fillStyle(shirtDark, 1);
    g.fillRect(8, 16, 4, 2);

    // Arms resting on the bar (extending slightly outside the torso width)
    g.fillStyle(shirt, 1);
    g.fillRect(1, 18, 2, 6);
    g.fillRect(w - 3, 18, 2, 6);
    // Hands
    g.fillStyle(skin, 1);
    g.fillRect(1, 24, 2, 2);
    g.fillRect(w - 3, 24, 2, 2);

    // Neck
    g.fillStyle(skin, 1);
    g.fillRect(8, 13, 4, 3);
    g.fillStyle(skinShadow, 1);
    g.fillRect(8, 15, 4, 1);

    // Head (round-ish 8x8)
    g.fillStyle(skin, 1);
    g.fillRect(6, 5, 8, 8);
    g.fillStyle(skinShadow, 1);
    g.fillRect(6, 12, 8, 1); // chin shadow
    g.fillRect(13, 6, 1, 6); // right side shadow

    // Hair (cap on top of head)
    g.fillStyle(hair, 1);
    g.fillRect(6, 3, 8, 4);
    g.fillRect(5, 4, 1, 3); // left sideburn
    g.fillRect(14, 4, 1, 3); // right sideburn
    g.fillStyle(hairLight, 1);
    g.fillRect(7, 3, 4, 1); // top highlight

    // Eyes
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(8, 9, 1, 1);
    g.fillRect(11, 9, 1, 1);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Preference icon — a mini glass silhouette filled to the desired liquid
   * level with a foam cap of the desired thickness on top. 18x20 px.
   * The liquid color matches the beer style the client wants.
   */
  makePreferenceIcon(pref, style) {
    const W = 18;
    const H = 20;
    const g = this.add.graphics();

    // Glass outline (a simple straight-sided mug).
    const outline = 0xe8d9a8;
    const left = 4;
    const right = W - 5;
    const top = 2;
    const bottom = H - 2;

    g.fillStyle(outline, 1);
    g.fillRect(left, top, 1, bottom - top);            // left side
    g.fillRect(right, top, 1, bottom - top);           // right side
    g.fillRect(left, bottom, right - left + 1, 1);     // bottom
    g.fillRect(left, top, right - left + 1, 1);        // top rim

    // Inner usable area for liquid + foam
    const innerLeft = left + 1;
    const innerRight = right - 1;
    const innerTop = top + 1;
    const innerBottom = bottom - 1;
    const innerW = innerRight - innerLeft + 1;
    const innerH = innerBottom - innerTop + 1;

    // Desired liquid height in inner pixels (based on fillTarget %)
    const liquidPx = Math.max(1, Math.round((pref.fill.fillTarget / 100) * innerH));
    // Desired foam height in inner pixels (foam ratio relative to liquid, clamped to room left)
    const foamRoomPx = innerH - liquidPx;
    const foamPxIdeal = Math.round((pref.foam.foamRatioTarget / 100) * liquidPx);
    const foamPx = Math.min(foamRoomPx, foamPxIdeal);

    // Beer — colored to match the requested beer style.
    if (liquidPx > 0) {
      const beerY = innerBottom - liquidPx + 1;
      g.fillStyle(style.liquidColor, 1);
      g.fillRect(innerLeft, beerY, innerW, liquidPx);
      g.fillStyle(style.liquidEdgeColor, 1);
      g.fillRect(innerLeft, beerY, 1, liquidPx);
      g.fillRect(innerRight, beerY, 1, liquidPx);
    }

    // Foam (cream cap with one bubble highlight) — same for all beers for readability.
    if (foamPx > 0) {
      const foamY = innerBottom - liquidPx - foamPx + 1;
      g.fillStyle(0xfff4d6, 1);
      g.fillRect(innerLeft, foamY, innerW, foamPx);
      g.fillStyle(0xe6d6a8, 1);
      g.fillRect(innerLeft, foamY, 1, foamPx);
      g.fillRect(innerRight, foamY, 1, foamPx);
      // A bubble dot
      g.fillStyle(0xffffff, 1);
      g.fillRect(innerLeft + Math.floor(innerW / 2), foamY, 1, 1);
    } else {
      // "no foam" indicator — a thin dashed bar above the liquid
      const flatY = innerBottom - liquidPx;
      g.fillStyle(0xe6d6a8, 0.7);
      g.fillRect(innerLeft, flatY, 2, 1);
      g.fillRect(innerLeft + 4, flatY, 2, 1);
      g.fillRect(innerLeft + 8, flatY, 2, 1);
    }

    g.generateTexture(`${pref.iconKey}_${style.key}`, W, H);
    g.destroy();
  }
}

function darken(color, factor) {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lighten(color, factor) {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
