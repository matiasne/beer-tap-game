import Phaser from 'phaser';
import { GLASS_SHAPES } from '../glassShapes.js';
import { CLIENT_PREFERENCES } from '../clientPreferences.js';
import { BEER_STYLES } from '../beerStyles.js';

// Client palette variants (skin, hair, shirt). Each can also carry a small
// accessory and a hair style hint that makes them more distinct.
// hairStyle: 'parted' | 'swept' | 'messy' | 'flat'
// accessory: null | 'cap' | 'beanie' | 'bandana' | 'glasses'
export const CLIENT_VARIANTS = [
  { skin: 0xe8c39a, hair: 0x3a2418, shirt: 0xc33a3a, hairStyle: 'parted', accessory: null },
  { skin: 0xc99172, hair: 0x1a1a1a, shirt: 0x2a6acc, hairStyle: 'flat',   accessory: 'cap' },
  { skin: 0xf2d6b3, hair: 0xd9a64a, shirt: 0x2a8a3a, hairStyle: 'swept',  accessory: null },
  { skin: 0x9c6a4a, hair: 0x2a1a10, shirt: 0xd9a64a, hairStyle: 'messy',  accessory: 'bandana' },
  { skin: 0xe8c39a, hair: 0x5a3a24, shirt: 0x6a3aa8, hairStyle: 'parted', accessory: 'glasses' },
  { skin: 0xc99172, hair: 0xb84a24, shirt: 0x3a3a3a, hairStyle: 'messy',  accessory: 'beanie' },
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

    // Speech bubble background for the "wants this beer" indicator.
    this.makeChatBubble('chat_bubble');

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

  // Beer stream — 4×16 px tile, designed to scroll vertically as a TileSprite.
  // Columns: dark edge | body | bright specular | light edge.
  // Rows: a repeating pattern of body/foam bands so when the tile scrolls
  // downward it reads as flowing liquid with droplets and air pockets.
  makeStream(key, style) {
    const W = 4;
    const H = 16;
    const body = style.liquidColor;
    const edgeDark = darken(style.liquidColor, 0.65);
    const edgeBright = style.key === 'stout' ? 0x6a3a20 : 0xfff4d6;
    const bubble = style.key === 'stout' ? 0xa67050 : 0xfff4d6;

    const g = this.add.graphics();

    // Base body fill across the whole tile
    g.fillStyle(body, 1);
    g.fillRect(0, 0, W, H);

    // Side columns (dark left edge, soft right edge) — gives the stream
    // depth and a clear silhouette against any background.
    g.fillStyle(edgeDark, 1);
    g.fillRect(0, 0, 1, H);
    g.fillStyle(edgeBright, 0.45);
    g.fillRect(W - 1, 0, 1, H);

    // Specular streak — interrupted column so the highlight reads as
    // moving when the tile scrolls.
    for (let y = 0; y < H; y++) {
      if (y % 4 !== 3) {
        g.fillStyle(edgeBright, 0.8);
        g.fillRect(1, y, 1, 1);
      }
    }

    // Droplet / air pocket pattern — periodic dark notch + a bright
    // single-pixel highlight just below it. Repeats every 8px.
    for (let y = 2; y < H; y += 8) {
      g.fillStyle(edgeDark, 0.8);
      g.fillRect(2, y, 1, 1);
      g.fillStyle(bubble, 0.9);
      g.fillRect(2, y + 1, 1, 1);
    }

    g.generateTexture(key, W, H);
    g.destroy();
  }

  // Tap: dark wooden top, metal body, spout. 24x40 px.
  // The handle (lever) takes the beer style's handle color so each tap
  // can be visually distinguished from the others.
  makeTap(key, active, style) {
    const w = 24;
    const h = 40;
    const g = this.add.graphics();

    // Palette
    const woodDark = 0x2a1f14;
    const wood = 0x4a3724;
    const woodLight = 0x6b4f33;
    const woodEdge = 0x8a6a40;
    const metalShadow = 0x4a4a52;
    const metalBase = 0x8a8a92;
    const metalLight = 0xc4c4cc;
    const metalBright = 0xeaeaef;
    const spoutDark = 0x3a3a42;
    const spout = 0x6a6a72;
    const handleBase = style.handleColor;
    const handleBright = style.handleHighlight;
    const handleDark = darken(handleBase, 0.6);
    const handleTop = active ? lighten(handleBright, 1.2) : handleBright;

    // --- Wall mount plate (back of tap) ---
    // Outline + two-tone wood face + 2 visible bolt heads.
    g.fillStyle(woodDark, 1);
    g.fillRect(1, 0, w - 2, 7); // outline plate
    g.fillStyle(wood, 1);
    g.fillRect(2, 1, w - 4, 5); // main face
    g.fillStyle(woodLight, 1);
    g.fillRect(3, 1, w - 6, 1); // top highlight strip
    g.fillStyle(woodDark, 1);
    g.fillRect(2, 5, w - 4, 1); // bottom shadow strip
    // Bolts
    g.fillStyle(woodEdge, 1);
    g.fillRect(4, 3, 1, 1);
    g.fillRect(w - 5, 3, 1, 1);
    g.fillStyle(metalLight, 1);
    g.fillRect(4, 3, 1, 1);
    g.fillStyle(woodDark, 1);
    g.fillRect(4, 4, 1, 1); // bolt shadow
    g.fillStyle(metalLight, 1);
    g.fillRect(w - 5, 3, 1, 1);
    g.fillStyle(woodDark, 1);
    g.fillRect(w - 5, 4, 1, 1);

    // --- Main chrome body — tapered, with proper specular streak ---
    // Wider at the top (just under the mount), slightly narrower at the
    // spout shoulder. Drawn row-by-row so we can taper cleanly.
    const bodyTop = 7;
    const bodyBot = 28;
    for (let y = bodyTop; y < bodyBot; y++) {
      const t = (y - bodyTop) / (bodyBot - bodyTop - 1); // 0..1
      // Body half-width: 6 at top → 5 near the bottom shoulder.
      const half = t < 0.85 ? 6 : 5;
      const cx = w / 2;
      // Outline
      g.fillStyle(metalShadow, 1);
      g.fillRect(cx - half, y, 1, 1);
      g.fillRect(cx + half - 1, y, 1, 1);
      // Body fill
      g.fillStyle(metalBase, 1);
      g.fillRect(cx - half + 1, y, half * 2 - 2, 1);
    }
    // Specular streak (left-of-center) — runs the body's length, brighter in
    // the middle to look cylindrical.
    for (let y = bodyTop + 1; y < bodyBot - 1; y++) {
      g.fillStyle(metalLight, 1);
      g.fillRect(8, y, 1, 1);
      // Center brightest pixel cluster
      if (y > 11 && y < 22) {
        g.fillStyle(metalBright, 1);
        g.fillRect(9, y, 1, 1);
      }
    }
    // Right-side soft shadow column
    for (let y = bodyTop + 1; y < bodyBot - 1; y++) {
      g.fillStyle(metalShadow, 0.6);
      g.fillRect(w - 9, y, 1, 1);
    }
    // Decorative collar rings — two thin bands across the body for that
    // segmented chrome look.
    const ringYs = [11, 22];
    for (const ry of ringYs) {
      g.fillStyle(metalShadow, 1);
      g.fillRect(7, ry, w - 14, 1);
      g.fillStyle(metalBright, 1);
      g.fillRect(7, ry - 1, w - 14, 1);
    }

    // --- Handle (knob) — taller, with a rounded ball top ---
    // Stem (rectangular)
    const stemX = 10;
    const stemY = 2;
    const stemW = 4;
    const stemH = 7;
    g.fillStyle(handleDark, 1);
    g.fillRect(stemX, stemY, stemW, stemH); // base
    g.fillStyle(handleBase, 1);
    g.fillRect(stemX, stemY, stemW - 1, stemH); // main stem
    g.fillStyle(handleBright, 1);
    g.fillRect(stemX, stemY, 1, stemH); // left highlight column
    // Ball top — slightly wider than the stem
    const ballY = stemY - 2;
    g.fillStyle(handleDark, 1);
    g.fillRect(stemX - 1, ballY + 1, stemW + 2, 1); // bottom row (widest)
    g.fillRect(stemX, ballY, stemW, 1); // top row
    g.fillStyle(handleBase, 1);
    g.fillRect(stemX, ballY + 1, stemW, 1);
    g.fillRect(stemX - 1, ballY + 1, 1, 1);
    g.fillRect(stemX + stemW, ballY + 1, 1, 1);
    g.fillStyle(handleTop, 1);
    g.fillRect(stemX + 1, ballY, 2, 1); // ball top highlight
    // Sparkle on the ball
    g.fillStyle(0xffffff, 1);
    g.fillRect(stemX + 1, ballY, 1, 1);
    // Stem→body collar ring
    g.fillStyle(handleDark, 1);
    g.fillRect(stemX - 1, stemY + stemH, stemW + 2, 1);

    // --- Spout — angled-looking with a rim and a dark inner hole ---
    const spoutTop = 28;
    // Shoulder under the body (a bit wider than the spout itself)
    g.fillStyle(metalShadow, 1);
    g.fillRect(6, spoutTop, w - 12, 1);
    g.fillStyle(metalLight, 1);
    g.fillRect(7, spoutTop, w - 14, 1);
    // Spout body
    g.fillStyle(spout, 1);
    g.fillRect(8, spoutTop + 1, w - 16, 5);
    // Spout highlight column
    g.fillStyle(metalLight, 1);
    g.fillRect(8, spoutTop + 1, 1, 4);
    // Spout shadow column
    g.fillStyle(spoutDark, 1);
    g.fillRect(w - 9, spoutTop + 1, 1, 4);
    // Rim under the spout
    g.fillStyle(metalShadow, 1);
    g.fillRect(7, spoutTop + 6, w - 14, 1);
    // Dark inner hole at the very bottom
    g.fillStyle(spoutDark, 1);
    g.fillRect(9, spoutTop + 6, w - 18, 2);
    g.fillStyle(0x1a1a1f, 1);
    g.fillRect(10, spoutTop + 7, w - 20, 1);

    // --- Active state — warm glow around the body + a beer-colored drip ---
    if (active) {
      // Warm glow on the upper body
      g.fillStyle(0xfff4d6, 0.35);
      g.fillRect(7, bodyTop, w - 14, 2);
      // Beer-tinted glow inside the spout opening
      g.fillStyle(style.liquidColor, 0.7);
      g.fillRect(10, spoutTop + 7, w - 20, 1);
      // Tiny drip clinging to the spout edge
      g.fillStyle(style.liquidColor, 1);
      g.fillRect(11, spoutTop + 8, 2, 1);
      g.fillStyle(style.liquidEdgeColor, 1);
      g.fillRect(11, spoutTop + 8, 1, 1);
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

  /**
   * Client portrait: head + torso + arms leaning on the bar. 20x28 px,
   * bottom-anchored to the bar edge. Adds per-variant hair styles,
   * optional accessories (cap, beanie, bandana, glasses), facial features
   * (eyebrows, nose, mouth, ear), and a tiny ground shadow under the torso.
   */
  makeClient(key, variant) {
    const w = 20;
    const h = 28;
    const g = this.add.graphics();

    const { skin, hair, shirt, hairStyle = 'parted', accessory = null } = variant;
    const shirtDark = darken(shirt, 0.7);
    const shirtLight = lighten(shirt, 1.2);
    const skinShadow = darken(skin, 0.8);
    const skinHighlight = lighten(skin, 1.08);
    const hairLight = lighten(hair, 1.25);
    const hairDark = darken(hair, 0.7);

    // --- Ground shadow (floor contact under the torso) ---
    g.fillStyle(0x000000, 0.35);
    g.fillRect(3, h - 1, w - 6, 1);

    // --- Torso block (sits on the bar) ---
    g.fillStyle(shirt, 1);
    g.fillRect(3, 16, w - 6, h - 16);
    // top-of-shoulder highlight
    g.fillStyle(shirtLight, 1);
    g.fillRect(4, 16, w - 8, 1);
    // side shadows
    g.fillStyle(shirtDark, 1);
    g.fillRect(3, 16, 1, h - 16); // left shadow
    g.fillRect(w - 4, 16, 1, h - 16); // right shadow
    // Placket / button line down the centre + 2 buttons
    g.fillStyle(shirtDark, 1);
    g.fillRect(9, 18, 1, h - 18);
    g.fillStyle(shirtLight, 1);
    g.fillRect(9, 20, 1, 1);
    g.fillRect(9, 24, 1, 1);
    // Collar / neckline notch
    g.fillStyle(shirtDark, 1);
    g.fillRect(8, 16, 4, 2);
    g.fillStyle(darken(shirt, 0.5), 1);
    g.fillRect(9, 17, 2, 1);

    // --- Arms resting on the bar ---
    g.fillStyle(shirt, 1);
    g.fillRect(1, 18, 2, 6); // left arm
    g.fillRect(w - 3, 18, 2, 6); // right arm
    // arm shadow on the underside
    g.fillStyle(shirtDark, 1);
    g.fillRect(1, 23, 2, 1);
    g.fillRect(w - 3, 23, 2, 1);
    // cuffs (lighter band at the wrist)
    g.fillStyle(shirtLight, 1);
    g.fillRect(1, 22, 2, 1);
    g.fillRect(w - 3, 22, 2, 1);
    // Hands
    g.fillStyle(skin, 1);
    g.fillRect(1, 24, 2, 2);
    g.fillRect(w - 3, 24, 2, 2);
    // tiny thumb pixel curling inward (gripping the bar edge)
    g.fillStyle(skinShadow, 1);
    g.fillRect(2, 25, 1, 1);
    g.fillRect(w - 3, 25, 1, 1);

    // --- Neck ---
    g.fillStyle(skin, 1);
    g.fillRect(8, 13, 4, 3);
    g.fillStyle(skinShadow, 1);
    g.fillRect(8, 15, 4, 1); // neck-to-collar shadow
    g.fillRect(11, 13, 1, 2); // right side neck shadow

    // --- Head (8x8 with shaded corner pixels to fake rounded silhouette) ---
    g.fillStyle(skin, 1);
    g.fillRect(6, 5, 8, 8);
    g.fillStyle(skinShadow, 1);
    g.fillRect(6, 5, 1, 1); // top-left bevel
    g.fillRect(13, 5, 1, 1); // top-right bevel
    g.fillRect(6, 12, 1, 1); // bottom-left bevel (jaw)
    g.fillRect(13, 12, 1, 1); // bottom-right bevel (jaw)
    // Cheek/face highlight on the left
    g.fillStyle(skinHighlight, 1);
    g.fillRect(7, 8, 1, 2);
    // Right side overall shadow
    g.fillStyle(skinShadow, 1);
    g.fillRect(12, 6, 1, 6);
    // Chin shadow (under jaw)
    g.fillRect(7, 12, 6, 1);
    // Ear bump on the right side
    g.fillStyle(skin, 1);
    g.fillRect(14, 8, 1, 2);
    g.fillStyle(skinShadow, 1);
    g.fillRect(14, 9, 1, 1);

    // --- Hair (style varies per-variant) ---
    drawHair(g, hairStyle, hair, hairLight, hairDark);

    // --- Eyebrows ---
    g.fillStyle(hairDark, 1);
    g.fillRect(8, 8, 1, 1);
    g.fillRect(11, 8, 1, 1);

    // --- Eyes ---
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(8, 9, 1, 1);
    g.fillRect(11, 9, 1, 1);

    // --- Nose (single pixel shadow between/under the eyes) ---
    g.fillStyle(skinShadow, 1);
    g.fillRect(9, 10, 1, 1);

    // --- Mouth (slight smirk, offset right of center) ---
    g.fillStyle(0x4a2a1a, 1);
    g.fillRect(9, 11, 2, 1);

    // --- Accessory (drawn on top of head/hair) ---
    drawAccessory(g, accessory, hair, hairLight, hairDark);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Speech bubble background for the preference icon. Cream-white fill,
   * dark outline, rounded corners (corners knocked off pixel-style), with
   * a small downward-pointing tail at the bottom-left. Sized to wrap the
   * 18x20 preference icon with a 1px padding margin.
   */
  makeChatBubble(key) {
    const W = 28;
    const H = 28; // 22 bubble + 6 tail
    const bubbleH = 22;
    const fill = 0xfff4d6;
    const fillLight = 0xffffff;
    const outline = 0x2a1f14;
    const shadow = 0xd9c89a;

    const g = this.add.graphics();

    // Solid fill (rounded by knocking out the 4 corner pixels after).
    g.fillStyle(fill, 1);
    g.fillRect(1, 1, W - 2, bubbleH - 2);

    // Outline (top, bottom, left, right). Skip the 4 corner pixels for round look.
    g.fillStyle(outline, 1);
    g.fillRect(2, 0, W - 4, 1); // top
    g.fillRect(2, bubbleH - 1, W - 4, 1); // bottom
    g.fillRect(0, 2, 1, bubbleH - 4); // left
    g.fillRect(W - 1, 2, 1, bubbleH - 4); // right
    // corner step pixels (one in, one down from each corner)
    g.fillRect(1, 1, 1, 1);
    g.fillRect(W - 2, 1, 1, 1);
    g.fillRect(1, bubbleH - 2, 1, 1);
    g.fillRect(W - 2, bubbleH - 2, 1, 1);

    // Inner top highlight (gives the bubble a glossy plastic feel).
    g.fillStyle(fillLight, 1);
    g.fillRect(2, 1, W - 4, 1);
    g.fillRect(1, 2, 1, 1);
    g.fillRect(W - 2, 2, 1, 1);

    // Inner bottom shadow.
    g.fillStyle(shadow, 1);
    g.fillRect(2, bubbleH - 2, W - 4, 1);

    // Tail — pointing down-left toward the speaker. Outline + fill.
    // Triangle approximated by stacked rects, tip at (5, bubbleH + 5).
    g.fillStyle(outline, 1);
    g.fillRect(6, bubbleH, 5, 1);
    g.fillRect(5, bubbleH + 1, 5, 1);
    g.fillRect(4, bubbleH + 2, 4, 1);
    g.fillRect(3, bubbleH + 3, 3, 1);
    g.fillRect(3, bubbleH + 4, 2, 1);
    g.fillRect(3, bubbleH + 5, 1, 1);
    // Fill inside the tail
    g.fillStyle(fill, 1);
    g.fillRect(7, bubbleH, 3, 1);
    g.fillRect(6, bubbleH + 1, 3, 1);
    g.fillRect(5, bubbleH + 2, 2, 1);
    g.fillRect(4, bubbleH + 3, 1, 1);
    // Erase the outline pixels that sit right under where the tail meets
    // the bubble so the join reads as continuous interior.
    g.fillStyle(fill, 1);
    g.fillRect(6, bubbleH - 1, 4, 1);

    g.generateTexture(key, W, H);
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

// Hair silhouettes drawn over the 8x8 head at (6..13, 5..12). Each style
// shapes the front/top differently so different clients read as distinct.
function drawHair(g, style, hair, hairLight, hairDark) {
  // Common cap + sideburns
  g.fillStyle(hair, 1);
  g.fillRect(6, 3, 8, 4); // top cap
  g.fillRect(5, 4, 1, 3); // left sideburn
  g.fillRect(14, 4, 1, 3); // right sideburn (drawn over ear shadow)

  if (style === 'parted') {
    // Side part — small forehead gap on the right, highlight on left side
    g.fillStyle(hairDark, 1);
    g.fillRect(10, 6, 3, 1); // dark band at hairline (right half)
    g.fillStyle(hairLight, 1);
    g.fillRect(7, 3, 3, 1);
  } else if (style === 'swept') {
    // Swept forward — a forelock dropping over the brow on the left
    g.fillStyle(hair, 1);
    g.fillRect(7, 6, 2, 1); // forelock
    g.fillStyle(hairLight, 1);
    g.fillRect(7, 3, 5, 1);
  } else if (style === 'messy') {
    // Asymmetric tufts on top
    g.fillStyle(hair, 1);
    g.fillRect(6, 2, 1, 1);
    g.fillRect(8, 2, 1, 1);
    g.fillRect(11, 2, 1, 1);
    g.fillRect(13, 2, 1, 1);
    g.fillStyle(hairLight, 1);
    g.fillRect(7, 3, 2, 1);
    g.fillRect(11, 3, 2, 1);
  } else if (style === 'flat') {
    // Buzz/flat — keep the cap but no highlights, slightly shorter forehead
    g.fillStyle(hairDark, 1);
    g.fillRect(6, 6, 8, 1);
  } else {
    g.fillStyle(hairLight, 1);
    g.fillRect(7, 3, 4, 1);
  }
}

// Optional accessory drawn over hair. Keeps within the head bounds so it
// doesn't bleed into the torso.
function drawAccessory(g, accessory, hair, hairLight, hairDark) {
  if (!accessory) return;

  if (accessory === 'cap') {
    // Baseball cap — dome crown + brim jutting out to the left.
    const crown = 0x2a2a2a;
    const crownLight = 0x4a4a4a;
    g.fillStyle(crown, 1);
    g.fillRect(6, 3, 8, 3); // crown body
    g.fillRect(5, 5, 1, 1); // left edge
    g.fillStyle(crownLight, 1);
    g.fillRect(7, 3, 5, 1); // top highlight
    // brim — 1px thick, extends left of the head
    g.fillStyle(crown, 1);
    g.fillRect(2, 6, 5, 1);
    g.fillStyle(crownLight, 1);
    g.fillRect(2, 6, 1, 1); // brim tip highlight
    // button on top
    g.fillStyle(0x8a3a3a, 1);
    g.fillRect(9, 2, 1, 1);
  } else if (accessory === 'beanie') {
    // Knit beanie — covers the cap, fold band at the bottom.
    const beanie = 0x6a3a2a;
    const beanieLight = 0x8a5a3a;
    const beanieDark = 0x4a2418;
    g.fillStyle(beanie, 1);
    g.fillRect(6, 2, 8, 5);
    g.fillRect(5, 4, 1, 3);
    g.fillRect(14, 4, 1, 3);
    g.fillStyle(beanieLight, 1);
    g.fillRect(7, 2, 5, 1); // top knit highlight
    g.fillRect(6, 4, 1, 1);
    g.fillStyle(beanieDark, 1);
    g.fillRect(6, 6, 8, 1); // fold band
    // tiny pom
    g.fillStyle(beanieLight, 1);
    g.fillRect(9, 1, 2, 1);
  } else if (accessory === 'bandana') {
    // Bandana tied around forehead — band across the hairline.
    const cloth = 0xc33a3a;
    const clothLight = 0xe85a5a;
    const clothDark = 0x8a1a1a;
    g.fillStyle(cloth, 1);
    g.fillRect(6, 6, 8, 2);
    g.fillStyle(clothLight, 1);
    g.fillRect(6, 6, 8, 1);
    g.fillStyle(clothDark, 1);
    g.fillRect(6, 7, 1, 1);
    // knot tail on the right side
    g.fillStyle(cloth, 1);
    g.fillRect(14, 6, 1, 1);
    g.fillStyle(clothDark, 1);
    g.fillRect(14, 7, 1, 1);
  } else if (accessory === 'glasses') {
    // Round-ish glasses — frames over the eyes, bridge in the middle.
    const frame = 0x2a1a10;
    g.fillStyle(frame, 1);
    // left lens
    g.fillRect(7, 9, 3, 1);
    g.fillRect(7, 8, 1, 2);
    g.fillRect(9, 8, 1, 2);
    // right lens
    g.fillRect(10, 9, 3, 1);
    g.fillRect(10, 8, 1, 2);
    g.fillRect(12, 8, 1, 2);
    // bridge
    g.fillRect(10, 9, 1, 1);
    // a tiny reflection in each lens
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(8, 9, 1, 1);
    g.fillRect(11, 9, 1, 1);
  }
}
