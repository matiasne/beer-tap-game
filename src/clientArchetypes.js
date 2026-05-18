// Per-character draw functions for the 16 themed clients.
//
// All characters use the **bust-style** framework (head + shoulders + upper
// torso, contextual outlines, top-left lighting, painterly 3-tone shading,
// big toon eyes). Each archetype is a thin wrapper around `drawBustBase`
// that passes in its palette + per-feature callbacks (torso/costume, hair,
// accessory, beard etc.).

import { drawBustBase, drawTrapezoidalTorso, drawEye } from './clientBustBase.js';
import { pxRect, darken, lighten } from './clientDrawHelpers.js';

// ============================================================================
// ZOMBIE — green skin, stitched mouth, sunken eyes, ragged shirt
// ============================================================================
function drawZombie(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0x6a9a5a,
    eyeColor: 0xc44a4a,
    browColor: 0x1a2a14,
    headWidth: 80,
    headHeight: 82,
    showEars: true,
    drawTorso: (c, x, y, ctxAll) => drawZombieShirt(c, x, y, ctxAll),
    drawHair: (c, x, y, ctxAll) => drawZombieHair(c, x, y, ctxAll),
    eyeOverride: drawZombieEyes,
    mouthOverride: drawZombieMouth,
  }, state, frameIdx);
}

function drawZombieShirt(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const shirt = 0x5a3a2a;
  const shirtL = lighten(shirt, 1.3);
  const shirtS = darken(shirt, 0.6);
  const shirtLine = 0x2a1408;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, shirt, shirtL, shirtS, shirtLine, 64, 18);
  // Ragged tears
  pxRect(ctx, ox + cx - 28, oy + shoulderY + 30, 14, 4, 0x1a1410, 1);
  pxRect(ctx, ox + cx + 12, oy + shoulderY + 55, 12, 4, 0x1a1410, 1);
  pxRect(ctx, ox + cx - 4, oy + shoulderY + 80, 14, 4, 0x1a1410, 1);
  // Bloodstain on chest
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 18, 14, 12, 0x6a1a10, 1);
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 18, 14, 3, 0x9a2a20, 0.85);
  pxRect(ctx, ox + cx - 2, oy + shoulderY + 30, 4, 18, 0x6a1a10, 1);
  pxRect(ctx, ox + cx + 0, oy + shoulderY + 48, 2, 8, 0x6a1a10, 1);
}

function drawZombieHair(ctx, ox, oy, c) {
  const { headX, headY, headTop, headHalfW } = c;
  // Patchy dark-green tufts
  const hair = 0x2a3a1a;
  const hairLight = 0x4a6028;
  pxRect(ctx, ox + headX - headHalfW + 8, oy + headTop - 4, 22, 10, hair, 1);
  pxRect(ctx, ox + headX + headHalfW - 26, oy + headTop - 2, 18, 8, hair, 1);
  pxRect(ctx, ox + headX - headHalfW + 8, oy + headTop - 6, 22, 2, 0x140a04, 1);
  pxRect(ctx, ox + headX + headHalfW - 26, oy + headTop - 4, 18, 2, 0x140a04, 1);
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 4, 2, 10, 0x140a04, 1);
  pxRect(ctx, ox + headX - headHalfW + 28, oy + headTop - 4, 2, 10, 0x140a04, 1);
  pxRect(ctx, ox + headX + headHalfW - 28, oy + headTop - 2, 2, 8, 0x140a04, 1);
  pxRect(ctx, ox + headX + headHalfW - 8, oy + headTop - 2, 2, 8, 0x140a04, 1);
  pxRect(ctx, ox + headX - headHalfW + 11, oy + headTop - 2, 6, 3, hairLight, 0.7);
  // Forehead stitched scar
  pxRect(ctx, ox + headX - 14, oy + headTop + 18, 28, 2, 0x4a1a10, 1);
  for (let i = 0; i < 5; i++) {
    pxRect(ctx, ox + headX - 14 + i * 7, oy + headTop + 16, 2, 6, 0x4a1a10, 1);
  }
}

function drawZombieEyes(ctx, ox, oy, c, state, frameIdx) {
  const { headTop, headX } = c;
  const eyeY = headTop + 38;
  const eyeW = 16;
  const eyeH = 12;
  const lx = headX - 22;
  const rx = headX + 8;
  // Sunken sockets (darker green-grey around the eyes)
  pxRect(ctx, ox + lx - 3, oy + eyeY - 2, eyeW + 6, eyeH + 4, 0x2a3024, 1);
  pxRect(ctx, ox + rx - 3, oy + eyeY - 2, eyeW + 6, eyeH + 4, 0x2a3024, 1);
  // Glowing red pupils — no full sclera, just glowing dots
  const pupilW = 6;
  const pupilH = 8;
  pxRect(ctx, ox + lx + 5, oy + eyeY + 2, pupilW, pupilH, 0xff4a2a, 1);
  pxRect(ctx, ox + rx + 5, oy + eyeY + 2, pupilW, pupilH, 0xff4a2a, 1);
  pxRect(ctx, ox + lx + 6, oy + eyeY + 3, 2, 3, 0xffaa8a, 1);
  pxRect(ctx, ox + rx + 6, oy + eyeY + 3, 2, 3, 0xffaa8a, 1);
}

function drawZombieMouth(ctx, ox, oy, c, state, frameIdx) {
  const { headTop, headX } = c;
  const my = headTop + 62;
  const w = 24;
  pxRect(ctx, ox + headX - w / 2, oy + my + 3, w, 2, 0x1a1a10, 1);
  for (let i = 0; i < 4; i++) {
    const sx = headX - w / 2 + 3 + i * 6;
    pxRect(ctx, ox + sx, oy + my, 2, 9, 0x4a1410, 1);
  }
}

// ============================================================================
// PIRATE — striped shirt, dark vest, bandana, eyepatch, beard, hoop earring
// ============================================================================
function drawPirate(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xd9a878,
    eyeColor: 0x3a2010,
    headWidth: 80,
    headHeight: 80,
    drawTorso: drawPirateTorso,
    drawHair: drawPirateHair,
    drawAccessory: drawPirateAccessory,
    drawFront: drawPirateBeard,
    eyeOverride: drawPirateEyes, // hides the left eye behind eyepatch
  }, state, frameIdx);
}

function drawPirateTorso(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const vestM = 0x3a1c10;
  const vestL = 0x6a3a1c;
  const vestS = 0x1a0c06;
  const vestLine = 0x1a0c06;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, vestM, vestL, vestS, vestLine, 64, 18);
  // Striped shirt V opening
  const vTop = shoulderY + 2;
  const shirtCream = 0xf2deba;
  const shirtRed = 0xc24438;
  const shirtRedL = 0xe06a52;
  for (let y = vTop; y < 264; y++) {
    const t = (y - vTop) / Math.max(1, 264 - vTop);
    const half = Math.round(8 + t * 18);
    pxRect(ctx, ox + cx - half, oy + y, half * 2, 1, shirtCream, 1);
  }
  for (let y = vTop + 8; y < 264; y += 12) {
    const t = (y - vTop) / Math.max(1, 264 - vTop);
    const half = Math.round(8 + t * 18);
    pxRect(ctx, ox + cx - half + 1, oy + y, half * 2 - 2, 4, shirtRed, 1);
    pxRect(ctx, ox + cx - half + 1, oy + y, half * 2 - 2, 1, shirtRedL, 0.75);
  }
  // V outline
  for (let y = vTop; y < 264; y++) {
    const t = (y - vTop) / Math.max(1, 264 - vTop);
    const half = Math.round(8 + t * 18);
    pxRect(ctx, ox + cx - half - 1, oy + y, 1, 1, vestLine, 1);
    pxRect(ctx, ox + cx + half, oy + y, 1, 1, vestLine, 1);
  }
  // Belt buckle at bottom of frame
  pxRect(ctx, ox + cx - 14, oy + 252, 28, 12, 0xc4a020, 1);
  pxRect(ctx, ox + cx - 14, oy + 252, 28, 3, 0xffd040, 1);
  pxRect(ctx, ox + cx - 14, oy + 261, 28, 3, 0x8a6010, 1);
  pxRect(ctx, ox + cx - 15, oy + 252, 1, 12, 0x4a3010, 1);
  pxRect(ctx, ox + cx + 14, oy + 252, 1, 12, 0x4a3010, 1);
}

function drawPirateHair(ctx, ox, oy, c) {
  const { headX, headHalfW, headTop } = c;
  const hairM = 0x2a1a10;
  const hairL = 0x5a3a24;
  const hairLine = 0x140a06;
  for (let dy = 0; dy < 36; dy++) {
    const y = headTop + 24 + dy;
    pxRect(ctx, ox + headX - headHalfW - 6, oy + y, 8, 1, hairM, 1);
    pxRect(ctx, ox + headX + headHalfW - 2, oy + y, 8, 1, hairM, 1);
  }
  pxRect(ctx, ox + headX - headHalfW - 4, oy + headTop + 28, 2, 24, hairL, 0.75);
  pxRect(ctx, ox + headX - headHalfW - 7, oy + headTop + 24, 1, 36, hairLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 5, oy + headTop + 24, 1, 36, hairLine, 1);
}

function drawPirateAccessory(ctx, ox, oy, c) {
  const { headX, headHalfW, headTop } = c;
  const bandanaM = 0xc24438;
  const bandanaL = 0xe06450;
  const bandanaS = 0x80201a;
  const bandanaLine = 0x401010;
  const bTop = headTop + 6;
  const bBot = headTop + 22;
  for (let y = bTop; y <= bBot; y++) {
    pxRect(ctx, ox + headX - headHalfW - 3, oy + y, headHalfW * 2 + 6, 1, bandanaM, 1);
  }
  pxRect(ctx, ox + headX - headHalfW - 3, oy + bTop, headHalfW * 2 + 6, 2, bandanaL, 0.85);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + bBot - 1, headHalfW * 2 + 6, 2, bandanaS, 0.8);
  // White skull dots
  pxRect(ctx, ox + headX - 22, oy + bTop + 4, 5, 5, 0xfff4d6, 1);
  pxRect(ctx, ox + headX - 2, oy + bTop + 6, 5, 5, 0xfff4d6, 1);
  pxRect(ctx, ox + headX + 18, oy + bTop + 4, 5, 5, 0xfff4d6, 1);
  // Outline
  pxRect(ctx, ox + headX - headHalfW - 4, oy + bTop, 1, bBot - bTop + 1, bandanaLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + bTop, 1, bBot - bTop + 1, bandanaLine, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + bTop - 1, headHalfW * 2 + 6, 1, bandanaLine, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + bBot + 1, headHalfW * 2 + 6, 1, bandanaLine, 1);
  // Knot tail
  pxRect(ctx, ox + headX + headHalfW + 4, oy + bTop + 4, 6, 14, bandanaM, 1);
  pxRect(ctx, ox + headX + headHalfW + 8, oy + bTop + 16, 4, 14, bandanaM, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + bTop + 4, 1, 14, bandanaLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 10, oy + bTop + 4, 1, 14, bandanaLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 7, oy + bTop + 16, 1, 14, bandanaLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 12, oy + bTop + 16, 1, 14, bandanaLine, 1);
  pxRect(ctx, ox + headX + headHalfW + 8, oy + bTop + 31, 4, 1, bandanaLine, 1);
  // Gold hoop earring
  const earY = headTop + 50;
  pxRect(ctx, ox + headX + headHalfW + 1, oy + earY, 6, 9, 0xc4a020, 1);
  pxRect(ctx, ox + headX + headHalfW + 1, oy + earY, 6, 2, 0xffd040, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + earY + 3, 2, 3, 0x4a3010, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + earY, 1, 9, 0x4a3010, 1);
  pxRect(ctx, ox + headX + headHalfW + 7, oy + earY, 1, 9, 0x4a3010, 1);
}

function drawPirateBeard(ctx, ox, oy, c) {
  const { headTop, headBottom, headX } = c;
  const beardM = 0x1a1208;
  const beardL = 0x3a2418;
  const beardLine = 0x0a0604;
  const bTop = headTop + 56;
  pxRect(ctx, ox + headX - 22, oy + bTop, 44, 5, beardM, 1);
  pxRect(ctx, ox + headX - 22, oy + bTop, 44, 2, beardL, 0.8);
  for (let y = bTop + 5; y <= headBottom + 4; y++) {
    const ty = (y - (bTop + 5)) / Math.max(1, headBottom + 4 - (bTop + 5));
    const half = 24 - Math.round(ty * 4);
    pxRect(ctx, ox + headX - half, oy + y, half * 2, 1, beardM, 1);
    if (ty < 0.5) pxRect(ctx, ox + headX - half + 2, oy + y, half * 2 - 4, 1, beardL, 0.4);
  }
  pxRect(ctx, ox + headX - 8, oy + headBottom + 4, 16, 8, beardM, 1);
  pxRect(ctx, ox + headX - 5, oy + headBottom + 12, 10, 6, beardM, 1);
  pxRect(ctx, ox + headX - 3, oy + headBottom + 18, 6, 5, beardM, 1);
  pxRect(ctx, ox + headX - 26, oy + bTop + 5, 1, headBottom + 4 - bTop - 5, beardLine, 1);
  pxRect(ctx, ox + headX + 24, oy + bTop + 5, 1, headBottom + 4 - bTop - 5, beardLine, 1);
  pxRect(ctx, ox + headX - 9, oy + headBottom + 4, 1, 8, beardLine, 1);
  pxRect(ctx, ox + headX + 8, oy + headBottom + 4, 1, 8, beardLine, 1);
  pxRect(ctx, ox + headX - 6, oy + headBottom + 12, 1, 6, beardLine, 1);
  pxRect(ctx, ox + headX + 5, oy + headBottom + 12, 1, 6, beardLine, 1);
  pxRect(ctx, ox + headX - 4, oy + headBottom + 18, 1, 5, beardLine, 1);
  pxRect(ctx, ox + headX + 3, oy + headBottom + 18, 1, 5, beardLine, 1);
}

function drawPirateEyes(ctx, ox, oy, c, state, frameIdx) {
  const { headTop, headX, skinLine } = c;
  const eyeY = headTop + 38;
  const eyeW = 16;
  const eyeH = 12;
  const lx = headX - 22;
  const rx = headX + 8;
  // Eyepatch on the LEFT
  pxRect(ctx, ox + lx - 2, oy + eyeY - 2, eyeW + 4, eyeH + 4, 0x0a0a0a, 1);
  pxRect(ctx, ox + lx - 2, oy + eyeY - 2, eyeW + 4, 3, 0x2a2a2a, 1);
  pxRect(ctx, ox + lx - 3, oy + eyeY - 2, 1, eyeH + 4, 0x000000, 1);
  pxRect(ctx, ox + lx + eyeW + 2, oy + eyeY - 2, 1, eyeH + 4, 0x000000, 1);
  pxRect(ctx, ox + lx - 2, oy + eyeY - 3, eyeW + 4, 1, 0x000000, 1);
  pxRect(ctx, ox + lx - 2, oy + eyeY + eyeH + 2, eyeW + 4, 1, 0x000000, 1);
  // Strap up under the bandana
  pxRect(ctx, ox + lx - 2, oy + headTop + 22, 4, eyeY - headTop - 22, 0x1a1a1a, 0.9);
  // Right eye normal
  const blinkR = (state === 'idle' || state === 'normal') && frameIdx === 5;
  drawEye(ctx, ox, oy, rx, eyeY, eyeW, eyeH, state, blinkR, 0x3a2010, skinLine);
}

// ============================================================================
// ALIEN — bespoke (bigger head, big black eyes, slit mouth, tendrils)
// ============================================================================
function drawAlien(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0x4a9aaa,
    eyeColor: 0x000000,
    headWidth: 110,
    headHeight: 96,
    shoulderHalfW: 60,
    showEars: false,
    blush: 0x6abaca,
    drawTorso: drawAlienSuit,
    drawHair: drawAlienTendrils,
    eyeOverride: drawAlienEyes,
    noseOverride: () => {},
    mouthOverride: drawAlienMouth,
    eyebrowOverride: () => {},
  }, state, frameIdx);
}

function drawAlienSuit(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const suit = 0x1a1a2a;
  const suitL = 0x3a3a5a;
  const suitS = 0x0a0a18;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, suit, suitL, suitS, suitS, 60, 16);
  // Flared collar
  pxRect(ctx, ox + cx - 32, oy + shoulderY - 9, 64, 18, suit, 1);
  pxRect(ctx, ox + cx - 32, oy + shoulderY - 9, 64, 3, suitL, 1);
  pxRect(ctx, ox + cx - 32, oy + shoulderY + 6, 64, 3, 0x0a0a18, 1);
  pxRect(ctx, ox + cx - 34, oy + shoulderY - 9, 2, 18, suitS, 1);
  pxRect(ctx, ox + cx + 32, oy + shoulderY - 9, 2, 18, suitS, 1);
  pxRect(ctx, ox + cx - 32, oy + shoulderY - 12, 64, 3, suitS, 1);
  // Glowing chest emblem
  const accent = 0xa040c4;
  pxRect(ctx, ox + cx - 14, oy + shoulderY + 22, 28, 28, accent, 1);
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 26, 20, 8, 0xff7afa, 0.9);
  pxRect(ctx, ox + cx - 16, oy + shoulderY + 20, 32, 2, suitS, 0.8);
  pxRect(ctx, ox + cx - 16, oy + shoulderY + 50, 32, 2, suitS, 0.8);
}

function drawAlienTendrils(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const skin = 0x4a9aaa;
  const skinL = 0x7accdd;
  // Three tendrils on top
  for (const slant of [-1, 0, 1]) {
    const baseX = headX + slant * 18;
    const tipX = baseX + slant * 4;
    pxRect(ctx, ox + baseX - 2, oy + headTop - 6, 6, 8, skin, 1);
    pxRect(ctx, ox + baseX - 1, oy + headTop - 14, 4, 8, skin, 1);
    pxRect(ctx, ox + tipX - 3, oy + headTop - 22, 6, 8, skin, 1);
    pxRect(ctx, ox + baseX - 4, oy + headTop - 6, 2, 8, 0x18404a, 1);
    pxRect(ctx, ox + baseX + 4, oy + headTop - 6, 2, 8, 0x18404a, 1);
    pxRect(ctx, ox + tipX - 5, oy + headTop - 22, 2, 8, 0x18404a, 1);
    pxRect(ctx, ox + tipX + 3, oy + headTop - 22, 2, 8, 0x18404a, 1);
    pxRect(ctx, ox + tipX - 3, oy + headTop - 24, 6, 2, 0x18404a, 1);
    pxRect(ctx, ox + tipX - 2, oy + headTop - 21, 2, 3, skinL, 0.8);
  }
}

function drawAlienEyes(ctx, ox, oy, c, state, frameIdx) {
  const { headTop, headX, headHalfW } = c;
  const eyeY = headTop + 36;
  const eyeW = 28;
  const eyeH = 22;
  const inset = 12;
  const lx = headX - headHalfW + inset;
  const rx = headX + headHalfW - inset - eyeW;
  const blink = (state === 'idle' || state === 'normal') && frameIdx === 5;
  if (state === 'furious') {
    pxRect(ctx, ox + lx, oy + eyeY + 9, eyeW, 6, 0x000000, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 9, eyeW, 6, 0x000000, 1);
    pxRect(ctx, ox + lx, oy + eyeY + 8, eyeW, 1, 0x18404a, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 8, eyeW, 1, 0x18404a, 1);
    return;
  }
  if (blink) {
    pxRect(ctx, ox + lx, oy + eyeY + 9, eyeW, 3, 0x18404a, 1);
    pxRect(ctx, ox + rx, oy + eyeY + 9, eyeW, 3, 0x18404a, 1);
    return;
  }
  // Almond solid-black eyes with bright catchlights
  for (let r = 0; r < eyeH; r++) {
    const t = Math.abs(r - (eyeH - 1) / 2) / ((eyeH - 1) / 2);
    const insetR = Math.round(t * t * 4);
    const w = eyeW - insetR * 2;
    if (w <= 0) continue;
    pxRect(ctx, ox + lx + insetR, oy + eyeY + r, w, 1, 0x000000, 1);
    pxRect(ctx, ox + rx + insetR, oy + eyeY + r, w, 1, 0x000000, 1);
    pxRect(ctx, ox + lx + insetR - 1, oy + eyeY + r, 1, 1, 0x18404a, 1);
    pxRect(ctx, ox + lx + insetR + w, oy + eyeY + r, 1, 1, 0x18404a, 1);
    pxRect(ctx, ox + rx + insetR - 1, oy + eyeY + r, 1, 1, 0x18404a, 1);
    pxRect(ctx, ox + rx + insetR + w, oy + eyeY + r, 1, 1, 0x18404a, 1);
  }
  pxRect(ctx, ox + lx + 6, oy + eyeY + 4, 6, 6, 0xffffff, 1);
  pxRect(ctx, ox + rx + 6, oy + eyeY + 4, 6, 6, 0xffffff, 1);
}

function drawAlienMouth(ctx, ox, oy, c, state, frameIdx, mouthOpen) {
  const { headTop, headX } = c;
  const my = headTop + 70;
  const w = 28;
  if (state === 'furious') {
    pxRect(ctx, ox + headX - w / 2, oy + my, w, 8, 0x1a0a08, 1);
    pxRect(ctx, ox + headX - w / 2, oy + my, w, 1, 0x18404a, 1);
    pxRect(ctx, ox + headX - w / 2, oy + my + 8, w, 1, 0x18404a, 1);
    return;
  }
  if (mouthOpen) {
    pxRect(ctx, ox + headX - w / 2 + 2, oy + my, w - 4, 6, 0x1a0a08, 1);
    return;
  }
  pxRect(ctx, ox + headX - w / 2, oy + my + 2, w, 3, 0x1a1a1a, 1);
}

// ============================================================================
// ATHLETE — red jersey w/ white "5", headband, dark short hair
// ============================================================================
function drawAthlete(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xd9a878,
    eyeColor: 0x4a2a18,
    browColor: 0x2a1a10,
    drawTorso: drawAthleteJersey,
    drawHair: drawAthleteHair,
    drawAccessory: drawAthleteBand,
  }, state, frameIdx);
}

function drawAthleteJersey(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const jersey = 0xc44a3a;
  const jerseyL = 0xff6052;
  const jerseyS = 0x802820;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, jersey, jerseyL, jerseyS, 0x4a1410, 64, 18);
  // V-neckline
  const white = 0xfff4d6;
  pxRect(ctx, ox + cx - 18, oy + shoulderY, 36, 6, white, 1);
  pxRect(ctx, ox + cx - 15, oy + shoulderY + 6, 30, 6, white, 1);
  pxRect(ctx, ox + cx - 12, oy + shoulderY + 12, 24, 6, white, 1);
  pxRect(ctx, ox + cx - 9, oy + shoulderY + 18, 18, 6, white, 1);
  pxRect(ctx, ox + cx - 6, oy + shoulderY + 24, 12, 3, white, 1);
  pxRect(ctx, ox + cx - 3, oy + shoulderY + 27, 6, 3, jerseyS, 1);
  pxRect(ctx, ox + cx - 19, oy + shoulderY, 1, 27, 0x4a1410, 1);
  pxRect(ctx, ox + cx + 18, oy + shoulderY, 1, 27, 0x4a1410, 1);
  // Big white "5" centered on the chest
  drawNum5(ctx, ox, oy, cx - 12, shoulderY + 45, white);
  // Sleeve trim
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 12, 12, 4, white, 1);
  pxRect(ctx, ox + cx + 52, oy + shoulderY + 12, 12, 4, white, 1);
}

function drawNum5(ctx, ox, oy, x, y, color) {
  pxRect(ctx, ox + x, oy + y, 24, 5, color, 1);
  pxRect(ctx, ox + x, oy + y + 5, 5, 12, color, 1);
  pxRect(ctx, ox + x, oy + y + 17, 24, 5, color, 1);
  pxRect(ctx, ox + x + 19, oy + y + 22, 5, 12, color, 1);
  pxRect(ctx, ox + x, oy + y + 34, 24, 5, color, 1);
}

function drawAthleteHair(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const hair = 0x1a1410;
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 2, headHalfW * 2 - 6, 12, hair, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 4, headHalfW * 2 - 6, 2, 0x0a0604, 1);
  pxRect(ctx, ox + headX - headHalfW + 1, oy + headTop - 2, 2, 12, 0x0a0604, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop - 2, 2, 12, 0x0a0604, 1);
}

function drawAthleteBand(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const band = 0xfff4d6;
  const accent = 0xc44a3a;
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 8, headHalfW * 2 + 6, 12, band, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 8, headHalfW * 2 + 6, 3, lighten(band, 1.1), 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 13, headHalfW * 2 + 6, 3, accent, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 6, headHalfW * 2 + 6, 2, 0xc4b890, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 20, headHalfW * 2 + 6, 2, 0xc4b890, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop + 8, 2, 12, 0xc4b890, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop + 8, 2, 12, 0xc4b890, 1);
}

// ============================================================================
// FIREFIGHTER — yellow turnout coat w/ silver stripes, red helmet
// ============================================================================
function drawFirefighter(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xe8c39a,
    eyeColor: 0x2a5a9a,
    browColor: 0x3a2418,
    drawTorso: drawFirefighterCoat,
    drawHair: drawShortBrownHair,
    drawAccessory: drawFirefighterHelmet,
  }, state, frameIdx);
}

function drawFirefighterCoat(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const coat = 0xc4a020;
  const coatL = 0xffd040;
  const coatS = 0x8a6010;
  const stripe = 0xc4c4cc;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, coat, coatL, coatS, 0x4a3010, 64, 18);
  // High collar
  pxRect(ctx, ox + cx - 15, oy + shoulderY, 30, 12, coat, 1);
  pxRect(ctx, ox + cx - 15, oy + shoulderY, 30, 3, coatL, 0.8);
  pxRect(ctx, ox + cx - 15, oy + shoulderY + 9, 30, 3, coatS, 1);
  pxRect(ctx, ox + cx - 16, oy + shoulderY, 1, 12, 0x4a3010, 1);
  pxRect(ctx, ox + cx + 15, oy + shoulderY, 1, 12, 0x4a3010, 1);
  // Reflective stripes
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 30, 128, 8, stripe, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 30, 128, 2, 0xffffff, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 60, 128, 8, stripe, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 60, 128, 2, 0xffffff, 1);
  // Center clasps
  pxRect(ctx, ox + cx - 5, oy + shoulderY + 15, 10, 264 - (shoulderY + 15), coatS, 1);
  for (let i = 0; i < 3; i++) {
    const yy = shoulderY + 20 + i * 24;
    pxRect(ctx, ox + cx - 6, oy + yy, 12, 6, coatS, 1);
    pxRect(ctx, ox + cx - 5, oy + yy + 1, 10, 4, coat, 1);
  }
}

function drawShortBrownHair(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const hair = 0x3a2418;
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 12, 3, 18, hair, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 12, 3, 18, hair, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop + 12, 2, 18, 0x140a06, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop + 12, 2, 18, 0x140a06, 1);
}

function drawFirefighterHelmet(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const red = 0xc4202a;
  const redL = 0xff5040;
  const redS = 0x8a1010;
  // Wide brim
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop - 3, headHalfW * 2 + 36, 9, red, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop - 3, headHalfW * 2 + 36, 3, redL, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 3, headHalfW * 2 + 36, 3, redS, 1);
  pxRect(ctx, ox + headX - headHalfW - 20, oy + headTop - 3, 2, 9, 0x4a0808, 1);
  pxRect(ctx, ox + headX + headHalfW + 18, oy + headTop - 3, 2, 9, 0x4a0808, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 6, headHalfW * 2 + 36, 2, 0x4a0808, 1);
  // Dome
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 21, headHalfW * 2 - 6, 18, red, 1);
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 21, headHalfW * 2 - 12, 6, redL, 1);
  pxRect(ctx, ox + headX + headHalfW - 12, oy + headTop - 18, 9, 12, redS, 0.6);
  pxRect(ctx, ox + headX - headHalfW + 1, oy + headTop - 21, 2, 18, 0x4a0808, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop - 21, 2, 18, 0x4a0808, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 22, headHalfW * 2 - 6, 2, 0x4a0808, 1);
  // Gold front shield
  pxRect(ctx, ox + headX - 9, oy + headTop - 27, 18, 12, 0xc4a020, 1);
  pxRect(ctx, ox + headX - 9, oy + headTop - 27, 18, 3, 0xffd040, 1);
  pxRect(ctx, ox + headX - 9, oy + headTop - 17, 18, 2, 0x8a6010, 1);
  pxRect(ctx, ox + headX - 10, oy + headTop - 27, 1, 12, 0x4a3010, 1);
  pxRect(ctx, ox + headX + 9, oy + headTop - 27, 1, 12, 0x4a3010, 1);
  pxRect(ctx, ox + headX - 9, oy + headTop - 28, 18, 1, 0x4a3010, 1);
  pxRect(ctx, ox + headX - 1, oy + headTop - 25, 2, 8, 0x4a3010, 1);
}

// ============================================================================
// SANTA — red suit w/ fur trim, white beard, red hat with pom
// ============================================================================
function drawSanta(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xf2c89a,
    eyeColor: 0x2a5a9a,
    browColor: 0xfff4d6,
    drawTorso: drawSantaSuit,
    drawHair: drawSantaHairSides,
    drawAccessory: drawSantaHat,
    drawFront: drawSantaBeard,
  }, state, frameIdx);
}

function drawSantaSuit(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const red = 0xc4202a;
  const redL = 0xff4040;
  const redS = 0x8a1010;
  const fur = 0xfff4d6;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, red, redL, redS, 0x4a0808, 66, 18);
  // White fur trim collar
  pxRect(ctx, ox + cx - 66, oy + shoulderY, 132, 14, fur, 1);
  pxRect(ctx, ox + cx - 66, oy + shoulderY, 132, 3, lighten(fur, 1.05), 1);
  pxRect(ctx, ox + cx - 66, oy + shoulderY + 11, 132, 3, 0xc4b890, 1);
  for (let i = 0; i < 132; i += 6) {
    pxRect(ctx, ox + cx - 66 + i, oy + shoulderY + 2, 3, 2, 0xffffff, 0.8);
  }
  // Center fur stripe
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 14, 20, 250, fur, 1);
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 14, 20, 3, lighten(fur, 1.1), 0.85);
  pxRect(ctx, ox + cx - 11, oy + shoulderY + 14, 1, 250, 0x6a5a40, 1);
  pxRect(ctx, ox + cx + 10, oy + shoulderY + 14, 1, 250, 0x6a5a40, 1);
  // Black belt with buckle
  pxRect(ctx, ox + cx - 66, oy + 234, 132, 18, 0x1a1410, 1);
  pxRect(ctx, ox + cx - 66, oy + 234, 132, 2, 0x4a4040, 1);
  pxRect(ctx, ox + cx - 18, oy + 237, 36, 12, 0xc4a020, 1);
  pxRect(ctx, ox + cx - 18, oy + 237, 36, 3, 0xffd040, 1);
  pxRect(ctx, ox + cx - 5, oy + 240, 10, 6, 0x8a6010, 1);
  pxRect(ctx, ox + cx - 19, oy + 237, 1, 12, 0x4a3010, 1);
  pxRect(ctx, ox + cx + 18, oy + 237, 1, 12, 0x4a3010, 1);
}

function drawSantaHairSides(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const fur = 0xfff4d6;
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 24, 3, 30, fur, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 24, 3, 30, fur, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop + 24, 2, 30, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop + 24, 2, 30, 0x6a5a40, 1);
}

function drawSantaHat(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const red = 0xc4202a;
  const redL = 0xff4040;
  const fur = 0xfff4d6;
  // Fur brim band
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop - 3, headHalfW * 2 + 6, 12, fur, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop - 3, headHalfW * 2 + 6, 3, lighten(fur, 1.05), 0.85);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop - 3, 2, 12, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop - 3, 2, 12, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop - 5, headHalfW * 2 + 6, 2, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 9, headHalfW * 2 + 6, 1, 0x6a5a40, 1);
  // Cone body slanting right
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 24, headHalfW * 2 - 12, 18, red, 1);
  pxRect(ctx, ox + headX - headHalfW + 12, oy + headTop - 36, headHalfW * 2 - 24, 12, red, 1);
  pxRect(ctx, ox + headX + 6, oy + headTop - 48, 14, 12, red, 1);
  // Pom
  pxRect(ctx, ox + headX + 14, oy + headTop - 60, 18, 14, fur, 1);
  pxRect(ctx, ox + headX + 14, oy + headTop - 60, 9, 7, lighten(fur, 1.1), 1);
  pxRect(ctx, ox + headX + 12, oy + headTop - 60, 2, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 32, oy + headTop - 60, 2, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 14, oy + headTop - 62, 18, 2, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 14, oy + headTop - 46, 18, 1, 0x6a5a40, 1);
  // Cone shading + outline
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 24, 4, 18, redL, 0.6);
  pxRect(ctx, ox + headX - headHalfW + 4, oy + headTop - 24, 2, 18, 0x4a0808, 1);
  pxRect(ctx, ox + headX + headHalfW - 6, oy + headTop - 24, 2, 18, 0x4a0808, 1);
  pxRect(ctx, ox + headX - headHalfW + 10, oy + headTop - 36, 2, 12, 0x4a0808, 1);
  pxRect(ctx, ox + headX + headHalfW - 12, oy + headTop - 36, 2, 12, 0x4a0808, 1);
  pxRect(ctx, ox + headX + 4, oy + headTop - 48, 2, 12, 0x4a0808, 1);
  pxRect(ctx, ox + headX + 20, oy + headTop - 48, 2, 12, 0x4a0808, 1);
}

function drawSantaBeard(ctx, ox, oy, c) {
  const { headTop, headBottom, headX } = c;
  const beard = 0xfff4d6;
  const beardS = 0xd4c490;
  // Moustache
  pxRect(ctx, ox + headX - 24, oy + headTop + 50, 48, 10, beard, 1);
  pxRect(ctx, ox + headX - 24, oy + headTop + 50, 48, 3, lighten(beard, 1.05), 0.8);
  // Big bushy beard
  for (let y = headTop + 56; y <= headBottom + 6; y++) {
    const ty = (y - (headTop + 56)) / Math.max(1, headBottom + 6 - (headTop + 56));
    const half = 26 - Math.round(ty * 4);
    pxRect(ctx, ox + headX - half, oy + y, half * 2, 1, beard, 1);
  }
  // Cascading tip going below the chin
  pxRect(ctx, ox + headX - 12, oy + headBottom + 6, 24, 14, beard, 1);
  pxRect(ctx, ox + headX - 8, oy + headBottom + 20, 16, 14, beard, 1);
  pxRect(ctx, ox + headX - 4, oy + headBottom + 34, 8, 8, beard, 1);
  // Outlines
  pxRect(ctx, ox + headX - 28, oy + headTop + 56, 1, headBottom + 6 - headTop - 56, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 26, oy + headTop + 56, 1, headBottom + 6 - headTop - 56, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 13, oy + headBottom + 6, 1, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 12, oy + headBottom + 6, 1, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 9, oy + headBottom + 20, 1, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 8, oy + headBottom + 20, 1, 14, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 5, oy + headBottom + 34, 1, 8, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 4, oy + headBottom + 34, 1, 8, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 4, oy + headBottom + 42, 8, 1, 0x6a5a40, 1);
  // Pink nose
  pxRect(ctx, ox + headX - 5, oy + headTop + 48, 10, 4, 0xff7a8a, 1);
  pxRect(ctx, ox + headX - 5, oy + headTop + 48, 10, 1, 0xffaaba, 1);
}

// ============================================================================
// COP — blue uniform with badge + tie, peaked cap
// ============================================================================
function drawCop(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xc99172,
    eyeColor: 0x2a4a3a,
    browColor: 0x1a1410,
    drawTorso: drawCopUniform,
    drawHair: drawShortBlackHair,
    drawAccessory: drawCopCap,
  }, state, frameIdx);
}

function drawShortBlackHair(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const hair = 0x1a1410;
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 6, 3, 22, hair, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 6, 3, 22, hair, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop + 6, 2, 22, 0x000000, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop + 6, 2, 22, 0x000000, 1);
}

function drawCopUniform(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const blue = 0x2a3a6a;
  const blueL = 0x4a5a9a;
  const blueS = 0x1a2440;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, blue, blueL, blueS, 0x0a1428, 64, 18);
  // Open collar with white shirt
  pxRect(ctx, ox + cx - 15, oy + shoulderY, 30, 15, blueS, 1);
  pxRect(ctx, ox + cx - 6, oy + shoulderY + 6, 12, 9, 0xfff4d6, 1);
  pxRect(ctx, ox + cx - 16, oy + shoulderY, 1, 15, 0x0a1428, 1);
  pxRect(ctx, ox + cx + 15, oy + shoulderY, 1, 15, 0x0a1428, 1);
  // Tie
  pxRect(ctx, ox + cx - 4, oy + shoulderY + 15, 8, 30, blueS, 1);
  pxRect(ctx, ox + cx - 4, oy + shoulderY + 15, 2, 30, blueL, 0.5);
  pxRect(ctx, ox + cx - 5, oy + shoulderY + 15, 1, 30, 0x0a1428, 1);
  pxRect(ctx, ox + cx + 4, oy + shoulderY + 15, 1, 30, 0x0a1428, 1);
  // Gold badge
  pxRect(ctx, ox + cx - 52, oy + shoulderY + 28, 18, 22, 0xc4a020, 1);
  pxRect(ctx, ox + cx - 52, oy + shoulderY + 28, 18, 5, 0xffd040, 1);
  pxRect(ctx, ox + cx - 52, oy + shoulderY + 47, 18, 3, 0x8a6010, 1);
  pxRect(ctx, ox + cx - 53, oy + shoulderY + 28, 1, 22, 0x4a3010, 1);
  pxRect(ctx, ox + cx - 34, oy + shoulderY + 28, 1, 22, 0x4a3010, 1);
  pxRect(ctx, ox + cx - 48, oy + shoulderY + 33, 10, 13, 0x8a6010, 0.65);
  // Right pocket flap
  pxRect(ctx, ox + cx + 34, oy + shoulderY + 36, 22, 14, blueS, 1);
  pxRect(ctx, ox + cx + 34, oy + shoulderY + 36, 22, 3, blueL, 0.6);
  pxRect(ctx, ox + cx + 34, oy + shoulderY + 48, 22, 2, 0x0a1428, 0.8);
}

function drawCopCap(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const blue = 0x2a3a6a;
  const blueL = 0x4a5a9a;
  pxRect(ctx, ox + headX - headHalfW, oy + headTop - 18, headHalfW * 2, 21, blue, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + headTop - 18, headHalfW * 2, 6, blueL, 0.7);
  pxRect(ctx, ox + headX - headHalfW, oy + headTop - 21, headHalfW * 2, 3, 0x0a1428, 1);
  pxRect(ctx, ox + headX - headHalfW - 2, oy + headTop - 18, 2, 21, 0x0a1428, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop - 18, 2, 21, 0x0a1428, 1);
  // Black brim
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 3, headHalfW * 2 + 6, 7, 0x1a1410, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 3, headHalfW * 2 + 6, 2, 0x4a4040, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 9, headHalfW * 2 + 6, 1, 0x000000, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop + 3, 2, 7, 0x000000, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop + 3, 2, 7, 0x000000, 1);
  // Gold badge above brim
  pxRect(ctx, ox + headX - 10, oy + headTop - 8, 20, 9, 0xc4a020, 1);
  pxRect(ctx, ox + headX - 10, oy + headTop - 8, 20, 2, 0xffd040, 1);
  pxRect(ctx, ox + headX - 4, oy + headTop - 5, 8, 4, 0x8a6010, 1);
  pxRect(ctx, ox + headX - 11, oy + headTop - 8, 1, 9, 0x4a3010, 1);
  pxRect(ctx, ox + headX + 10, oy + headTop - 8, 1, 9, 0x4a3010, 1);
}

// ============================================================================
// SURGEON — green scrubs, blue surgical mask + cap
// ============================================================================
function drawSurgeon(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xe8c39a,
    eyeColor: 0x2a5a9a,
    browColor: 0x3a2418,
    drawTorso: drawSurgeonScrubs,
    drawHair: () => {},
    drawAccessory: drawSurgeonMaskCap,
    mouthOverride: () => {}, // mask covers
    noseOverride: () => {},  // mask covers
  }, state, frameIdx);
}

function drawSurgeonScrubs(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const scrubs = 0x4a8a6a;
  const scrubsL = 0x7aaa8a;
  const scrubsS = 0x2a5a4a;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, scrubs, scrubsL, scrubsS, 0x1a3a30, 64, 18);
  // V-neck
  pxRect(ctx, ox + cx - 15, oy + shoulderY, 30, 6, scrubsS, 1);
  pxRect(ctx, ox + cx - 12, oy + shoulderY + 6, 24, 6, scrubsS, 1);
  pxRect(ctx, ox + cx - 9, oy + shoulderY + 12, 18, 6, scrubsS, 1);
  pxRect(ctx, ox + cx - 6, oy + shoulderY + 18, 12, 6, scrubsS, 1);
  pxRect(ctx, ox + cx - 3, oy + shoulderY + 24, 6, 3, scrubsS, 1);
  // Pocket
  pxRect(ctx, ox + cx - 50, oy + shoulderY + 32, 22, 18, scrubsS, 1);
  pxRect(ctx, ox + cx - 50, oy + shoulderY + 32, 22, 2, scrubsL, 0.6);
  pxRect(ctx, ox + cx - 50, oy + shoulderY + 48, 22, 2, 0x1a3a30, 0.8);
  // Pen
  pxRect(ctx, ox + cx - 36, oy + shoulderY + 28, 3, 8, 0x1a1410, 1);
  pxRect(ctx, ox + cx - 36, oy + shoulderY + 28, 3, 1, 0xc44a3a, 1);
}

function drawSurgeonMaskCap(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW, headBottom } = c;
  // Cap
  const cap = 0x4a8a6a;
  const capL = 0x7aaa8a;
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop - 6, headHalfW * 2 + 6, 21, cap, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + headTop - 6, headHalfW * 2, 3, capL, 0.7);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop - 9, headHalfW * 2 + 6, 3, 0x1a3a30, 1);
  pxRect(ctx, ox + headX - headHalfW - 5, oy + headTop - 6, 2, 21, 0x1a3a30, 1);
  pxRect(ctx, ox + headX + headHalfW + 3, oy + headTop - 6, 2, 21, 0x1a3a30, 1);
  pxRect(ctx, ox + headX - headHalfW - 3, oy + headTop + 15, headHalfW * 2 + 6, 2, 0x1a3a30, 1);
  // Stitching
  for (let i = 6; i < headHalfW * 2; i += 12) {
    pxRect(ctx, ox + headX - headHalfW + i, oy + headTop - 3, 2, 1, 0x2a5a4a, 0.6);
  }
  // Surgical mask covering lower face
  const mask = 0x5a8aca;
  const maskL = 0x8aaadd;
  const maskS = 0x3a5a8a;
  const maskTop = headTop + 50;
  const maskH = headBottom - maskTop + 4;
  pxRect(ctx, ox + headX - headHalfW, oy + maskTop, headHalfW * 2, maskH, mask, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + maskTop, headHalfW * 2, 3, maskL, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + maskTop + maskH - 3, headHalfW * 2, 3, maskS, 1);
  pxRect(ctx, ox + headX - headHalfW - 2, oy + maskTop, 2, maskH, 0x1a3a6a, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + maskTop, 2, maskH, 0x1a3a6a, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + maskTop - 1, headHalfW * 2, 1, 0x1a3a6a, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + maskTop + maskH, headHalfW * 2, 1, 0x1a3a6a, 1);
  for (let i = 0; i < 3; i++) {
    pxRect(ctx, ox + headX - headHalfW + 3, oy + maskTop + 5 + i * 5, headHalfW * 2 - 6, 1, maskS, 0.7);
  }
}

// ============================================================================
// KNIGHT — full helm + chainmail + breastplate (bespoke head)
// ============================================================================
function drawKnight(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0x8a8a92,
    eyeColor: 0xff4a2a,
    headWidth: 72,
    headHeight: 76,
    showEars: false,
    drawTorso: drawKnightArmor,
    drawHair: () => {},
    drawAccessory: drawKnightHelm,
    eyeOverride: () => {},      // visor slit handles eyes
    mouthOverride: () => {},
    noseOverride: () => {},
    eyebrowOverride: () => {},
  }, state, frameIdx);
}

function drawKnightArmor(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const metal = 0x8a8a92;
  const metalL = 0xc4c4cc;
  const metalS = 0x4a4a52;
  const accent = 0xc4a020;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, metal, metalL, metalS, 0x2a2a32, 64, 18);
  // Center groove
  pxRect(ctx, ox + cx - 3, oy + shoulderY + 6, 6, 264 - shoulderY - 6, metalS, 0.7);
  pxRect(ctx, ox + cx, oy + shoulderY + 6, 1, 264 - shoulderY - 6, 0x000000, 0.7);
  // Gold trim down each side
  pxRect(ctx, ox + cx - 50, oy + shoulderY + 10, 4, 264 - shoulderY - 12, accent, 1);
  pxRect(ctx, ox + cx + 46, oy + shoulderY + 10, 4, 264 - shoulderY - 12, accent, 1);
  // Chainmail collar
  const mail = 0x6a6a72;
  pxRect(ctx, ox + cx - 24, oy + shoulderY - 6, 48, 14, mail, 1);
  for (let y = 0; y < 14; y += 3) {
    for (let x = 0; x < 48; x += 3) {
      pxRect(ctx, ox + cx - 24 + x, oy + shoulderY - 6 + y, 2, 2, metalL, 0.5);
    }
  }
  pxRect(ctx, ox + cx - 25, oy + shoulderY - 6, 1, 14, 0x000000, 1);
  pxRect(ctx, ox + cx + 24, oy + shoulderY - 6, 1, 14, 0x000000, 1);
  pxRect(ctx, ox + cx - 24, oy + shoulderY - 7, 48, 1, 0x000000, 1);
  // Pauldrons
  pxRect(ctx, ox + cx - 64, oy + shoulderY, 22, 20, metal, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY, 22, 5, metalL, 0.8);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 17, 22, 3, metalS, 0.7);
  pxRect(ctx, ox + cx - 66, oy + shoulderY, 2, 20, 0x000000, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 20, 22, 1, 0x000000, 1);
  pxRect(ctx, ox + cx + 42, oy + shoulderY, 22, 20, metal, 1);
  pxRect(ctx, ox + cx + 42, oy + shoulderY, 22, 5, metalL, 0.8);
  pxRect(ctx, ox + cx + 42, oy + shoulderY + 17, 22, 3, metalS, 0.7);
  pxRect(ctx, ox + cx + 64, oy + shoulderY, 2, 20, 0x000000, 1);
  pxRect(ctx, ox + cx + 42, oy + shoulderY + 20, 22, 1, 0x000000, 1);
}

function drawKnightHelm(ctx, ox, oy, c) {
  const { headTop, headBottom, headX, headHalfW } = c;
  const metal = 0x8a8a92;
  const metalL = 0xc4c4cc;
  const metalS = 0x4a4a52;
  const metalB = 0xeaeaef;
  // Rounded helmet silhouette overlaying the head
  for (let r = 0; r <= headBottom - headTop; r++) {
    let inset = 0;
    if (r < 6) inset = 6 - r;
    if (r >= headBottom - headTop - 4) inset = r - (headBottom - headTop - 4);
    const halfRow = headHalfW - inset;
    pxRect(ctx, ox + headX - halfRow, oy + headTop + r, halfRow * 2, 1, metal, 1);
    pxRect(ctx, ox + headX - halfRow - 1, oy + headTop + r, 1, 1, 0x000000, 1);
    pxRect(ctx, ox + headX + halfRow, oy + headTop + r, 1, 1, 0x000000, 1);
  }
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 1, (headHalfW - 6) * 2, 1, 0x000000, 1);
  pxRect(ctx, ox + headX - headHalfW + 4, oy + headBottom + 1, (headHalfW - 4) * 2, 1, 0x000000, 1);
  // Polish + highlight
  pxRect(ctx, ox + headX - headHalfW + 8, oy + headTop + 8, 12, 16, metalL, 0.7);
  pxRect(ctx, ox + headX - headHalfW + 11, oy + headTop + 6, 6, 10, metalB, 0.7);
  // Visor slit
  pxRect(ctx, ox + headX - headHalfW + 9, oy + headTop + 30, headHalfW * 2 - 18, 9, 0x0a0a0a, 1);
  pxRect(ctx, ox + headX - headHalfW + 9, oy + headTop + 30, headHalfW * 2 - 18, 1, 0x000000, 1);
  pxRect(ctx, ox + headX - headHalfW + 9, oy + headTop + 38, headHalfW * 2 - 18, 1, 0x000000, 1);
  // Visor bars
  pxRect(ctx, ox + headX - 9, oy + headTop + 30, 2, 9, metalS, 1);
  pxRect(ctx, ox + headX + 7, oy + headTop + 30, 2, 9, metalS, 1);
  // Glowing red eyes
  pxRect(ctx, ox + headX - headHalfW + 12, oy + headTop + 33, 6, 4, 0xff4a2a, 1);
  pxRect(ctx, ox + headX + headHalfW - 18, oy + headTop + 33, 6, 4, 0xff4a2a, 1);
  pxRect(ctx, ox + headX - headHalfW + 14, oy + headTop + 34, 2, 2, 0xffaa8a, 1);
  pxRect(ctx, ox + headX + headHalfW - 16, oy + headTop + 34, 2, 2, 0xffaa8a, 1);
  // Mouth grille — 5 vertical bars
  for (let i = 0; i < 5; i++) {
    const bx = headX - headHalfW + 12 + i * 12;
    pxRect(ctx, ox + bx, oy + headTop + 48, 2, 18, metalS, 1);
  }
  // Red plume
  pxRect(ctx, ox + headX - 3, oy + headTop - 18, 6, 18, 0xc4202a, 1);
  pxRect(ctx, ox + headX - 3, oy + headTop - 18, 3, 18, 0xff4040, 1);
  pxRect(ctx, ox + headX - 6, oy + headTop - 9, 3, 9, 0xc4202a, 1);
  pxRect(ctx, ox + headX + 3, oy + headTop - 9, 3, 9, 0xc4202a, 1);
  pxRect(ctx, ox + headX - 4, oy + headTop - 19, 8, 1, 0x000000, 1);
  pxRect(ctx, ox + headX - 5, oy + headTop - 18, 1, 18, 0x000000, 1);
  pxRect(ctx, ox + headX + 4, oy + headTop - 18, 1, 18, 0x000000, 1);
}

// ============================================================================
// ROBOT — bespoke; metal head + antenna + screen eyes + speaker grille
// ============================================================================
function drawRobot(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0x8aaabe,
    eyeColor: 0x40ff60,
    headWidth: 72,
    headHeight: 70,
    showEars: false,
    drawTorso: drawRobotBody,
    drawHair: () => {},
    drawAccessory: drawRobotHeadOverlay,
    eyeOverride: () => {},
    mouthOverride: () => {},
    noseOverride: () => {},
    eyebrowOverride: () => {},
  }, state, frameIdx);
}

function drawRobotBody(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const metal = 0x8aaabe;
  const metalL = 0xc4d4e0;
  const metalS = 0x4a6a82;
  const accent = 0xff4a8a;
  // Boxy torso (no taper)
  for (let y = shoulderY; y < 264; y++) {
    pxRect(ctx, ox + cx - 60, oy + y, 120, 1, metal, 1);
    pxRect(ctx, ox + cx - 62, oy + y, 2, 1, 0x000000, 1);
    pxRect(ctx, ox + cx + 60, oy + y, 2, 1, 0x000000, 1);
  }
  pxRect(ctx, ox + cx - 60, oy + shoulderY - 1, 120, 1, 0x000000, 1);
  pxRect(ctx, ox + cx - 60, oy + shoulderY + 3, 8, 264 - shoulderY - 3, metalL, 0.6);
  pxRect(ctx, ox + cx + 52, oy + shoulderY + 3, 8, 264 - shoulderY - 3, metalS, 0.7);
  // Vertical panel seams
  pxRect(ctx, ox + cx - 20, oy + shoulderY, 1, 264 - shoulderY, metalS, 0.7);
  pxRect(ctx, ox + cx + 20, oy + shoulderY, 1, 264 - shoulderY, metalS, 0.7);
  // Chest control board
  pxRect(ctx, ox + cx - 22, oy + shoulderY + 16, 44, 28, metalS, 1);
  pxRect(ctx, ox + cx - 22, oy + shoulderY + 16, 44, 2, 0x000000, 0.8);
  pxRect(ctx, ox + cx - 22, oy + shoulderY + 42, 44, 2, 0x000000, 0.8);
  pxRect(ctx, ox + cx - 18, oy + shoulderY + 22, 6, 6, 0x40ff60, 1);
  pxRect(ctx, ox + cx - 18, oy + shoulderY + 22, 6, 2, 0x80ffa0, 1);
  pxRect(ctx, ox + cx - 6, oy + shoulderY + 22, 6, 6, 0xffd040, 1);
  pxRect(ctx, ox + cx + 6, oy + shoulderY + 22, 6, 6, accent, 1);
  pxRect(ctx, ox + cx - 18, oy + shoulderY + 32, 30, 6, accent, 0.85);
  // Rivets
  for (const [rx, ry] of [[cx - 56, shoulderY + 4], [cx + 52, shoulderY + 4]]) {
    pxRect(ctx, ox + rx, oy + ry, 4, 4, metalL, 1);
    pxRect(ctx, ox + rx + 1, oy + ry + 1, 2, 2, 0xffffff, 0.85);
  }
}

function drawRobotHeadOverlay(ctx, ox, oy, c) {
  const { headTop, headBottom, headX, headHalfW } = c;
  const metal = 0x8aaabe;
  const metalL = 0xc4d4e0;
  const metalS = 0x4a6a82;
  const accent = 0xff4a8a;
  // Bolt-corner rivets
  for (const [rx, ry] of [
    [headX - headHalfW + 3, headTop + 3],
    [headX + headHalfW - 6, headTop + 3],
    [headX - headHalfW + 3, headBottom - 6],
    [headX + headHalfW - 6, headBottom - 6],
  ]) {
    pxRect(ctx, ox + rx, oy + ry, 4, 4, metalL, 1);
    pxRect(ctx, ox + rx, oy + ry, 3, 3, 0xffffff, 0.8);
    pxRect(ctx, ox + rx, oy + ry + 4, 4, 1, metalS, 1);
  }
  // Antenna
  const ax = headX - 1;
  pxRect(ctx, ox + ax, oy + headTop - 21, 2, 21, metalS, 1);
  pxRect(ctx, ox + ax - 1, oy + headTop - 21, 1, 21, 0x000000, 1);
  pxRect(ctx, ox + ax + 2, oy + headTop - 21, 1, 21, 0x000000, 1);
  pxRect(ctx, ox + ax - 4, oy + headTop - 28, 10, 7, accent, 1);
  pxRect(ctx, ox + ax - 4, oy + headTop - 28, 10, 2, 0xff80ba, 1);
  pxRect(ctx, ox + ax - 6, oy + headTop - 28, 2, 7, 0x4a1428, 1);
  pxRect(ctx, ox + ax + 6, oy + headTop - 28, 2, 7, 0x4a1428, 1);
  pxRect(ctx, ox + ax - 4, oy + headTop - 30, 10, 2, 0x4a1428, 1);
  // Screen eyes
  const eyeY = headTop + 16;
  const eyeW = 22;
  const eyeH = 16;
  const lx = headX - headHalfW + 6;
  const rx = headX + headHalfW - eyeW - 6;
  pxRect(ctx, ox + lx, oy + eyeY, eyeW, eyeH, 0x0a0a0a, 1);
  pxRect(ctx, ox + rx, oy + eyeY, eyeW, eyeH, 0x0a0a0a, 1);
  pxRect(ctx, ox + lx - 1, oy + eyeY - 1, eyeW + 2, 1, 0x000000, 1);
  pxRect(ctx, ox + lx - 1, oy + eyeY + eyeH, eyeW + 2, 1, 0x000000, 1);
  pxRect(ctx, ox + rx - 1, oy + eyeY - 1, eyeW + 2, 1, 0x000000, 1);
  pxRect(ctx, ox + rx - 1, oy + eyeY + eyeH, eyeW + 2, 1, 0x000000, 1);
  pxRect(ctx, ox + lx + 7, oy + eyeY + 5, 8, 6, 0x40ff60, 1);
  pxRect(ctx, ox + rx + 7, oy + eyeY + 5, 8, 6, 0x40ff60, 1);
  pxRect(ctx, ox + lx + 7, oy + eyeY + 5, 5, 2, 0xffffff, 0.85);
  pxRect(ctx, ox + rx + 7, oy + eyeY + 5, 5, 2, 0xffffff, 0.85);
  // Mouth grille
  const mY = headBottom - 16;
  pxRect(ctx, ox + headX - 18, oy + mY, 36, 10, 0x1a1a10, 1);
  pxRect(ctx, ox + headX - 18, oy + mY, 36, 1, 0x000000, 1);
  pxRect(ctx, ox + headX - 18, oy + mY + 10, 36, 1, 0x000000, 1);
  for (let i = 2; i <= 8; i += 2) {
    pxRect(ctx, ox + headX - 16, oy + mY + i, 32, 1, accent, 0.55);
  }
}

// ============================================================================
// WIZARD — long beard, pointy hat, blue robe
// ============================================================================
function drawWizard(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xe8c39a,
    eyeColor: 0x4a8aca,
    browColor: 0xfff4d6,
    drawTorso: drawWizardRobe,
    drawHair: drawWizardHairSides,
    drawAccessory: drawWizardHat,
    drawFront: drawWizardBeard,
  }, state, frameIdx);
}

function drawWizardRobe(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const robe = 0x3a3a8a;
  const robeL = 0x6a6abe;
  const robeS = 0x1a1a4a;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, robe, robeL, robeS, 0x0a0a28, 64, 22);
  // Yellow stars
  for (const [sx, sy] of [[-20, 30], [10, 50], [-5, 75], [20, 95]]) {
    pxRect(ctx, ox + cx + sx - 1, oy + shoulderY + sy, 3, 1, 0xffd040, 1);
    pxRect(ctx, ox + cx + sx, oy + shoulderY + sy - 1, 1, 3, 0xffd040, 1);
  }
  // Rope belt at bottom
  pxRect(ctx, ox + cx - 60, oy + 234, 120, 6, 0xc4a020, 1);
  pxRect(ctx, ox + cx - 60, oy + 234, 120, 2, 0xffd040, 1);
  pxRect(ctx, ox + cx - 3, oy + 240, 6, 24, 0xc4a020, 1);
  pxRect(ctx, ox + cx - 3, oy + 258, 6, 6, 0x8a6010, 1);
}

function drawWizardHairSides(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const fur = 0xfff4d6;
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop + 12, 9, 60, fur, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop + 12, 9, 60, fur, 1);
  pxRect(ctx, ox + headX - headHalfW - 8, oy + headTop + 12, 2, 60, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop + 12, 2, 60, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop + 72, 9, 1, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop + 72, 9, 1, 0x6a5a40, 1);
}

function drawWizardHat(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const blue = 0x3a3a8a;
  const blueL = 0x6a6abe;
  const blueS = 0x1a1a4a;
  // Brim
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop - 3, headHalfW * 2 + 24, 6, blue, 1);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop - 3, headHalfW * 2 + 24, 2, blueL, 0.8);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop + 3, headHalfW * 2 + 24, 1, blueS, 1);
  pxRect(ctx, ox + headX - headHalfW - 14, oy + headTop - 3, 2, 6, 0x0a0a28, 1);
  pxRect(ctx, ox + headX + headHalfW + 12, oy + headTop - 3, 2, 6, 0x0a0a28, 1);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop + 4, headHalfW * 2 + 24, 1, 0x0a0a28, 1);
  // Cone leaning right
  const coneH = 60;
  for (let r = 0; r < coneH; r++) {
    const t = r / (coneH - 1);
    const half = Math.round(Math.max(1, (headHalfW) * (1 - t)));
    const dx = Math.round(t * 6);
    const rowX = headX - half + dx;
    pxRect(ctx, ox + rowX, oy + headTop - 3 - r, half * 2, 1, blue, 1);
    pxRect(ctx, ox + rowX - 2, oy + headTop - 3 - r, 2, 1, 0x0a0a28, 1);
    pxRect(ctx, ox + rowX + half * 2, oy + headTop - 3 - r, 2, 1, 0x0a0a28, 1);
    if (r % 8 === 0) pxRect(ctx, ox + rowX, oy + headTop - 3 - r, Math.max(1, half - 3), 1, blueL, 0.5);
  }
  // Stars on the hat
  for (const [px, py] of [[-10, -16], [3, -32], [10, -48]]) {
    pxRect(ctx, ox + headX + px - 1, oy + headTop + py, 3, 1, 0xffd040, 1);
    pxRect(ctx, ox + headX + px, oy + headTop + py - 1, 1, 3, 0xffd040, 1);
  }
}

function drawWizardBeard(ctx, ox, oy, c) {
  const { headTop, headBottom, headX } = c;
  const beard = 0xfff4d6;
  // Moustache
  pxRect(ctx, ox + headX - 22, oy + headTop + 50, 44, 9, beard, 1);
  // Long beard
  for (let y = headTop + 56; y <= headBottom + 6; y++) {
    const ty = (y - (headTop + 56)) / Math.max(1, headBottom + 6 - (headTop + 56));
    const half = 26 - Math.round(ty * 4);
    pxRect(ctx, ox + headX - half, oy + y, half * 2, 1, beard, 1);
  }
  pxRect(ctx, ox + headX - 14, oy + headBottom + 6, 28, 30, beard, 1);
  pxRect(ctx, ox + headX - 10, oy + headBottom + 36, 20, 22, beard, 1);
  pxRect(ctx, ox + headX - 5, oy + headBottom + 58, 10, 16, beard, 1);
  // Outlines
  pxRect(ctx, ox + headX - 28, oy + headTop + 56, 1, headBottom + 6 - headTop - 56, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 26, oy + headTop + 56, 1, headBottom + 6 - headTop - 56, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 15, oy + headBottom + 6, 1, 30, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 14, oy + headBottom + 6, 1, 30, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 11, oy + headBottom + 36, 1, 22, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 10, oy + headBottom + 36, 1, 22, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 6, oy + headBottom + 58, 1, 16, 0x6a5a40, 1);
  pxRect(ctx, ox + headX + 5, oy + headBottom + 58, 1, 16, 0x6a5a40, 1);
  pxRect(ctx, ox + headX - 5, oy + headBottom + 74, 10, 1, 0x6a5a40, 1);
}

// ============================================================================
// PRINCESS — pink dress, blonde hair, gold tiara
// ============================================================================
function drawPrincess(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xf2d6b3,
    eyeColor: 0x4a8aca,
    browColor: 0xc4a020,
    drawTorso: drawPrincessDress,
    drawHair: drawPrincessHair,
    drawAccessory: drawPrincessCrown,
  }, state, frameIdx);
}

function drawPrincessDress(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const pink = 0xff80ba;
  const pinkL = 0xffbadd;
  const pinkD = 0xc4408a;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, pink, pinkL, pinkD, 0x801466, 60, 30);
  // Square neckline (white trim)
  pxRect(ctx, ox + cx - 22, oy + shoulderY, 44, 14, pinkL, 1);
  pxRect(ctx, ox + cx - 22, oy + shoulderY, 44, 3, lighten(pinkL, 1.1), 1);
  pxRect(ctx, ox + cx - 22, oy + shoulderY + 14, 44, 2, 0x801466, 0.8);
  pxRect(ctx, ox + cx - 23, oy + shoulderY, 1, 14, 0x801466, 1);
  pxRect(ctx, ox + cx + 22, oy + shoulderY, 1, 14, 0x801466, 1);
  // Bodice w/ gold laces
  pxRect(ctx, ox + cx - 14, oy + shoulderY + 16, 28, 32, pinkD, 1);
  pxRect(ctx, ox + cx - 14, oy + shoulderY + 16, 28, 2, pink, 0.7);
  for (let i = 0; i < 4; i++) {
    pxRect(ctx, ox + cx - 10, oy + shoulderY + 22 + i * 7, 20, 2, 0xffd040, 1);
  }
  pxRect(ctx, ox + cx - 15, oy + shoulderY + 16, 1, 32, 0x801466, 1);
  pxRect(ctx, ox + cx + 14, oy + shoulderY + 16, 1, 32, 0x801466, 1);
  // Gold belt at the bottom
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 48, 130, 6, 0xffd040, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 48, 130, 2, 0xffeb80, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 53, 130, 1, 0x8a6010, 1);
}

function drawPrincessHair(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const hair = 0xffd040;
  const hairL = 0xffeb80;
  const hairD = 0xc4a020;
  // Top puff
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 8, headHalfW * 2 - 6, 18, hair, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 12, headHalfW * 2 - 6, 4, hair, 1);
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 6, headHalfW * 2 - 12, 4, hairL, 0.75);
  // Side hair
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop + 14, 6, 60, hair, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 14, 6, 60, hair, 1);
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop + 16, 2, 50, hairL, 0.55);
  pxRect(ctx, ox + headX + headHalfW + 4, oy + headTop + 16, 2, 50, hairD, 0.5);
  // Curls
  pxRect(ctx, ox + headX - headHalfW - 9, oy + headTop + 64, 9, 10, hair, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 64, 9, 10, hair, 1);
  // Outlines
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 14, headHalfW * 2 - 6, 2, 0x6a5a10, 1);
  pxRect(ctx, ox + headX - headHalfW + 1, oy + headTop - 12, 2, 22, 0x6a5a10, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop - 12, 2, 22, 0x6a5a10, 1);
  pxRect(ctx, ox + headX - headHalfW - 8, oy + headTop + 14, 2, 60, 0x6a5a10, 1);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop + 14, 2, 60, 0x6a5a10, 1);
  pxRect(ctx, ox + headX - headHalfW - 11, oy + headTop + 64, 2, 10, 0x6a5a10, 1);
  pxRect(ctx, ox + headX + headHalfW + 9, oy + headTop + 64, 2, 10, 0x6a5a10, 1);
  pxRect(ctx, ox + headX - headHalfW - 9, oy + headTop + 74, 9, 1, 0x6a5a10, 1);
  pxRect(ctx, ox + headX + headHalfW, oy + headTop + 74, 9, 1, 0x6a5a10, 1);
}

function drawPrincessCrown(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const gold = 0xffd040;
  const goldL = 0xffeb80;
  const goldS = 0x8a6010;
  const gem = 0xff4a8a;
  // Band
  pxRect(ctx, ox + headX - headHalfW + 5, oy + headTop - 3, headHalfW * 2 - 10, 6, gold, 1);
  pxRect(ctx, ox + headX - headHalfW + 5, oy + headTop - 3, headHalfW * 2 - 10, 2, goldL, 1);
  pxRect(ctx, ox + headX - headHalfW + 5, oy + headTop + 2, headHalfW * 2 - 10, 1, goldS, 1);
  pxRect(ctx, ox + headX - headHalfW + 5, oy + headTop - 4, headHalfW * 2 - 10, 1, 0x4a3010, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 3, 2, 6, 0x4a3010, 1);
  pxRect(ctx, ox + headX + headHalfW - 5, oy + headTop - 3, 2, 6, 0x4a3010, 1);
  // 3 spires
  for (const cxOff of [-16, 0, 16]) {
    const spx = headX + cxOff;
    pxRect(ctx, ox + spx - 3, oy + headTop - 9, 6, 6, gold, 1);
    pxRect(ctx, ox + spx - 2, oy + headTop - 15, 4, 6, gold, 1);
    pxRect(ctx, ox + spx - 1, oy + headTop - 18, 2, 3, gold, 1);
    pxRect(ctx, ox + spx - 4, oy + headTop - 9, 1, 6, 0x4a3010, 1);
    pxRect(ctx, ox + spx + 3, oy + headTop - 9, 1, 6, 0x4a3010, 1);
    pxRect(ctx, ox + spx - 3, oy + headTop - 15, 1, 6, 0x4a3010, 1);
    pxRect(ctx, ox + spx + 2, oy + headTop - 15, 1, 6, 0x4a3010, 1);
    pxRect(ctx, ox + spx - 2, oy + headTop - 19, 4, 1, 0x4a3010, 1);
  }
  // Pink gem
  pxRect(ctx, ox + headX - 3, oy + headTop - 3, 6, 6, gem, 1);
  pxRect(ctx, ox + headX - 3, oy + headTop - 3, 3, 3, 0xffbadd, 1);
  pxRect(ctx, ox + headX - 4, oy + headTop - 3, 1, 6, 0x4a0820, 1);
  pxRect(ctx, ox + headX + 3, oy + headTop - 3, 1, 6, 0x4a0820, 1);
}

// ============================================================================
// NINJA — black hood + face mask + dark gi
// ============================================================================
function drawNinja(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xe8c39a,
    eyeColor: 0x4a2418,
    browColor: 0x000000,
    showEars: false,
    drawTorso: drawNinjaGi,
    drawHair: () => {},
    drawAccessory: drawNinjaHood,
    mouthOverride: () => {}, // hidden behind mask
    noseOverride: () => {},
  }, state, frameIdx);
}

function drawNinjaGi(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const gi = 0x1a1410;
  const giL = 0x3a3030;
  const accent = 0xc4202a;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, gi, giL, 0x0a0808, 0x000000, 60, 18);
  // Cross-wrap
  for (let i = 0; i < 30; i++) {
    pxRect(ctx, ox + cx - 60 + i, oy + shoulderY + 12 + i, 1, 1, 0x000000, 0.85);
  }
  // Red sash
  pxRect(ctx, ox + cx - 60, oy + 234, 120, 14, accent, 1);
  pxRect(ctx, ox + cx - 60, oy + 234, 120, 3, 0xff5040, 0.85);
  pxRect(ctx, ox + cx - 60, oy + 244, 120, 2, 0x8a1010, 1);
  pxRect(ctx, ox + cx - 60, oy + 234, 120, 1, 0x4a0808, 1);
  pxRect(ctx, ox + cx - 60, oy + 248, 120, 1, 0x4a0808, 1);
}

function drawNinjaHood(ctx, ox, oy, c) {
  const { headTop, headBottom, headX, headHalfW, neckY } = c;
  const gi = 0x1a1410;
  const giL = 0x3a3030;
  // Hood wrap covering head + extending down to neck
  pxRect(ctx, ox + headX - headHalfW - 4, oy + headTop - 6, headHalfW * 2 + 8, headBottom - headTop + 18, gi, 1);
  pxRect(ctx, ox + headX - headHalfW, oy + headTop - 6, headHalfW * 2, 8, giL, 0.5);
  pxRect(ctx, ox + headX + headHalfW - 8, oy + headTop, 8, headBottom - headTop, 0x0a0808, 0.6);
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop - 6, 2, headBottom - headTop + 18, 0x000000, 1);
  pxRect(ctx, ox + headX + headHalfW + 4, oy + headTop - 6, 2, headBottom - headTop + 18, 0x000000, 1);
  pxRect(ctx, ox + headX - headHalfW - 4, oy + headTop - 8, headHalfW * 2 + 8, 2, 0x000000, 1);
  // Eye slit — skin visible between hood + mask
  const eyeY = headTop + 38;
  const slitH = 12;
  const slitX = headX - headHalfW + 4;
  const slitW = headHalfW * 2 - 8;
  pxRect(ctx, ox + slitX, oy + eyeY - 2, slitW, slitH, 0xe8c39a, 1);
  pxRect(ctx, ox + slitX, oy + eyeY - 4, slitW, 2, 0x000000, 1);
  pxRect(ctx, ox + slitX, oy + eyeY + slitH - 2, slitW, 2, 0x000000, 1);
}

// ============================================================================
// CONSTRUCTION WORKER — orange safety vest + hard hat
// ============================================================================
function drawConstructor(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xd9a878,
    eyeColor: 0x2a4a3a,
    browColor: 0x3a2418,
    drawTorso: drawConstructorVest,
    drawHair: drawShortBrownHair,
    drawAccessory: drawHardHat,
  }, state, frameIdx);
}

function drawConstructorVest(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const shirt = 0x4a8aca;
  const vest = 0xff8a20;
  const vestL = 0xffba60;
  const stripe = 0xc4c4cc;
  // Blue shirt underneath
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, shirt, 0x7aaadd, 0x1a4080, 0x0a2050, 64, 18);
  // Open collar
  pxRect(ctx, ox + cx - 12, oy + shoulderY, 24, 9, shirt, 1);
  pxRect(ctx, ox + cx - 9, oy + shoulderY + 3, 18, 6, 0x1a4080, 1);
  pxRect(ctx, ox + cx - 13, oy + shoulderY, 1, 9, 0x0a2050, 1);
  pxRect(ctx, ox + cx + 12, oy + shoulderY, 1, 9, 0x0a2050, 1);
  // Vest panels (left + right of the open front)
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 6, 28, 264 - shoulderY - 6, vest, 1);
  pxRect(ctx, ox + cx + 36, oy + shoulderY + 6, 28, 264 - shoulderY - 6, vest, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 6, 28, 4, vestL, 0.7);
  pxRect(ctx, ox + cx + 36, oy + shoulderY + 6, 28, 4, vestL, 0.7);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 5, 28, 1, 0x4a2810, 1);
  pxRect(ctx, ox + cx + 36, oy + shoulderY + 5, 28, 1, 0x4a2810, 1);
  pxRect(ctx, ox + cx - 36, oy + shoulderY + 6, 1, 264 - shoulderY - 6, 0x4a2810, 1);
  pxRect(ctx, ox + cx + 35, oy + shoulderY + 6, 1, 264 - shoulderY - 6, 0x4a2810, 1);
  // Reflective stripes
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 36, 28, 8, stripe, 1);
  pxRect(ctx, ox + cx + 36, oy + shoulderY + 36, 28, 8, stripe, 1);
  pxRect(ctx, ox + cx - 64, oy + shoulderY + 36, 28, 1, 0xffffff, 0.85);
  pxRect(ctx, ox + cx + 36, oy + shoulderY + 36, 28, 1, 0xffffff, 0.85);
}

function drawHardHat(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const yellow = 0xffc020;
  const yellowL = 0xffeb40;
  const yellowS = 0x8a6010;
  // Wide brim with sloped front
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop - 3, headHalfW * 2 + 24, 8, yellow, 1);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop - 3, headHalfW * 2 + 24, 3, yellowL, 1);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop + 3, headHalfW * 2 + 24, 2, yellowS, 1);
  pxRect(ctx, ox + headX - headHalfW - 14, oy + headTop - 3, 2, 8, 0x4a2810, 1);
  pxRect(ctx, ox + headX + headHalfW + 12, oy + headTop - 3, 2, 8, 0x4a2810, 1);
  pxRect(ctx, ox + headX - headHalfW - 12, oy + headTop + 5, headHalfW * 2 + 24, 1, 0x4a2810, 1);
  // Dome
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 24, headHalfW * 2 - 6, 21, yellow, 1);
  pxRect(ctx, ox + headX - headHalfW + 6, oy + headTop - 24, headHalfW * 2 - 12, 6, yellowL, 1);
  pxRect(ctx, ox + headX + headHalfW - 12, oy + headTop - 18, 9, 15, yellowS, 0.6);
  pxRect(ctx, ox + headX - headHalfW + 1, oy + headTop - 24, 2, 21, 0x4a2810, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop - 24, 2, 21, 0x4a2810, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 26, headHalfW * 2 - 6, 2, 0x4a2810, 1);
  // Center ridge
  pxRect(ctx, ox + headX - 1, oy + headTop - 24, 2, 21, yellowS, 0.65);
}

// ============================================================================
// CLOWN — white face paint, red nose, red wig, polka-dot suit
// ============================================================================
function drawClown(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xfff4e0,
    eyeColor: 0x2a4a3a,
    browColor: 0xc4202a,
    blush: 0xff80a0,
    drawTorso: drawClownSuit,
    drawHair: drawClownHair,
    drawAccessory: drawClownNoseEyes,
    mouthOverride: drawClownMouth,
  }, state, frameIdx);
}

function drawClownSuit(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const main = 0xff80ba;
  const accent = 0x4abf60;
  const trim = 0xffffff;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, main, lighten(main, 1.2), darken(main, 0.7), 0x802055, 64, 22);
  // Polka dots
  for (const [dx, dy] of [[-30, 30], [10, 50], [-15, 75], [25, 95]]) {
    pxRect(ctx, ox + cx + dx, oy + shoulderY + dy, 14, 14, accent, 1);
    pxRect(ctx, ox + cx + dx, oy + shoulderY + dy, 14, 3, 0x80ff80, 0.85);
    pxRect(ctx, ox + cx + dx - 1, oy + shoulderY + dy, 1, 14, 0x000000, 0.7);
    pxRect(ctx, ox + cx + dx + 14, oy + shoulderY + dy, 1, 14, 0x000000, 0.7);
  }
  // Ruffled collar
  pxRect(ctx, ox + cx - 70, oy + shoulderY - 6, 140, 16, trim, 1);
  pxRect(ctx, ox + cx - 70, oy + shoulderY - 6, 140, 5, lighten(trim, 1.05), 1);
  for (let i = 0; i < 140; i += 10) {
    pxRect(ctx, ox + cx - 70 + i, oy + shoulderY - 9, 6, 4, trim, 1);
    pxRect(ctx, ox + cx - 70 + i + 6, oy + shoulderY - 6, 3, 3, 0xc4b890, 0.6);
  }
  pxRect(ctx, ox + cx - 70, oy + shoulderY + 9, 140, 1, 0x000000, 1);
  pxRect(ctx, ox + cx - 71, oy + shoulderY - 6, 1, 16, 0x000000, 1);
  pxRect(ctx, ox + cx + 70, oy + shoulderY - 6, 1, 16, 0x000000, 1);
}

function drawClownHair(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const red = 0xff4040;
  const redL = 0xff8080;
  // Big puff on top
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop - 24, headHalfW * 2 + 12, 28, red, 1);
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop - 24, headHalfW * 2 + 12, 10, redL, 0.75);
  // Side puffs
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 4, 12, 32, red, 1);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop + 4, 12, 32, red, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 4, 6, 16, redL, 0.7);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop + 4, 6, 16, redL, 0.7);
  // Outline
  pxRect(ctx, ox + headX - headHalfW - 6, oy + headTop - 27, headHalfW * 2 + 12, 3, 0x801010, 1);
  pxRect(ctx, ox + headX - headHalfW - 8, oy + headTop - 24, 2, 28, 0x801010, 1);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop - 24, 2, 28, 0x801010, 1);
  pxRect(ctx, ox + headX - headHalfW - 20, oy + headTop + 4, 2, 32, 0x801010, 1);
  pxRect(ctx, ox + headX + headHalfW + 18, oy + headTop + 4, 2, 32, 0x801010, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 36, 12, 1, 0x801010, 1);
  pxRect(ctx, ox + headX + headHalfW + 6, oy + headTop + 36, 12, 1, 0x801010, 1);
  // Tuft spikes
  pxRect(ctx, ox + headX - 2, oy + headTop - 32, 4, 8, red, 1);
  pxRect(ctx, ox + headX - 3, oy + headTop - 32, 1, 8, 0x801010, 1);
  pxRect(ctx, ox + headX + 2, oy + headTop - 32, 1, 8, 0x801010, 1);
  pxRect(ctx, ox + headX - 2, oy + headTop - 33, 4, 1, 0x801010, 1);
}

function drawClownNoseEyes(ctx, ox, oy, c) {
  const { headTop, headX } = c;
  const noseY = headTop + 46;
  pxRect(ctx, ox + headX - 10, oy + noseY, 20, 16, 0xff2020, 1);
  pxRect(ctx, ox + headX - 10, oy + noseY, 20, 4, 0xff7070, 1);
  pxRect(ctx, ox + headX - 5, oy + noseY + 2, 4, 4, 0xffffff, 0.85);
  pxRect(ctx, ox + headX - 11, oy + noseY, 1, 16, 0x4a0808, 1);
  pxRect(ctx, ox + headX + 10, oy + noseY, 1, 16, 0x4a0808, 1);
  pxRect(ctx, ox + headX - 10, oy + noseY - 1, 20, 1, 0x4a0808, 1);
  pxRect(ctx, ox + headX - 10, oy + noseY + 16, 20, 1, 0x4a0808, 1);
  // Diamond eye-makeup patches
  const eyeY = headTop + 32;
  for (let r = 0; r < 9; r++) {
    const w = r < 4 ? r + 1 : 9 - r;
    pxRect(ctx, ox + headX - 14 - w, oy + eyeY + r, w * 2, 1, 0x40a0ff, 1);
    pxRect(ctx, ox + headX + 14 - w, oy + eyeY + r, w * 2, 1, 0xa040c4, 1);
  }
}

function drawClownMouth(ctx, ox, oy, c, state, frameIdx, mouthOpen) {
  const { headTop, headX } = c;
  const my = headTop + 64;
  const red = 0xff2020;
  pxRect(ctx, ox + headX - 18, oy + my, 36, 9, red, 1);
  pxRect(ctx, ox + headX - 15, oy + my + 9, 30, 4, red, 1);
  pxRect(ctx, ox + headX - 22, oy + my - 3, 5, 6, red, 1);
  pxRect(ctx, ox + headX + 17, oy + my - 3, 5, 6, red, 1);
  pxRect(ctx, ox + headX - 18, oy + my - 1, 36, 1, 0x4a0808, 1);
  pxRect(ctx, ox + headX - 15, oy + my + 13, 30, 1, 0x4a0808, 1);
  if (mouthOpen || state === 'furious') {
    pxRect(ctx, ox + headX - 12, oy + my + 2, 24, 5, 0x1a0a08, 1);
    pxRect(ctx, ox + headX - 9, oy + my + 2, 18, 2, 0xfff4d6, 1);
  } else {
    pxRect(ctx, ox + headX - 12, oy + my + 3, 24, 3, 0xfff4d6, 1);
  }
}

// ============================================================================
// COWBOY — brown wide-brim hat, tan shirt, red bandana around neck
// ============================================================================
function drawCowboy(ctx, ox, oy, state, frameIdx) {
  drawBustBase(ctx, ox, oy, {
    skin: 0xd9a878,
    eyeColor: 0x4a2418,
    browColor: 0x3a2418,
    drawTorso: drawCowboyShirt,
    drawHair: drawShortBrownHair,
    drawAccessory: drawCowboyHat,
  }, state, frameIdx);
}

function drawCowboyShirt(ctx, ox, oy, c) {
  const { cx, shoulderY } = c;
  const shirt = 0xa88060;
  const shirtL = 0xd0a880;
  const shirtS = 0x6a4828;
  const bandana = 0xc44a3a;
  const bandanaL = 0xff7060;
  drawTrapezoidalTorso(ctx, ox, oy, cx, shoulderY, shirt, shirtL, shirtS, 0x2a1810, 64, 18);
  // Red bandana around the neck — wraps the top
  pxRect(ctx, ox + cx - 28, oy + shoulderY - 3, 56, 18, bandana, 1);
  pxRect(ctx, ox + cx - 28, oy + shoulderY - 3, 56, 4, bandanaL, 0.85);
  pxRect(ctx, ox + cx - 28, oy + shoulderY + 11, 56, 4, 0x8a1010, 1);
  // Triangle point hanging down
  pxRect(ctx, ox + cx - 14, oy + shoulderY + 15, 28, 7, bandana, 1);
  pxRect(ctx, ox + cx - 8, oy + shoulderY + 22, 16, 7, bandana, 1);
  pxRect(ctx, ox + cx - 4, oy + shoulderY + 29, 8, 4, bandana, 1);
  // Outlines
  pxRect(ctx, ox + cx - 28, oy + shoulderY - 5, 56, 2, 0x401010, 1);
  pxRect(ctx, ox + cx - 30, oy + shoulderY - 3, 2, 18, 0x401010, 1);
  pxRect(ctx, ox + cx + 28, oy + shoulderY - 3, 2, 18, 0x401010, 1);
  pxRect(ctx, ox + cx - 16, oy + shoulderY + 15, 2, 7, 0x401010, 1);
  pxRect(ctx, ox + cx + 14, oy + shoulderY + 15, 2, 7, 0x401010, 1);
  pxRect(ctx, ox + cx - 10, oy + shoulderY + 22, 2, 7, 0x401010, 1);
  pxRect(ctx, ox + cx + 8, oy + shoulderY + 22, 2, 7, 0x401010, 1);
  pxRect(ctx, ox + cx - 6, oy + shoulderY + 29, 2, 4, 0x401010, 1);
  pxRect(ctx, ox + cx + 4, oy + shoulderY + 29, 2, 4, 0x401010, 1);
  pxRect(ctx, ox + cx - 4, oy + shoulderY + 33, 8, 1, 0x401010, 1);
  // Polka dots
  pxRect(ctx, ox + cx - 22, oy + shoulderY + 3, 4, 4, bandanaL, 0.85);
  pxRect(ctx, ox + cx - 8, oy + shoulderY + 7, 4, 4, bandanaL, 0.85);
  pxRect(ctx, ox + cx + 14, oy + shoulderY + 3, 4, 4, bandanaL, 0.85);
  // Shirt buttons (down the placket below the bandana)
  for (let i = 0; i < 3; i++) {
    const by = shoulderY + 40 + i * 20;
    if (by < 256) {
      pxRect(ctx, ox + cx - 2, oy + by, 4, 4, 0xd0a880, 1);
      pxRect(ctx, ox + cx - 3, oy + by, 1, 4, 0x4a3010, 0.6);
      pxRect(ctx, ox + cx + 2, oy + by, 1, 4, 0x4a3010, 0.6);
    }
  }
}

function drawCowboyHat(ctx, ox, oy, c) {
  const { headTop, headX, headHalfW } = c;
  const brown = 0x6a4828;
  const brownL = 0x9c6a4a;
  const brownS = 0x3a2418;
  const band = 0x1a1410;
  // Wide brim
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop - 3, headHalfW * 2 + 36, 9, brown, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop - 3, headHalfW * 2 + 36, 3, brownL, 0.7);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 3, headHalfW * 2 + 36, 3, brownS, 0.7);
  // Curled-up sides
  pxRect(ctx, ox + headX - headHalfW - 21, oy + headTop - 6, 6, 6, brown, 1);
  pxRect(ctx, ox + headX + headHalfW + 15, oy + headTop - 6, 6, 6, brown, 1);
  pxRect(ctx, ox + headX - headHalfW - 23, oy + headTop - 6, 2, 9, 0x2a1810, 1);
  pxRect(ctx, ox + headX + headHalfW + 21, oy + headTop - 6, 2, 9, 0x2a1810, 1);
  pxRect(ctx, ox + headX - headHalfW - 18, oy + headTop + 6, headHalfW * 2 + 36, 2, 0x2a1810, 1);
  // Crown
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 27, headHalfW * 2 - 6, 24, brown, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 27, headHalfW * 2 - 6, 6, brownL, 0.8);
  pxRect(ctx, ox + headX + headHalfW - 15, oy + headTop - 24, 12, 21, brownS, 0.55);
  pxRect(ctx, ox + headX - headHalfW + 1, oy + headTop - 27, 2, 24, 0x2a1810, 1);
  pxRect(ctx, ox + headX + headHalfW - 3, oy + headTop - 27, 2, 24, 0x2a1810, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 30, headHalfW * 2 - 6, 3, 0x2a1810, 1);
  // Pinched front crease
  pxRect(ctx, ox + headX - 1, oy + headTop - 27, 2, 24, brownS, 0.65);
  // Hatband
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 12, headHalfW * 2 - 6, 6, band, 1);
  pxRect(ctx, ox + headX - headHalfW + 3, oy + headTop - 12, headHalfW * 2 - 6, 1, 0x4a4040, 1);
  pxRect(ctx, ox + headX - 3, oy + headTop - 12, 6, 6, 0xc4c4cc, 1);
  pxRect(ctx, ox + headX - 3, oy + headTop - 12, 6, 2, 0xffffff, 0.85);
}

// ============================================================================
// REGISTRY
// ============================================================================
export const ARCHETYPES = [
  { id: 'client_zombie',       label: 'Zombie',       special: false, draw: drawZombie },
  { id: 'client_pirate',       label: 'Pirate',       special: false, draw: drawPirate },
  { id: 'client_alien',        label: 'Alien',        special: false, draw: drawAlien },
  { id: 'client_athlete',      label: 'Athlete',      special: false, draw: drawAthlete },
  { id: 'client_firefighter',  label: 'Firefighter',  special: false, draw: drawFirefighter },
  { id: 'client_santa',        label: 'Santa',        special: false, draw: drawSanta },
  { id: 'client_cop',          label: 'Cop',          special: false, draw: drawCop },
  { id: 'client_surgeon',      label: 'Surgeon',      special: false, draw: drawSurgeon },
  { id: 'client_knight',       label: 'Knight',       special: false, draw: drawKnight },
  { id: 'client_robot',        label: 'Robot',        special: false, draw: drawRobot },
  { id: 'client_wizard',       label: 'Wizard',       special: false, draw: drawWizard },
  { id: 'client_princess',     label: 'Princess',     special: false, draw: drawPrincess },
  { id: 'client_ninja',        label: 'Ninja',        special: false, draw: drawNinja },
  { id: 'client_constructor',  label: 'Construction', special: false, draw: drawConstructor },
  { id: 'client_clown',        label: 'Clown',        special: false, draw: drawClown },
  { id: 'client_cowboy',       label: 'Cowboy',       special: false, draw: drawCowboy },
];
