// Shared bust-style framework. Each character archetype calls into
// `drawBustBase(ctx, ox, oy, params, state, frameIdx)` passing a `params`
// object that customises the palette + per-feature callbacks.
//
// Bust crop: head + neck + shoulders + torso top — fills the upper ~65%
// of the 192×264 frame. The bottom half shows the chest/arms/belt where
// applicable. Top-left light source. Contextual outlines (no global black ring).
//
// Layer order, back→front:
//   1. drawBack (cape, long-hair behind shoulders, etc.)
//   2. shoulders/torso/clothing (drawTorso callback)
//   3. neck
//   4. head silhouette (skin)
//   5. face shading (highlights, shadows, blush)
//   6. drawHair (over head)
//   7. eyebrows + eyes + nose + mouth (state-dependent)
//   8. drawAccessory (hat, headband, mask, helmet)
//   9. drawFront (beard, monocle, items)
//  10. final tint (furious flash)

import { pxRect, darken, lighten } from './clientDrawHelpers.js';

// 6-frame pose tables shared across all bust characters.
function getBustPose(state, frameIdx) {
  let bodyDY = 0;
  let headDX = 0;
  let blink = false;
  let mouthOpen = false;
  let tint = null;

  if (state === 'idle') {
    bodyDY = [0, -1, -2, -2, -1, 0][frameIdx % 6];
    blink = frameIdx === 5;
  } else if (state === 'normal') {
    bodyDY = [0, -2, -3, -3, -2, 0][frameIdx % 6];
    blink = frameIdx === 5;
  } else if (state === 'antsy') {
    bodyDY = [0, -4, 0, -4, 0, -4][frameIdx % 6];
    headDX = [0, 2, 0, -2, 0, 2][frameIdx % 6];
  } else if (state === 'furious') {
    bodyDY = [0, 3, -2, 3, -2, 3][frameIdx % 6];
    headDX = [-4, 4, -4, 4, -3, 3][frameIdx % 6];
    tint = { color: 0xff4a2a, alpha: 0.3 };
  } else if (state === 'talking_left') {
    headDX = -4;
    bodyDY = [0, -1, -2, -1, 0, -1][frameIdx % 6];
    mouthOpen = frameIdx % 2 === 1;
  } else if (state === 'talking_right') {
    headDX = 4;
    bodyDY = [0, -1, -2, -1, 0, -1][frameIdx % 6];
    mouthOpen = frameIdx % 2 === 1;
  } else if (state === 'walking') {
    headDX = [0, 2, 4, 2, 0, -2][frameIdx % 6];
    bodyDY = [0, -1, -2, -1, 0, -1][frameIdx % 6];
  }
  return { bodyDY, headDX, blink, mouthOpen, tint };
}

export function drawBustBase(ctx, ox, oy, params, state, frameIdx) {
  const {
    skin = 0xd9a878,
    headWidth = 80,         // head box width in src px
    headHeight = 80,        // head box height
    shoulderHalfW = 64,     // half-width at the top of the shoulders
    shoulderBottomBulge = 18, // how much wider the bottom of the bust gets
    showEars = true,
    eyeColor = 0x3a2010,
    browColor = null,       // defaults to a darker hair / skin tone
    blush = 0xea8a92,
    drawBack = null,
    drawTorso = null,
    drawHair = null,
    drawAccessory = null,
    drawFront = null,
    eyeOverride = null,
    mouthOverride = null,
    eyebrowOverride = null,
    noseOverride = null,
  } = params;

  const pose = getBustPose(state, frameIdx);
  const { bodyDY, headDX, blink, mouthOpen, tint } = pose;

  const cx = 192 / 2;
  const shoulderY = 150 + bodyDY;
  const neckY = shoulderY - 14;
  const headBottom = neckY - 4;
  const headTop = headBottom - headHeight;
  const headHalfW = Math.floor(headWidth / 2);
  const headX = cx + headDX;

  // Derived palette
  const skinL = lighten(skin, 1.18);
  const skinM = skin;
  const skinS = darken(skin, 0.7);
  const skinDeep = darken(skin, 0.5);
  const skinLine = darken(skin, 0.4);

  const ctxAll = {
    pose, cx, shoulderY, neckY, headBottom, headTop, headHalfW, headX,
    skinL, skinM, skinS, skinDeep, skinLine, blush,
  };

  // 1) Back layer (drawn first, behind shoulders)
  if (drawBack) drawBack(ctx, ox, oy, ctxAll, params);

  // 2) Torso / costume
  if (drawTorso) drawTorso(ctx, ox, oy, ctxAll, params);

  // 3) Neck
  drawNeck(ctx, ox, oy, ctxAll);

  // 4) Head silhouette
  drawHeadSilhouette(ctx, ox, oy, ctxAll);

  // 5) Face shading
  drawFaceShading(ctx, ox, oy, ctxAll);
  if (showEars) drawEars(ctx, ox, oy, ctxAll);

  // 6) Hair
  if (drawHair) drawHair(ctx, ox, oy, ctxAll, params);

  // 7) Face features
  if (eyebrowOverride) {
    eyebrowOverride(ctx, ox, oy, ctxAll, state, frameIdx, params);
  } else {
    drawDefaultEyebrows(ctx, ox, oy, ctxAll, state, frameIdx, browColor || skinLine);
  }
  if (eyeOverride) {
    eyeOverride(ctx, ox, oy, ctxAll, state, frameIdx, params);
  } else {
    drawDefaultEyes(ctx, ox, oy, ctxAll, state, frameIdx, eyeColor, blink);
  }
  if (noseOverride) {
    noseOverride(ctx, ox, oy, ctxAll, state, frameIdx, params);
  } else {
    drawDefaultNose(ctx, ox, oy, ctxAll);
  }
  if (mouthOverride) {
    mouthOverride(ctx, ox, oy, ctxAll, state, frameIdx, mouthOpen, params);
  } else {
    drawDefaultMouth(ctx, ox, oy, ctxAll, state, frameIdx, mouthOpen);
  }

  // 8) Accessory (hat, headband, etc.)
  if (drawAccessory) drawAccessory(ctx, ox, oy, ctxAll, params);

  // 9) Front layer (beard, monocle, items)
  if (drawFront) drawFront(ctx, ox, oy, ctxAll, params);

  // 10) Final tint
  if (tint) pxRect(ctx, ox, oy, 192, 264, tint.color, tint.alpha);
}

// ----- Default feature drawers -----

function drawNeck(ctx, ox, oy, c) {
  const { cx, neckY, skinM, skinS, skinLine, pose } = c;
  const offset = Math.floor(pose.headDX / 2);
  const left = cx - 12 + offset;
  pxRect(ctx, ox + left, oy + neckY, 24, 14, skinM, 1);
  pxRect(ctx, ox + left + 14, oy + neckY, 10, 14, skinS, 0.55);
  pxRect(ctx, ox + left, oy + neckY, 24, 5, skinS, 0.6);
  pxRect(ctx, ox + left - 1, oy + neckY, 1, 14, skinLine, 1);
  pxRect(ctx, ox + left + 24, oy + neckY, 1, 14, skinLine, 1);
}

function drawHeadSilhouette(ctx, ox, oy, c) {
  const { headTop, headBottom, headX, headHalfW, skinM, skinLine } = c;
  for (let y = headTop; y <= headBottom; y++) {
    const ty = (y - headTop) / (headBottom - headTop);
    let inset = 0;
    if (ty < 0.12) inset = Math.round((0.12 - ty) * 60);
    if (ty > 0.92) inset = Math.round((ty - 0.92) * 70);
    const half = headHalfW - inset;
    pxRect(ctx, ox + headX - half, oy + y, half * 2, 1, skinM, 1);
    pxRect(ctx, ox + headX - half - 1, oy + y, 1, 1, skinLine, 1);
    pxRect(ctx, ox + headX + half, oy + y, 1, 1, skinLine, 1);
  }
  pxRect(ctx, ox + headX - headHalfW + 5, oy + headTop, (headHalfW - 5) * 2, 1, skinLine, 1);
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headBottom + 1, (headHalfW - 6) * 2, 1, skinLine, 1);
}

function drawFaceShading(ctx, ox, oy, c) {
  const { headTop, headBottom, headX, headHalfW, skinL, skinS, blush } = c;
  // Top-left forehead highlight
  pxRect(ctx, ox + headX - headHalfW + 8, oy + headTop + 14, 18, 12, skinL, 0.85);
  pxRect(ctx, ox + headX - headHalfW + 4, oy + headTop + 18, 6, 18, skinL, 0.65);
  // Right-side shadow
  pxRect(ctx, ox + headX + headHalfW - 22, oy + headTop + 12, 14, headBottom - headTop - 24, skinS, 0.45);
  pxRect(ctx, ox + headX + headHalfW - 14, oy + headTop + 14, 10, headBottom - headTop - 28, skinS, 0.55);
  // Chin shadow
  pxRect(ctx, ox + headX - headHalfW + 16, oy + headBottom - 8, headHalfW * 2 - 32, 8, skinS, 0.45);
  // Cheek blush
  pxRect(ctx, ox + headX - headHalfW + 18, oy + headTop + 50, 12, 6, blush, 0.5);
  pxRect(ctx, ox + headX + headHalfW - 32, oy + headTop + 50, 14, 6, blush, 0.45);
  pxRect(ctx, ox + headX - headHalfW + 20, oy + headTop + 52, 8, 3, lighten(blush, 1.15), 0.4);
}

function drawEars(ctx, ox, oy, c) {
  const { headX, headHalfW, headTop, skinM, skinLine, skinDeep } = c;
  const earY = headTop + 36;
  pxRect(ctx, ox + headX - headHalfW - 4, oy + earY, 4, 16, skinM, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + earY, 4, 16, skinM, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + earY, 1, 16, skinLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 4, oy + earY, 1, 16, skinLine, 1);
  pxRect(ctx, ox + headX - headHalfW - 4, oy + earY - 1, 4, 1, skinLine, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + earY - 1, 4, 1, skinLine, 1);
  pxRect(ctx, ox + headX - headHalfW - 4, oy + earY + 16, 4, 1, skinLine, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + earY + 16, 4, 1, skinLine, 1);
  pxRect(ctx, ox + headX - headHalfW - 2, oy + earY + 4, 2, 8, skinDeep, 0.7);
  pxRect(ctx, ox + headX + headHalfW, oy + earY + 4, 2, 8, skinDeep, 0.7);
}

function drawDefaultEyebrows(ctx, ox, oy, c, state, frameIdx, color) {
  const { headTop, headX } = c;
  const browY = headTop + 32;
  if (state === 'furious') {
    pxRect(ctx, ox + headX - 22, oy + browY, 12, 3, color, 1);
    pxRect(ctx, ox + headX - 12, oy + browY + 2, 4, 2, color, 1);
    pxRect(ctx, ox + headX + 8, oy + browY + 2, 4, 2, color, 1);
    pxRect(ctx, ox + headX + 10, oy + browY, 12, 3, color, 1);
  } else if (state === 'antsy') {
    pxRect(ctx, ox + headX - 22, oy + browY, 12, 4, color, 1);
    pxRect(ctx, ox + headX + 10, oy + browY, 12, 4, color, 1);
    pxRect(ctx, ox + headX - 12, oy + browY + 4, 2, 1, color, 1);
    pxRect(ctx, ox + headX + 10, oy + browY + 4, 2, 1, color, 1);
  } else {
    pxRect(ctx, ox + headX - 22, oy + browY, 12, 4, color, 1);
    pxRect(ctx, ox + headX + 10, oy + browY, 12, 4, color, 1);
  }
}

function drawDefaultEyes(ctx, ox, oy, c, state, frameIdx, eyeColor, blink) {
  const { headTop, headX, skinLine } = c;
  const eyeY = headTop + 38;
  const eyeW = 16;
  const eyeH = 12;
  const lx = headX - 22;
  const rx = headX + 8;
  if (state === 'furious') {
    drawEye(ctx, ox, oy, lx, eyeY, eyeW, eyeH, state, false, eyeColor, skinLine);
    drawEye(ctx, ox, oy, rx, eyeY, eyeW, eyeH, state, false, eyeColor, skinLine);
    return;
  }
  if (blink) {
    pxRect(ctx, ox + lx, oy + eyeY + 5, eyeW, 2, skinLine, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 5, eyeW, 2, skinLine, 1);
    return;
  }
  drawEye(ctx, ox, oy, lx, eyeY, eyeW, eyeH, state, false, eyeColor, skinLine);
  drawEye(ctx, ox, oy, rx, eyeY, eyeW, eyeH, state, false, eyeColor, skinLine);
}

/** Single eye in the bust style — big sclera, iris, pupil, white catchlight. */
export function drawEye(ctx, ox, oy, x, y, w, h, state, blink, eyeColor, outlineColor) {
  if (state === 'furious') {
    pxRect(ctx, ox + x, oy + y + 5, w, 4, 0xfff4d6, 1);
    pxRect(ctx, ox + x, oy + y + 4, w, 1, outlineColor, 1);
    pxRect(ctx, ox + x, oy + y + 9, w, 1, outlineColor, 1);
    pxRect(ctx, ox + x + 5, oy + y + 5, 4, 4, eyeColor, 1);
    return;
  }
  if (blink) {
    pxRect(ctx, ox + x, oy + y + 5, w, 2, outlineColor, 1);
    return;
  }
  pxRect(ctx, ox + x, oy + y, w, h, 0xfff4d6, 1);
  pxRect(ctx, ox + x - 1, oy + y, 1, h, outlineColor, 1);
  pxRect(ctx, ox + x + w, oy + y, 1, h, outlineColor, 1);
  pxRect(ctx, ox + x, oy + y - 1, w, 1, outlineColor, 1);
  pxRect(ctx, ox + x, oy + y + h, w, 1, outlineColor, 1);
  pxRect(ctx, ox + x + 1, oy + y, w - 2, 2, 0xc4b890, 0.7); // upper lid shadow
  // Iris
  pxRect(ctx, ox + x + 4, oy + y + 2, 8, h - 4, eyeColor, 1);
  pxRect(ctx, ox + x + 4, oy + y + 2, 8, 2, lighten(eyeColor, 1.5), 0.7);
  // Pupil
  pxRect(ctx, ox + x + 5, oy + y + 4, 6, 4, darken(eyeColor, 0.4), 1);
  // Single bright catchlight in upper-left
  pxRect(ctx, ox + x + 6, oy + y + 4, 2, 2, 0xffffff, 1);
}

function drawDefaultNose(ctx, ox, oy, c) {
  const { headTop, headX, skinL, skinS, skinLine } = c;
  const noseX = headX - 4;
  const noseY = headTop + 46;
  pxRect(ctx, ox + noseX, oy + noseY, 8, 14, skinS, 0.65);
  pxRect(ctx, ox + noseX, oy + noseY, 3, 12, skinL, 0.5);
  pxRect(ctx, ox + noseX, oy + noseY + 12, 8, 2, skinLine, 0.85);
  pxRect(ctx, ox + noseX + 1, oy + noseY + 10, 1, 2, darken(skinLine, 0.6), 0.85);
  pxRect(ctx, ox + noseX + 6, oy + noseY + 10, 1, 2, darken(skinLine, 0.6), 0.85);
}

function drawDefaultMouth(ctx, ox, oy, c, state, frameIdx, mouthOpen) {
  const { headTop, headX, skinLine } = c;
  const mouthY = headTop + 62;
  if (state === 'furious') {
    pxRect(ctx, ox + headX - 12, oy + mouthY, 24, 7, 0x140a06, 1);
    pxRect(ctx, ox + headX - 12, oy + mouthY, 24, 1, skinLine, 1);
    pxRect(ctx, ox + headX - 12, oy + mouthY + 7, 24, 1, skinLine, 1);
    for (let i = 0; i < 4; i++) {
      pxRect(ctx, ox + headX - 11 + i * 6, oy + mouthY + 1, 4, 4, 0xfff4d6, 1);
    }
  } else if (mouthOpen) {
    pxRect(ctx, ox + headX - 8, oy + mouthY, 16, 5, 0x140a06, 1);
    pxRect(ctx, ox + headX - 6, oy + mouthY + 1, 12, 3, 0xb44030, 1);
    pxRect(ctx, ox + headX - 8, oy + mouthY - 1, 16, 1, skinLine, 1);
    pxRect(ctx, ox + headX - 8, oy + mouthY + 5, 16, 1, skinLine, 1);
  } else if (state === 'antsy') {
    pxRect(ctx, ox + headX - 8, oy + mouthY + 1, 4, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + headX - 4, oy + mouthY, 4, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + headX, oy + mouthY + 1, 4, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + headX + 4, oy + mouthY, 4, 1, 0x4a2a1a, 1);
  } else {
    pxRect(ctx, ox + headX - 8, oy + mouthY + 1, 16, 2, 0x4a1a10, 1);
    pxRect(ctx, ox + headX - 8, oy + mouthY, 4, 1, 0x4a1a10, 1);
    pxRect(ctx, ox + headX + 4, oy + mouthY, 4, 1, 0x4a1a10, 1);
  }
}

/** Helper used by costume drawers to paint a trapezoidal shoulder body. */
export function drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, color, colorLight, colorShadow, outlineColor, shoulderHalfW = 64, bottomBulge = 18) {
  for (let y = shoulderY; y < 264; y++) {
    const t = (y - shoulderY) / Math.max(1, 264 - shoulderY);
    const half = Math.round(shoulderHalfW + t * bottomBulge);
    pxRect(ctx, ox + cx - half, oy + y, half * 2, 1, color, 1);
    if (colorLight) pxRect(ctx, ox + cx - half + 1, oy + y, 2, 1, colorLight, 0.7);
    if (colorShadow) pxRect(ctx, ox + cx + half - 3, oy + y, 2, 1, colorShadow, 0.85);
  }
  pxRect(ctx, ox + cx - shoulderHalfW, oy + shoulderY - 1, shoulderHalfW * 2, 1, outlineColor, 1);
  pxRect(ctx, ox + cx - shoulderHalfW - 1, oy + shoulderY, 1, 264 - shoulderY, outlineColor, 1);
  pxRect(ctx, ox + cx + shoulderHalfW, oy + shoulderY, 1, 264 - shoulderY, outlineColor, 1);
}
