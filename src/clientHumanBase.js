// Shared "human-shaped" body drawer used by the human-ish character
// archetypes (zombie, pirate, athlete, firefighter, santa, cop, surgeon,
// wizard, princess, ninja, construction, clown, cowboy — basically every
// character except the robot and the alien).
//
// Each archetype calls drawHumanBase(ctx, ox, oy, params, state, frameIdx)
// passing in a `params` object that controls skin color, body proportions,
// eye color, and a callback chain for the costume layers (shirt + hat +
// accessories). The base function paints anatomy + face + arms + hands,
// then invokes the callbacks at the right z-order.
//
// Layer order, back→front:
//   1. ground shadow
//   2. drawBack (e.g. cape, hair backside)
//   3. torso + neck
//   4. arms + hands
//   5. drawShirt (shirt overlay on top of base torso)
//   6. head silhouette
//   7. face shading
//   8. drawHair
//   9. eyebrows + eyes + nose + mouth (state-dependent)
//  10. drawAccessory (hat, glasses, eyepatch — last so it draws on top of hair)
//  11. drawFront (held items, beard tip)

import { pxRect, darken, lighten, OUTLINE, getPoseForFrame, drawGroundShadow } from './clientDrawHelpers.js';

export function drawHumanBase(ctx, ox, oy, params, state, frameIdx) {
  const {
    skin = 0xe8c39a,
    eyeColor = 0x4a2418,
    body = 'average',
    face = 'round',
    drawBack = null,
    drawTorso = null,    // costume-specific torso/shirt
    drawHair = null,
    drawAccessory = null,
    drawFront = null,
    // Per-frame mood/feature overrides that costume can pass in:
    mouthOverride = null,  // function(ctx, ox, oy, x, y, w, state, frameIdx)
    eyeOverride = null,    // function(ctx, ox, oy, l/r, x, y, w, h, state, frameIdx)
  } = params;

  const bodyT = BODY_TYPES[body] || BODY_TYPES.average;
  const faceT = FACE_TYPES[face] || FACE_TYPES.round;

  const pose = getPoseForFrame(state, frameIdx);
  const { bodyDY, headDX, armSwingDX, tint } = pose;

  const w = 192;
  const h = 264;
  const cx = w / 2;

  // 1) Ground shadow
  drawGroundShadow(ctx, ox, oy, cx, h, bodyT.torsoBottomW);

  // 2) Back layer (cape, hair backside, etc.)
  if (drawBack) drawBack(ctx, ox, oy, pose, bodyT, faceT, params);

  // 3+5) Torso — let the costume drawer paint it entirely. Falls back to
  // a generic gray shirt if the costume drawer is null (defensive only).
  const torsoTop = bodyT.torsoTop + bodyDY;
  if (drawTorso) {
    drawTorso(ctx, ox, oy, pose, bodyT, faceT, params);
  } else {
    drawDefaultTorso(ctx, ox, oy, bodyT, bodyDY, 0x4a4a4a, cx, h);
  }

  // 4) Arms + hands (skin showing at the bottom of each arm cuff).
  const armTop = torsoTop + 12 + bodyT.shoulderDrop;
  const armBot = h - 6 - 18;
  const armW = bodyT.armW;
  const armOffset = Math.round(armSwingDX);
  drawArmAndHand(ctx, ox, oy, cx - bodyT.torsoHalfW - armW + 3 - armOffset, armTop, armW, armBot - armTop, params);
  drawArmAndHand(ctx, ox, oy, cx + bodyT.torsoHalfW - 3 + armOffset, armTop, armW, armBot - armTop, params);

  // 6) Head silhouette
  const headH = bodyT.headSize;
  const headW = Math.round(bodyT.headSize * faceT.widthScale);
  const headX = cx - headW / 2 + headDX;
  const headY = torsoTop - headH - 6;
  drawHeadShape(ctx, ox, oy, headX, headY, headW, headH, faceT, skin);

  // 7) Face shading
  drawFaceShading(ctx, ox, oy, headX, headY, headW, headH, faceT, skin);

  // Ears
  if (faceT.widthScale > 0.85) {
    drawEars(ctx, ox, oy, headX, headY, headW, headH, skin);
  }

  // Neck (drawn after head so the jaw shadow blends)
  drawNeck(ctx, ox, oy, bodyT, bodyDY, headDX, cx, skin);

  // 8) Hair
  if (drawHair) drawHair(ctx, ox, oy, pose, headX, headY, headW, headH, params);

  // 9) Face features — eyebrows, eyes, nose, mouth
  if (eyeOverride) {
    eyeOverride(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, faceT, params);
  } else {
    drawEyebrows(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, faceT, params);
    drawEyes(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, faceT, eyeColor);
  }
  drawNose(ctx, ox, oy, headX, headY, headW, headH, skin, faceT);
  if (mouthOverride) {
    mouthOverride(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, faceT, params);
  } else {
    drawMouth(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, faceT);
  }

  // 10) Accessory (hat, glasses, etc.)
  if (drawAccessory) drawAccessory(ctx, ox, oy, pose, headX, headY, headW, headH, params);

  // 11) Front layer (held items)
  if (drawFront) drawFront(ctx, ox, oy, pose, bodyT, faceT, params);

  // Baked global tint (e.g. furious red flash).
  if (tint) {
    pxRect(ctx, ox, oy, w, h, tint.color, tint.alpha);
  }
}

// ============================================================================
// Body / face type tables
// ============================================================================

export const BODY_TYPES = {
  average: { torsoTop: 126, torsoHalfW: 42, torsoBottomW: 39, headSize: 72, neckW: 15, armW: 21, shoulderDrop: 0 },
  thin:    { torsoTop: 120, torsoHalfW: 30, torsoBottomW: 27, headSize: 66, neckW: 12, armW: 15, shoulderDrop: 3 },
  wide:    { torsoTop: 132, torsoHalfW: 54, torsoBottomW: 51, headSize: 78, neckW: 18, armW: 24, shoulderDrop: 0 },
  tall:    { torsoTop: 114, torsoHalfW: 36, torsoBottomW: 33, headSize: 66, neckW: 15, armW: 18, shoulderDrop: 3 },
  stout:   { torsoTop: 138, torsoHalfW: 51, torsoBottomW: 54, headSize: 72, neckW: 21, armW: 24, shoulderDrop: 6 },
};

export const FACE_TYPES = {
  round:   { widthScale: 1.0,  topCornersIn: 6, botCornersIn: 6, chinTaper: 0,  eyeYOffset: 0 },
  long:    { widthScale: 0.85, topCornersIn: 3, botCornersIn: 3, chinTaper: 0,  eyeYOffset: -3 },
  square:  { widthScale: 1.05, topCornersIn: 3, botCornersIn: 3, chinTaper: 0,  eyeYOffset: 0 },
  pointed: { widthScale: 0.9,  topCornersIn: 6, botCornersIn: 0, chinTaper: 12, eyeYOffset: 0 },
  wide:    { widthScale: 1.2,  topCornersIn: 9, botCornersIn: 9, chinTaper: 0,  eyeYOffset: 3 },
};

// ============================================================================
// Drawing pieces
// ============================================================================

function drawDefaultTorso(ctx, ox, oy, body, bodyDY, color, cx, h) {
  const torsoTop = body.torsoTop + bodyDY;
  const torsoBot = h - 6;
  const halfTop = body.torsoHalfW;
  const halfBot = body.torsoBottomW;
  const torsoH = torsoBot - torsoTop;
  for (let r = 0; r < torsoH; r++) {
    const t = r / Math.max(1, torsoH - 1);
    const half = Math.round(halfTop + (halfBot - halfTop) * t);
    const y = torsoTop + r;
    pxRect(ctx, ox + cx - half, oy + y, half * 2, 1, color, 1);
    pxRect(ctx, ox + cx - half - 2, oy + y, 2, 1, OUTLINE, 1);
    pxRect(ctx, ox + cx + half, oy + y, 2, 1, OUTLINE, 1);
  }
  pxRect(ctx, ox + cx - halfTop, oy + torsoTop - 1, halfTop * 2, 1, OUTLINE, 1);
}

function drawArmAndHand(ctx, ox, oy, x, y, w, h, params) {
  const { skin = 0xe8c39a, sleeveColor = 0x4a4a4a } = params;
  const sleeveLight = lighten(sleeveColor, 1.2);
  const sleeveDark = darken(sleeveColor, 0.7);
  const sleeveDarker = darken(sleeveColor, 0.45);
  // Arm body
  pxRect(ctx, ox + x, oy + y, w, h, sleeveColor, 1);
  pxRect(ctx, ox + x - 2, oy + y, 2, h, OUTLINE, 1);
  pxRect(ctx, ox + x + w, oy + y, 2, h, OUTLINE, 1);
  pxRect(ctx, ox + x, oy + y - 1, w, 1, OUTLINE, 1);
  // Shading
  pxRect(ctx, ox + x, oy + y, 3, h, sleeveLight, 0.75);
  pxRect(ctx, ox + x + w - 4, oy + y, 4, h, sleeveDark, 0.6);
  // Cuff
  pxRect(ctx, ox + x, oy + y + h - 6, w, 6, sleeveDark, 1);
  pxRect(ctx, ox + x, oy + y + h - 4, w, 1, sleeveDarker, 0.85);

  // Hand
  drawHand(ctx, ox, oy, x, y + h, w, skin);
}

function drawHand(ctx, ox, oy, x, y, w, skin) {
  const skinShadow = darken(skin, 0.78);
  const skinDeep = darken(skin, 0.58);
  const skinHighlight = lighten(skin, 1.1);
  const hH = 18;
  pxRect(ctx, ox + x - 3, oy + y, w + 6, hH - 9, skin, 1);
  const fingerW = Math.floor((w + 6) / 4);
  for (let i = 0; i < 4; i++) {
    const fx = x - 3 + i * fingerW;
    const fw = i === 3 ? (w + 6) - i * fingerW : fingerW;
    pxRect(ctx, ox + fx, oy + y + hH - 9, fw - 1, 9, skin, 1);
    if (i > 0) pxRect(ctx, ox + fx - 1, oy + y + hH - 9, 1, 9, skinDeep, 0.85);
  }
  pxRect(ctx, ox + x - 5, oy + y, 2, hH, OUTLINE, 1);
  pxRect(ctx, ox + x + w + 3, oy + y, 2, hH, OUTLINE, 1);
  pxRect(ctx, ox + x - 3, oy + y + hH - 1, w + 6, 1, OUTLINE, 1);
  pxRect(ctx, ox + x - 1, oy + y + 1, w + 2, 2, skinHighlight, 0.75);
  pxRect(ctx, ox + x + w, oy + y + 2, 3, hH - 2, skinShadow, 0.55);
}

function drawHeadShape(ctx, ox, oy, headX, headY, headW, headH, face, skin) {
  const tc = face.topCornersIn;
  const bc = face.botCornersIn;
  const ct = face.chinTaper;
  for (let r = 0; r < headH; r++) {
    let left = 0;
    let right = 0;
    if (r < tc) {
      const k = tc - r;
      left = Math.round(k * 0.9);
      right = Math.round(k * 0.9);
    }
    if (r >= headH - bc) {
      const k = bc - (headH - 1 - r);
      left = Math.max(left, Math.round(k * 0.9));
      right = Math.max(right, Math.round(k * 0.9));
    }
    if (r >= headH - ct) {
      const d = r - (headH - ct);
      left = Math.max(left, Math.floor(d * 0.85));
      right = Math.max(right, Math.floor(d * 0.85));
    }
    const rowW = headW - left - right;
    if (rowW <= 0) continue;
    const rowX = headX + left;
    pxRect(ctx, ox + rowX, oy + headY + r, rowW, 1, skin, 1);
    pxRect(ctx, ox + rowX - 2, oy + headY + r, 2, 1, OUTLINE, 1);
    pxRect(ctx, ox + rowX + rowW, oy + headY + r, 2, 1, OUTLINE, 1);
  }
  pxRect(ctx, ox + headX + tc, oy + headY - 1, headW - tc * 2, 1, OUTLINE, 1);
  const chinInset = Math.max(bc, Math.floor(ct * 0.85));
  pxRect(ctx, ox + headX + chinInset, oy + headY + headH, headW - chinInset * 2, 1, OUTLINE, 1);
}

function drawFaceShading(ctx, ox, oy, headX, headY, headW, headH, face, skin) {
  const skinShadow = darken(skin, 0.78);
  const skinHighlight = lighten(skin, 1.1);
  pxRect(ctx, ox + headX + headW - 9, oy + headY + 9, 6, headH - 18, skinShadow, 0.4);
  pxRect(ctx, ox + headX + 6, oy + headY + headH - 6, headW - 12, 6, skinShadow, 0.4);
  const blush = 0xff7a8a;
  pxRect(ctx, ox + headX + 6, oy + headY + headH - 24, 12, 6, blush, 0.32);
  pxRect(ctx, ox + headX + headW - 18, oy + headY + headH - 24, 12, 6, blush, 0.32);
  pxRect(ctx, ox + headX + 9, oy + headY + 18, 6, 12, skinHighlight, 0.55);
  pxRect(ctx, ox + headX + 12, oy + headY + 15, 12, 3, skinHighlight, 0.4);
}

function drawEars(ctx, ox, oy, headX, headY, headW, headH, skin) {
  const skinDeep = darken(skin, 0.58);
  const earY = headY + Math.floor(headH * 0.42);
  const earH = 18;
  pxRect(ctx, ox + headX - 6, oy + earY, 6, earH, skin, 1);
  pxRect(ctx, ox + headX + headW, oy + earY, 6, earH, skin, 1);
  pxRect(ctx, ox + headX - 8, oy + earY, 2, earH, OUTLINE, 1);
  pxRect(ctx, ox + headX + headW + 6, oy + earY, 2, earH, OUTLINE, 1);
  pxRect(ctx, ox + headX - 6, oy + earY - 1, 6, 1, OUTLINE, 1);
  pxRect(ctx, ox + headX + headW, oy + earY - 1, 6, 1, OUTLINE, 1);
  pxRect(ctx, ox + headX - 6, oy + earY + earH, 6, 1, OUTLINE, 1);
  pxRect(ctx, ox + headX + headW, oy + earY + earH, 6, 1, OUTLINE, 1);
  pxRect(ctx, ox + headX - 3, oy + earY + 6, 3, 9, skinDeep, 0.7);
  pxRect(ctx, ox + headX + headW, oy + earY + 6, 3, 9, skinDeep, 0.7);
}

function drawNeck(ctx, ox, oy, body, bodyDY, headDX, cx, skin) {
  const skinShadow = darken(skin, 0.78);
  const skinDeep = darken(skin, 0.58);
  const neckTop = body.torsoTop + bodyDY - 15;
  const halfW = body.neckW;
  const offset = Math.floor(headDX / 2);
  pxRect(ctx, ox + cx - halfW + offset, oy + neckTop, halfW * 2, 15, skin, 1);
  pxRect(ctx, ox + cx - halfW + offset - 2, oy + neckTop, 2, 15, OUTLINE, 1);
  pxRect(ctx, ox + cx + halfW + offset, oy + neckTop, 2, 15, OUTLINE, 1);
  pxRect(ctx, ox + cx - halfW + offset, oy + neckTop, halfW * 2, 6, skinShadow, 0.8);
  pxRect(ctx, ox + cx + offset, oy + neckTop, halfW, 12, skinShadow, 0.45);
}

export function drawEyebrows(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, face, params = {}) {
  const browColor = params.browColor || 0x3a2418;
  const eyeY = headY + Math.floor(headH * 0.4) + face.eyeYOffset;
  const browY = eyeY - 9;
  const inset = Math.max(6, Math.floor(headW * 0.18));
  const browW = Math.max(12, Math.floor(headW * 0.22));
  const lx = headX + inset;
  const rx = headX + headW - inset - browW;

  if (state === 'furious') {
    for (let r = 0; r < 5; r++) {
      const slope = Math.floor(r * 0.6);
      pxRect(ctx, ox + lx + slope, oy + browY + r, browW - slope, 1, browColor, 1);
      pxRect(ctx, ox + rx, oy + browY + r, browW - slope, 1, browColor, 1);
    }
  } else if (state === 'antsy') {
    pxRect(ctx, ox + lx, oy + browY, browW, 5, browColor, 1);
    pxRect(ctx, ox + rx, oy + browY, browW, 5, browColor, 1);
    pxRect(ctx, ox + lx + browW - 3, oy + browY + 5, 3, 2, browColor, 1);
    pxRect(ctx, ox + rx, oy + browY + 5, 3, 2, browColor, 1);
  } else {
    pxRect(ctx, ox + lx, oy + browY, browW, 5, browColor, 1);
    pxRect(ctx, ox + rx, oy + browY, browW, 5, browColor, 1);
  }
}

export function drawEyes(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, face, eyeColor = 0x4a2418) {
  const eyeY = headY + Math.floor(headH * 0.4) + face.eyeYOffset;
  const inset = Math.max(6, Math.floor(headW * 0.18));
  const eyeW = Math.max(12, Math.floor(headW * 0.22));
  const eyeH = 12;
  const lx = headX + inset;
  const rx = headX + headW - inset - eyeW;

  if (state === 'furious') {
    pxRect(ctx, ox + lx, oy + eyeY + 6, eyeW, 4, 0xfff4d6, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 6, eyeW, 4, 0xfff4d6, 1);
    pxRect(ctx, ox + lx, oy + eyeY + 5, eyeW, 1, OUTLINE, 1);
    pxRect(ctx, ox + lx, oy + eyeY + 10, eyeW, 1, OUTLINE, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 5, eyeW, 1, OUTLINE, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 10, eyeW, 1, OUTLINE, 1);
    pxRect(ctx, ox + lx + 3, oy + eyeY + 6, 4, 4, 0x1a1a1a, 1);
    pxRect(ctx, ox + rx + eyeW - 7, oy + eyeY + 6, 4, 4, 0x1a1a1a, 1);
    return;
  }
  // Blinks — frame 5 of idle/normal closes the eye.
  const blinking = (state === 'idle' || state === 'normal') && frameIdx === 5;
  if (blinking) {
    pxRect(ctx, ox + lx, oy + eyeY + 5, eyeW, 2, OUTLINE, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 5, eyeW, 2, OUTLINE, 1);
    return;
  }
  pxRect(ctx, ox + lx, oy + eyeY, eyeW, eyeH, 0xfff4d6, 1);
  pxRect(ctx, ox + rx, oy + eyeY, eyeW, eyeH, 0xfff4d6, 1);
  pxRect(ctx, ox + lx - 2, oy + eyeY, 2, eyeH, OUTLINE, 1);
  pxRect(ctx, ox + lx + eyeW, oy + eyeY, 2, eyeH, OUTLINE, 1);
  pxRect(ctx, ox + lx, oy + eyeY - 2, eyeW, 2, OUTLINE, 1);
  pxRect(ctx, ox + lx, oy + eyeY + eyeH, eyeW, 2, OUTLINE, 1);
  pxRect(ctx, ox + rx - 2, oy + eyeY, 2, eyeH, OUTLINE, 1);
  pxRect(ctx, ox + rx + eyeW, oy + eyeY, 2, eyeH, OUTLINE, 1);
  pxRect(ctx, ox + rx, oy + eyeY - 2, eyeW, 2, OUTLINE, 1);
  pxRect(ctx, ox + rx, oy + eyeY + eyeH, eyeW, 2, OUTLINE, 1);

  // Iris + pupil
  const irisW = Math.floor(eyeW * 0.7);
  const irisH = eyeH - 2;
  const irisXL = lx + Math.floor((eyeW - irisW) / 2);
  const irisXR = rx + Math.floor((eyeW - irisW) / 2);
  pxRect(ctx, ox + irisXL, oy + eyeY + 1, irisW, irisH, eyeColor, 1);
  pxRect(ctx, ox + irisXR, oy + eyeY + 1, irisW, irisH, eyeColor, 1);
  pxRect(ctx, ox + irisXL, oy + eyeY + 1, irisW, 2, lighten(eyeColor, 1.5), 0.7);
  pxRect(ctx, ox + irisXR, oy + eyeY + 1, irisW, 2, lighten(eyeColor, 1.5), 0.7);
  pxRect(ctx, ox + irisXL, oy + eyeY + irisH - 1, irisW, 2, darken(eyeColor, 0.6), 0.65);
  pxRect(ctx, ox + irisXR, oy + eyeY + irisH - 1, irisW, 2, darken(eyeColor, 0.6), 0.65);

  const pupilW = Math.floor(irisW * 0.5);
  const pupilH = Math.floor(irisH * 0.7);
  const pupilXL = lx + Math.floor((eyeW - pupilW) / 2);
  const pupilXR = rx + Math.floor((eyeW - pupilW) / 2);
  const pupilY = eyeY + Math.floor((eyeH - pupilH) / 2);
  pxRect(ctx, ox + pupilXL, oy + pupilY, pupilW, pupilH, 0x1a1a1a, 1);
  pxRect(ctx, ox + pupilXR, oy + pupilY, pupilW, pupilH, 0x1a1a1a, 1);
  pxRect(ctx, ox + pupilXL, oy + pupilY, Math.ceil(pupilW / 2), Math.ceil(pupilH / 2), 0xffffff, 1);
  pxRect(ctx, ox + pupilXR, oy + pupilY, Math.ceil(pupilW / 2), Math.ceil(pupilH / 2), 0xffffff, 1);
}

export function drawNose(ctx, ox, oy, headX, headY, headW, headH, skin, face) {
  const skinShadow = darken(skin, 0.78);
  const skinHighlight = lighten(skin, 1.1);
  const skinDeep = darken(skin, 0.58);
  const cx = headX + Math.floor(headW / 2);
  const noseY = headY + Math.floor(headH * 0.52);
  pxRect(ctx, ox + cx - 3, oy + noseY, 6, 6, skinShadow, 0.6);
  pxRect(ctx, ox + cx - 5, oy + noseY + 6, 10, 9, skinShadow, 0.85);
  pxRect(ctx, ox + cx - 4, oy + noseY + 9, 8, 6, skinShadow, 1);
  pxRect(ctx, ox + cx - 5, oy + noseY + 15, 10, 2, skinDeep, 0.9);
  pxRect(ctx, ox + cx - 3, oy + noseY, 2, 8, skinHighlight, 0.75);
  pxRect(ctx, ox + cx - 3, oy + noseY + 12, 2, 2, OUTLINE, 0.85);
  pxRect(ctx, ox + cx + 1, oy + noseY + 12, 2, 2, OUTLINE, 0.85);
}

export function drawMouth(ctx, ox, oy, headX, headY, headW, headH, state, frameIdx, face) {
  const cx = headX + Math.floor(headW / 2);
  const my = headY + Math.floor(headH * 0.72);
  const w = Math.max(18, Math.floor(headW * 0.32));

  if (state === 'furious') {
    pxRect(ctx, ox + cx - w / 2, oy + my, w, 12, 0x4a1a10, 1);
    pxRect(ctx, ox + cx - w / 2 - 1, oy + my, w + 2, 1, OUTLINE, 1);
    pxRect(ctx, ox + cx - w / 2 - 1, oy + my + 11, w + 2, 1, OUTLINE, 1);
    const teethY = my + 2;
    const teethGap = Math.floor((w - 6) / 4);
    for (let i = 0; i < 4; i++) {
      const tx = cx - w / 2 + 3 + i * teethGap;
      pxRect(ctx, ox + tx, oy + teethY, teethGap - 2, 6, 0xfff4d6, 1);
    }
  } else if (state === 'antsy') {
    pxRect(ctx, ox + cx - w / 2, oy + my + 3, 3, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx - w / 2 + 3, oy + my + 1, 3, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx - w / 2 + 6, oy + my + 3, 3, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx - w / 2 + 9, oy + my + 1, 3, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx - w / 2 + 12, oy + my + 3, w - 12, 1, 0x4a2a1a, 1);
  } else if (state === 'talking_left' || state === 'talking_right') {
    // 6-frame talking cycle — alternates open/closed across frames.
    const open = frameIdx % 2 === 1;
    if (open) {
      pxRect(ctx, ox + cx - w / 2 + 3, oy + my, w - 6, 9, 0x2a1410, 1);
      pxRect(ctx, ox + cx - w / 2 + 6, oy + my + 4, w - 12, 4, 0xc44a4a, 1);
    } else {
      pxRect(ctx, ox + cx - w / 2, oy + my + 3, w, 2, 0x4a2a1a, 1);
    }
  } else {
    pxRect(ctx, ox + cx - w / 2 + 3, oy + my + 3, w - 6, 2, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx - w / 2, oy + my + 1, 3, 2, 0x4a2a1a, 1);
    pxRect(ctx, ox + cx + w / 2 - 3, oy + my + 1, 3, 2, 0x4a2a1a, 1);
  }
}
