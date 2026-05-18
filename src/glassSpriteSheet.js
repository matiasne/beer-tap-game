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

  // Row -2: rim ears (corners outside the lip) + outline shoulders that
  // connect the back arc down to the front lip + bright lip across the
  // full width.
  setFill(outline);
  rect(cx - topHalf - 2, innerTop - 2, 1, 1);             // far-left ear
  rect(cx + topHalf + 1, innerTop - 2, 1, 1);             // far-right ear
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
  const botHalf = halfByRow[innerH - 1];
  setFill(outline);
  rect(cx - botHalf - 1, innerBottom, botHalf * 2 + 2, 1);

  if (!shape.stem && innerBottom + 1 < H - 1) {
    setFill(baseShadow, 0.7);
    rect(cx - botHalf, innerBottom + 1, botHalf * 2, 1);
    setFill(baseShadow, 0.45);
    if (innerBottom + 2 < H) {
      rect(cx - botHalf, innerBottom + 2, botHalf * 2, 1);
    }
    if (innerBottom + 3 < H) {
      setFill(outlineDark, 0.35);
      rect(cx - botHalf - 1, innerBottom + 3, botHalf * 2 + 2, 1);
    }
    setFill(outlineDark, 0.6);
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
}
