// Pure pixel-art renderer for the 8 glass outline sprites. Used by:
//   - BootScene (offscreen canvas → Phaser texture, at runtime)
//   - scripts/build-glass-sprite-sheet.js (node-canvas → PNG + atlas JSON)
//
// Drawing is plain Canvas2D `fillStyle` + `fillRect`. Each glass is drawn
// into the caller-provided context at offset (ox, oy); the bounding box is
// shape.outerWidthPx × shape.outerHeightPx.
//
// Layering matches the original `makeGlassShape` in BootScene exactly, so
// the runtime path and the offline export produce pixel-identical sprites.

import { GLASS_SHAPES } from './glassShapes.js';

export { GLASS_SHAPES };

/** Frame key as stored in the atlas — `glass_<shape.key>`. */
export function glassFrameName(shapeKey) {
  return `glass_${shapeKey}`;
}

// 0xrrggbb → "rgba(r, g, b, a)" string for Canvas2D fillStyle.
function rgba(color, alpha) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Render one glass outline into `ctx` at offset (ox, oy). Caller is
 * responsible for sizing the canvas / context appropriately
 * (shape.outerWidthPx × shape.outerHeightPx of room from the origin).
 */
export function drawGlass(ctx, ox, oy, shape) {
  const W = shape.outerWidthPx;
  const H = shape.outerHeightPx;
  const innerH = shape.innerHeightPx;
  const innerW = shape.innerWidthPx;
  const innerTop = shape.topPaddingPx;
  const innerBottom = H - shape.bottomPaddingPx;
  const cx = Math.floor(W / 2);

  // Layered glass palette — outline, an inner cool-reflection column, a
  // bright rim, a brighter specular highlight, and two shadow tones.
  const outline = 0x7a9bbf;
  const outlineDark = 0x4a6a8a;
  const wallEdge = 0xa6c2dd;
  const rim = 0xeaf6ff;
  const highlight = 0xffffff;
  const innerShadow = 0x8fb2d4;
  const innerShadowDeep = 0x6b94b8;
  const baseShadow = 0x5f7d9a;

  // Local helpers so each call site reads like the original Phaser version.
  const setFill = (color, alpha = 1) => {
    ctx.fillStyle = rgba(color, alpha);
  };
  const rect = (x, y, w, h) => {
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // Precompute halfPx per inner row so we can index neighbours when
  // anti-stepping the outline (avoid 1px gaps when the profile changes
  // by more than 1 column between adjacent rows).
  const halfByRow = new Array(innerH);
  for (let y = 0; y < innerH; y++) {
    const t = 1 - y / (innerH - 1);
    const widthFrac = Math.max(0, Math.min(1, shape.widthProfile(t)));
    halfByRow[y] = Math.max(1, Math.round((innerW * widthFrac) / 2));
  }

  // --- Side walls ---
  for (let y = 0; y < innerH; y++) {
    const halfPx = halfByRow[y];
    const rowY = innerTop + y;

    // Outer outline columns
    setFill(outline);
    rect(cx - halfPx - 1, rowY, 1, 1);
    rect(cx + halfPx, rowY, 1, 1);

    // Inner "edge" column — a slightly brighter tint sitting against
    // the outline, gives the wall a touch of glass-thickness.
    if (halfPx >= 3 && y > 1 && y < innerH - 2) {
      setFill(wallEdge, 0.7);
      rect(cx + halfPx - 1, rowY, 1, 1);
    }

    // Fill in diagonal step gaps so the outline reads as continuous
    // even when the profile narrows/widens quickly.
    if (y > 0) {
      const prev = halfByRow[y - 1];
      const diff = halfPx - prev;
      if (diff > 1) {
        setFill(outline);
        for (let k = 1; k < diff; k++) {
          rect(cx - prev - 1 - k, rowY, 1, 1);
          rect(cx + prev + k, rowY, 1, 1);
        }
      } else if (diff < -1) {
        setFill(outline);
        for (let k = 1; k < -diff; k++) {
          rect(cx - prev - 1 + k, rowY - 1, 1, 1);
          rect(cx + prev - k, rowY - 1, 1, 1);
        }
      }
    }

    // Specular streak — a 2-column bright highlight on the upper-left.
    // The bright column sits one pixel inside the wall; a softer dim
    // column sits one further in. Fades near the rim and base.
    if (y > 2 && y < innerH - 3) {
      const fadeTop = Math.min(1, (y - 2) / 6);
      const fadeBot = Math.min(1, (innerH - 3 - y) / 6);
      const fade = Math.min(fadeTop, fadeBot);
      setFill(highlight, 0.65 * fade);
      rect(cx - halfPx, rowY, 1, 1);
      if (halfPx >= 5) {
        setFill(highlight, 0.25 * fade);
        rect(cx - halfPx + 1, rowY, 1, 1);
      }
      // A brighter "core" pixel cluster mid-height adds a glint.
      if (y > innerH * 0.25 && y < innerH * 0.55) {
        setFill(highlight, 0.9 * fade);
        rect(cx - halfPx, rowY, 1, 1);
      }
    }

    // Inner shadow — soft tint on the right interior to suggest curvature.
    if (y > 1 && y < innerH - 2 && halfPx >= 3) {
      setFill(innerShadow, 0.5);
      rect(cx + halfPx - 2, rowY, 1, 1);
      // Deeper shadow column on the very inside of the right wall, near
      // the bottom third (where light pools in real glass).
      if (y > innerH * 0.55 && halfPx >= 4) {
        setFill(innerShadowDeep, 0.4);
        rect(cx + halfPx - 3, rowY, 1, 1);
      }
    }
  }

  // --- Top rim — elliptical opening so the cup reads as 3D ---
  // 5 rows above the inner liquid area:
  //   row -5:   (just above the rim, empty)
  //   row -4:   back inner cavity (dark) — narrowest, only middle pixels
  //   row -3:   outer outline arching up at the back (rim ellipse top)
  //   row -2:   bright front lip + outline shoulders + sparkle highlight
  //   row -1:   bright front lip (continues) + inner shadow corners
  // This produces the "elliptical rim" silhouette where the back of the
  // lip peeks up above the front, with a dark visible cavity inside.
  const topHalf = halfByRow[0];

  // Width of the back-arc cavity (the dark ellipse interior visible from
  // above). Roughly 60% of the rim width, capped so it doesn't get silly
  // on huge mugs. Always ≥ 1 px so very narrow glasses still get some.
  const cavityHalf = Math.max(1, Math.min(topHalf - 2, Math.floor(topHalf * 0.6)));

  // Row -4: dark interior cavity (back inner shadow of the cup) — only on
  // glasses wide enough to show meaningful depth.
  if (topHalf >= 4 && cavityHalf >= 1) {
    setFill(innerShadowDeep, 0.85);
    rect(cx - cavityHalf, innerTop - 4, cavityHalf * 2, 1);
  }

  // Row -3: outer outline arching up at the back. Spans wider than the
  // cavity (1 px shoulder on each side) so it reads as the back edge of
  // the rim curving up out of the page.
  if (topHalf >= 4) {
    setFill(outline);
    rect(cx - cavityHalf - 1, innerTop - 3, cavityHalf * 2 + 2, 1);
  }

  // Row -2: outline shoulders that connect the back arc down to the front
  // lip + bright lip across the full width. The "rim ears" (single
  // pixels at the far outer corners) used to sit here, but skipping them
  // softens the top-left and top-right corners into a 1-px rounded step.
  setFill(outline);
  // Outline shoulders connecting the back arc to the side walls:
  if (topHalf >= 4) {
    const shoulderL = cx - cavityHalf - 1;
    const shoulderR = cx + cavityHalf + 1;
    const leftEnd = cx - topHalf - 1;
    const rightEnd = cx + topHalf;
    if (shoulderL > leftEnd) rect(leftEnd, innerTop - 2, shoulderL - leftEnd, 1);
    if (shoulderR < rightEnd) rect(shoulderR + 1, innerTop - 2, rightEnd - shoulderR, 1);
  } else {
    // Narrow glasses: keep the original full-width outline (no ellipse).
    setFill(outline);
    rect(cx - topHalf - 1, innerTop - 3, topHalf * 2 + 2, 1);
  }
  // Bright lip — front face of the rim (full width).
  setFill(rim);
  rect(cx - topHalf, innerTop - 2, topHalf * 2, 1);

  // Row -1: rim ears + bright lip (slightly dimmer) — front face continues.
  setFill(outline);
  rect(cx - topHalf - 1, innerTop - 1, 1, 1);
  rect(cx + topHalf, innerTop - 1, 1, 1);
  setFill(rim, 0.85);
  rect(cx - topHalf, innerTop - 1, topHalf * 2, 1);

  // Sparkle highlight on the upper-left of the lip.
  setFill(highlight);
  rect(cx - topHalf + 1, innerTop - 2, Math.min(2, topHalf), 1);
  // Tiny sparkle on the front face of the back arc (where light catches).
  if (topHalf >= 4) {
    rect(cx - Math.floor(cavityHalf / 2), innerTop - 3, Math.min(3, cavityHalf), 1);
  }

  // Inner shadow on the right side of the lip (back of the lip front face).
  setFill(innerShadow, 0.7);
  rect(cx + topHalf - Math.min(3, topHalf), innerTop - 1, Math.min(3, topHalf), 1);

  // --- Bottom — thick base with proper bevel + ground shadow ---
  // Contact-line outline is 1 px shorter on each side than the wall outlines
  // above it, so the bottom-left and bottom-right corners read as a 1-px
  // rounded step rather than a hard 90° junction.
  const botHalf = halfByRow[innerH - 1];
  setFill(outline);
  rect(cx - botHalf, innerBottom, botHalf * 2, 1);

  if (!shape.stem && innerBottom + 1 < H - 1) {
    setFill(baseShadow, 0.7);
    rect(cx - botHalf, innerBottom + 1, botHalf * 2, 1);
    setFill(baseShadow, 0.45);
    if (innerBottom + 2 < H) {
      rect(cx - botHalf, innerBottom + 2, botHalf * 2, 1);
    }
    if (innerBottom + 3 < H) {
      setFill(outlineDark, 0.35);
      rect(cx - botHalf, innerBottom + 3, botHalf * 2, 1);
    }
    // Soft inner-corner pixels — anchor the wall outline visually to the
    // base without the hard square junction.
    setFill(outlineDark, 0.4);
    rect(cx - botHalf - 1, innerBottom + 1, 1, 1);
    rect(cx + botHalf, innerBottom + 1, 1, 1);
  }

  // --- Optional handle (mug/stein) — thicker D-shape with thumb rest ---
  if (shape.handle) {
    const hxStart = cx + botHalf + 1;
    const hyTop = innerTop + Math.floor(innerH * 0.22);
    const hyBot = innerTop + Math.floor(innerH * 0.72);
    const hxEnd = Math.min(W - 1, hxStart + 10);
    const armThick = 3;

    setFill(outline);
    for (let t = 0; t < armThick; t++) {
      rect(hxStart, hyTop + t, hxEnd - hxStart + 1 - t, 1);
    }
    for (let t = 0; t < armThick; t++) {
      rect(hxStart, hyBot - t, hxEnd - hxStart + 1 - t, 1);
    }
    rect(hxEnd, hyTop, 1, hyBot - hyTop + 1);
    rect(hxEnd - 1, hyTop + 1, 1, hyBot - hyTop - 1);

    setFill(rim, 0.8);
    rect(hxEnd, hyTop + 1, 1, Math.max(1, Math.floor((hyBot - hyTop) / 3)));
    setFill(highlight);
    rect(hxEnd, hyTop + 2, 1, 2);

    const thumbY = hyTop + armThick + 1;
    const thumbX = hxStart + Math.floor((hxEnd - hxStart) * 0.35);
    setFill(outlineDark, 0.7);
    rect(thumbX, thumbY, 3, 1);
    setFill(innerShadow, 0.5);
    rect(thumbX, thumbY + 1, 3, 1);

    setFill(outlineDark, 0.55);
    rect(hxStart, hyBot, 2, 1);
    rect(hxStart, hyTop, 2, 1);
  }

  // --- Optional stem + foot (goblet) — multi-pixel stem with bead + flared foot ---
  if (shape.stem) {
    const stemTop = innerBottom + 1;
    const stemBot = H - 5;
    const stemHalf = 3;

    setFill(outline);
    rect(cx - stemHalf, stemTop, stemHalf * 2, stemBot - stemTop);
    setFill(highlight, 0.8);
    rect(cx - stemHalf, stemTop, 1, stemBot - stemTop);
    setFill(rim, 0.6);
    rect(cx - stemHalf + 1, stemTop, 1, stemBot - stemTop);
    setFill(outlineDark, 0.65);
    rect(cx + stemHalf - 1, stemTop, 1, stemBot - stemTop);

    const beadYs = [
      stemTop + Math.floor((stemBot - stemTop) * 0.3),
      stemTop + Math.floor((stemBot - stemTop) * 0.65),
    ];
    for (const beadY of beadYs) {
      setFill(outline);
      rect(cx - stemHalf - 1, beadY, stemHalf * 2 + 2, 1);
      rect(cx - stemHalf - 1, beadY + 1, stemHalf * 2 + 2, 1);
      setFill(rim, 0.85);
      rect(cx - stemHalf, beadY, 2, 1);
      setFill(outlineDark, 0.5);
      rect(cx + stemHalf - 2, beadY + 1, 2, 1);
    }

    const footHalf = Math.floor(W * 0.34);
    setFill(outline);
    rect(cx - footHalf, H - 4, footHalf * 2, 1);
    rect(cx - footHalf, H - 3, footHalf * 2, 1);
    setFill(rim, 0.9);
    rect(cx - footHalf + 1, H - 4, footHalf * 2 - 2, 1);
    setFill(highlight);
    rect(cx - footHalf + 2, H - 4, Math.min(4, footHalf * 2 - 4), 1);
    setFill(outlineDark, 0.7);
    rect(cx - footHalf, H - 2, footHalf * 2, 1);
    setFill(outlineDark, 0.4);
    rect(cx - footHalf - 1, H - 1, footHalf * 2 + 2, 1);
  }

  // --- Per-shape label / decor (procedural) ---
  // Drawn AFTER the glass body so the label sits on top of the wall.
  // Each shape gets a small recognizable badge at a sensible height — sized
  // and shaped after the reference image's glass family (Craftsman shield,
  // Edelweiss sun, Leffe cathedral, CITRA hops leaf, etc.). At our 128-px
  // source width these are stylized monograms/icons rather than legible text.
  const labelY = innerTop + Math.floor(innerH * 0.45);
  drawGlassDecor(ctx, ox, oy, shape, cx, labelY, halfByRow);
}

function drawGlassDecor(ctx, ox, oy, shape, cx, labelY, halfByRow) {
  const rect = (x, y, w, h) => ctx.fillRect(ox + x, oy + y, w, h);
  const setFill = (color, alpha = 1) => { ctx.fillStyle = rgba(color, alpha); };

  // Get the inner half-width at the label row so labels never poke past
  // the glass walls. The inner area starts at row 0 and ends at innerH-1.
  const innerH = shape.innerHeightPx;
  const innerTop = shape.topPaddingPx;
  const labelRowInGlass = Math.max(0, Math.min(innerH - 1, labelY - innerTop));
  const halfAtLabel = halfByRow[labelRowInGlass] ?? halfByRow[0];

  switch (shape.key) {
    case 'pint':
      drawShieldBadge(setFill, rect, cx, labelY, halfAtLabel, {
        plateColor: 0xe8d9a8,
        plateShadow: 0xa48030,
        plateBorder: 0x4a3010,
        glyphColor: 0x3a1408,
        glyph: 'A', // CRAFTSMAN ALE monogram
      });
      break;
    case 'pilsner':
      // Kolsch / tall pilsner — small cathedral crest near the rim.
      drawTinyCrest(setFill, rect, cx, labelY - 20, halfAtLabel);
      break;
    case 'mug':
      // Stein gets a dimpled wall pattern AND a small coat-of-arms square.
      drawMugDimples(setFill, rect, cx, labelY, halfAtLabel, halfByRow, innerTop, innerH);
      drawShieldBadge(setFill, rect, cx, labelY + 6, halfAtLabel, {
        plateColor: 0xc4a020,
        plateShadow: 0x8a6010,
        plateBorder: 0x4a3010,
        glyphColor: 0x6a1010,
        glyph: '+', // simple cross / coat-of-arms hint
      });
      break;
    case 'tulip':
      // Edelweiss-style sun/flower badge with bright yellow halo.
      drawSunBadge(setFill, rect, cx, labelY, halfAtLabel);
      break;
    case 'snifter':
      // Leffe-style cathedral shield (tall pointed shield).
      drawCathedralShield(setFill, rect, cx, labelY - 4, halfAtLabel);
      break;
    case 'weizen':
      // Wheat icon — tall thin label band with a wheat motif.
      drawWheatBadge(setFill, rect, cx, labelY, halfAtLabel);
      break;
    case 'goblet':
      // Hint of gold filigree on the bowl (already has ornate stem).
      drawGoldFiligree(setFill, rect, cx, labelY - 8, halfAtLabel);
      break;
    case 'flute':
      // CITRA-style green hops circle.
      drawHopsBadge(setFill, rect, cx, labelY, halfAtLabel);
      break;
  }
}

/**
 * Shield-shaped badge — vintage Craftsman Ale / coat-of-arms style.
 * `glyph` is a single-character monogram drawn pixel-art style.
 */
function drawShieldBadge(setFill, rect, cx, cy, maxHalf, opts) {
  const { plateColor, plateShadow, plateBorder, glyphColor, glyph } = opts;
  // Shield dimensions — capped by glass half-width.
  const halfW = Math.max(8, Math.min(18, maxHalf - 4));
  const h = Math.round(halfW * 1.3);
  const top = cy - Math.floor(h / 2);

  // Shield body: rectangle with pointed bottom (1-px stepped triangle).
  // Top rectangle portion
  const rectH = Math.floor(h * 0.7);
  setFill(plateColor);
  rect(cx - halfW, top, halfW * 2, rectH);
  // Pointed bottom — narrows 1px each row
  const pointH = h - rectH;
  for (let i = 0; i < pointH; i++) {
    const inset = Math.round((i / Math.max(1, pointH - 1)) * (halfW - 1));
    setFill(plateColor);
    rect(cx - halfW + inset, top + rectH + i, (halfW - inset) * 2, 1);
  }
  // Border — outline rectangle + pointed bottom outline
  setFill(plateBorder);
  rect(cx - halfW - 1, top, 1, rectH);
  rect(cx + halfW, top, 1, rectH);
  rect(cx - halfW, top - 1, halfW * 2, 1);
  for (let i = 0; i < pointH; i++) {
    const inset = Math.round((i / Math.max(1, pointH - 1)) * (halfW - 1));
    rect(cx - halfW + inset - 1, top + rectH + i, 1, 1);
    rect(cx + halfW - inset, top + rectH + i, 1, 1);
  }
  // Bottom point cap
  rect(cx, top + h, 1, 1);
  // Top highlight + shadow
  setFill(plateShadow, 0.8);
  rect(cx - halfW + 1, top + rectH - 2, halfW * 2 - 2, 2);
  setFill(0xffffff, 0.35);
  rect(cx - halfW + 2, top + 1, halfW * 2 - 4, 1);

  // Monogram glyph in the upper center
  const glyphX = cx;
  const glyphY = top + Math.floor(rectH * 0.45);
  drawGlyph(setFill, rect, glyphX, glyphY, glyph, glyphColor);
}

/** 5×7 pixel-art glyph for a single character at (cx, cy). */
function drawGlyph(setFill, rect, cx, cy, ch, color) {
  // Tiny 5×5 patterns for the few glyphs we use.
  const patterns = {
    'A': [
      ' XXX ',
      'X   X',
      'X   X',
      'XXXXX',
      'X   X',
    ],
    '+': [
      '  X  ',
      '  X  ',
      'XXXXX',
      '  X  ',
      '  X  ',
    ],
  };
  const p = patterns[ch];
  if (!p) return;
  setFill(color);
  for (let r = 0; r < p.length; r++) {
    for (let c = 0; c < p[r].length; c++) {
      if (p[r][c] !== ' ') {
        rect(cx - 2 + c, cy - 2 + r, 1, 1);
      }
    }
  }
}

/** Tiny crest icon for Kolsch glasses — 2 little gothic spires. */
function drawTinyCrest(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 8) return;
  setFill(0x8a3a3a);
  rect(cx - 6, cy + 2, 12, 6);
  setFill(0xc4a020);
  rect(cx - 6, cy + 2, 12, 2);
  // Two pointed roofs
  setFill(0x6a1010);
  rect(cx - 5, cy, 4, 2);
  rect(cx + 1, cy, 4, 2);
  rect(cx - 4, cy - 2, 2, 2);
  rect(cx + 2, cy - 2, 2, 2);
  rect(cx - 3, cy - 4, 1, 2); // left spire
  rect(cx + 3, cy - 4, 1, 2); // right spire
  setFill(0x4a0808);
  rect(cx - 6, cy + 8, 12, 1);
}

/** Mug dimples — repeating diamond highlights across the visible wall. */
function drawMugDimples(setFill, rect, cx, cy, halfAtLabel, halfByRow, innerTop, innerH) {
  // Diamond grid — every ~12 src px, offset every other row.
  // Each dimple is a 4×3 highlight + 1 px darker bottom edge.
  const startRow = Math.floor(innerH * 0.15);
  const endRow = Math.floor(innerH * 0.85);
  let rowIdx = 0;
  for (let r = startRow; r < endRow; r += 14) {
    const halfPx = halfByRow[r];
    if (halfPx < 8) continue;
    const offset = (rowIdx % 2) * 6;
    for (let x = -halfPx + 6 + offset; x < halfPx - 6; x += 12) {
      // Skip the center column where the label/badge sits.
      if (Math.abs(x) < 8 && Math.abs(innerTop + r - cy) < 16) continue;
      setFill(0xffffff, 0.18);
      rect(cx + x, innerTop + r, 4, 2);
      setFill(0xffffff, 0.4);
      rect(cx + x + 1, innerTop + r, 2, 1);
      setFill(0x000000, 0.18);
      rect(cx + x, innerTop + r + 2, 4, 1);
    }
    rowIdx++;
  }
}

/** Edelweiss-style sun/flower — circular badge with petals + center dot. */
function drawSunBadge(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 8) return;
  const r = Math.min(10, maxHalf - 4);
  // Sun disc
  setFill(0xfff080);
  // Approximate circle with row-by-row math.
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.round(Math.sqrt(r * r - dy * dy));
    rect(cx - span, cy + dy, span * 2, 1);
  }
  // Border
  setFill(0xc4a020);
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.round(Math.sqrt(r * r - dy * dy));
    rect(cx - span - 1, cy + dy, 1, 1);
    rect(cx + span, cy + dy, 1, 1);
  }
  // Center red dot (Edelweiss "heart")
  setFill(0xc4202a);
  rect(cx - 1, cy - 1, 3, 3);
  // Bright top arc
  setFill(0xffffff, 0.5);
  rect(cx - r + 2, cy - r + 1, r - 1, 2);
  // 4 petal pixels around the edges
  setFill(0xfff080);
  rect(cx, cy - r - 2, 1, 1);
  rect(cx, cy + r + 1, 1, 1);
  rect(cx - r - 2, cy, 1, 1);
  rect(cx + r + 1, cy, 1, 1);
}

/** Cathedral-shield label — vertical shield with a stylized arch. */
function drawCathedralShield(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 9) return;
  const halfW = Math.min(12, maxHalf - 3);
  const h = 22;
  const top = cy - Math.floor(h / 2);
  // Body — rectangle with rounded top + pointed bottom
  setFill(0xc4a020);
  // Top rectangle
  rect(cx - halfW, top + 2, halfW * 2, 12);
  // Rounded top: 2 px corners inset
  rect(cx - halfW + 1, top, halfW * 2 - 2, 2);
  // Bottom point
  for (let i = 0; i < 8; i++) {
    const inset = Math.round((i / 7) * (halfW - 1));
    rect(cx - halfW + inset, top + 14 + i, (halfW - inset) * 2, 1);
  }
  // Border
  setFill(0x4a3010);
  rect(cx - halfW - 1, top + 2, 1, 12);
  rect(cx + halfW, top + 2, 1, 12);
  rect(cx - halfW + 1, top - 1, halfW * 2 - 2, 1);
  rect(cx - halfW, top, 1, 2);
  rect(cx + halfW - 1, top, 1, 2);
  // Top highlight
  setFill(0xffeb80, 0.85);
  rect(cx - halfW + 2, top + 2, halfW * 2 - 4, 2);
  // Cathedral arch icon — 3 vertical bars with rounded tops
  setFill(0x4a1010);
  rect(cx - 4, top + 6, 2, 6);
  rect(cx - 1, top + 5, 2, 7);
  rect(cx + 2, top + 6, 2, 6);
  // Cross on top of center spire
  rect(cx, top + 3, 1, 2);
  rect(cx - 1, top + 4, 3, 1);
}

/** Wheat badge — vertical green oval with wheat strand. */
function drawWheatBadge(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 8) return;
  const halfW = Math.min(10, maxHalf - 3);
  const h = 20;
  const top = cy - Math.floor(h / 2);
  // Cream background pill
  setFill(0xf2e8c4);
  rect(cx - halfW, top + 2, halfW * 2, h - 4);
  rect(cx - halfW + 1, top, halfW * 2 - 2, 2);
  rect(cx - halfW + 1, top + h - 2, halfW * 2 - 2, 2);
  // Border
  setFill(0x6a4828);
  rect(cx - halfW - 1, top + 2, 1, h - 4);
  rect(cx + halfW, top + 2, 1, h - 4);
  rect(cx - halfW + 1, top - 1, halfW * 2 - 2, 1);
  rect(cx - halfW + 1, top + h, halfW * 2 - 2, 1);
  // Wheat stalk down the center — vertical line with paired grain ovals
  setFill(0xc4a020);
  rect(cx, top + 3, 1, h - 6);
  // Grain pairs (4 levels)
  for (let i = 0; i < 4; i++) {
    const gy = top + 4 + i * 3;
    rect(cx - 3, gy, 2, 2);
    rect(cx + 2, gy, 2, 2);
    setFill(0xffeb80, 0.85);
    rect(cx - 3, gy, 1, 1);
    rect(cx + 2, gy, 1, 1);
    setFill(0xc4a020);
  }
}

/** Gold filigree hint on the goblet bowl — small ornate flourish. */
function drawGoldFiligree(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 6) return;
  setFill(0xc4a020);
  // Center diamond
  rect(cx - 1, cy - 2, 3, 1);
  rect(cx - 2, cy - 1, 5, 1);
  rect(cx - 1, cy, 3, 1);
  // Side flourishes
  rect(cx - 6, cy - 1, 3, 1);
  rect(cx + 4, cy - 1, 3, 1);
  rect(cx - 7, cy, 2, 1);
  rect(cx + 6, cy, 2, 1);
  // Bright highlight
  setFill(0xffd040);
  rect(cx, cy - 1, 1, 1);
  rect(cx - 5, cy - 1, 1, 1);
  rect(cx + 5, cy - 1, 1, 1);
}

/** Green hops circle — CITRA-style label. */
function drawHopsBadge(setFill, rect, cx, cy, maxHalf) {
  if (maxHalf < 6) return;
  const r = Math.min(7, maxHalf - 2);
  // Green disc
  setFill(0x2a8a3a);
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.round(Math.sqrt(r * r - dy * dy));
    rect(cx - span, cy + dy, span * 2, 1);
  }
  // Border
  setFill(0x1a4a18);
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.round(Math.sqrt(r * r - dy * dy));
    rect(cx - span - 1, cy + dy, 1, 1);
    rect(cx + span, cy + dy, 1, 1);
  }
  // Highlight
  setFill(0x6abf60, 0.85);
  rect(cx - r + 1, cy - r + 1, r - 1, 2);
  // Hop cone pattern — 3 stacked tiny chevrons
  setFill(0xc4e8a8);
  for (let i = 0; i < 3; i++) {
    rect(cx - 2, cy - 2 + i * 2, 5, 1);
    rect(cx - 1, cy - 1 + i * 2, 3, 1);
  }
  setFill(0x1a4a18);
  rect(cx, cy + 4, 1, 2); // stem
}
