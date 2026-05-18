// Pure pixel-art renderers for the 5 level backgrounds.
//
// Each background fills the upper "customer side" of the canvas — the
// wall behind the patrons. Width × Height = 1920 × 370 src px (matches
// the area 0..tapY-80 in GameScene.drawBackdrop). The bar strip + floor
// + tap rig are drawn on top of this by GameScene, so backgrounds should
// be purely scenic (walls, shelves, decor, lighting).
//
// Used both at runtime (BootScene fallback) and offline
// (scripts/build-backgrounds.js writes one PNG per level into
// public/sprites/backgrounds/level_<n>/bg.png).

export const BG_W = 1920;
export const BG_H = 370;
// Back-bar wall — the bartender-side area behind the row of taps.
// Width × Height = 1920 × 530, covering y = (tapY-80+60) .. (glassY+180)
// in GameScene's coordinate system. Below the bar strip, above the
// counter-top. Drawn behind the taps + glasses by GameScene.drawBackdrop.
export const BACK_W = 1920;
export const BACK_H = 530;

function rgba(c, a) {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

function fill(ctx, x, y, w, h, color, alpha = 1) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function darken(c, f) {
  const r = Math.floor(((c >> 16) & 0xff) * f);
  const g = Math.floor(((c >> 8) & 0xff) * f);
  const b = Math.floor((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function lighten(c, f) {
  const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.floor((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

// ============================================================================
// LEVEL 1 — IRISH PUB
// Dark wood-panel walls, brass-edged shelves with bottles, a stone fireplace
// in the right third, framed pictures, candle sconces, warm amber backlight.
// ============================================================================
function drawIrishPub(ctx, ox = 0, oy = 0) {
  const W = BG_W;
  const H = BG_H;

  // ---- Wall: vertical wood panels ----
  const wallM = 0x4a2818;
  const wallL = 0x6a3a24;
  const wallD = 0x2a1408;
  const wallDeep = 0x1a0a04;

  // Base wall fill
  fill(ctx, ox, oy, W, H, wallM);

  // Vertical panel seams every 60 px
  for (let x = 0; x < W; x += 60) {
    fill(ctx, ox + x, oy, 2, H, wallD, 1);
    fill(ctx, ox + x + 2, oy, 1, H, wallL, 0.6);
  }

  // Horizontal trim rails: a chunky one at the top, another mid-wall (chair rail)
  // Top crown molding — 3-row stack: dark, gold, darker
  fill(ctx, ox, oy, W, 6, wallDeep);
  fill(ctx, ox, oy + 6, W, 3, 0xa48030); // brass strip
  fill(ctx, ox, oy + 6, W, 1, 0xffd040, 0.8);
  fill(ctx, ox, oy + 9, W, 4, wallD);
  fill(ctx, ox, oy + 13, W, 2, wallL);

  // Chair rail at y ≈ 280
  const chairY = 280;
  fill(ctx, ox, oy + chairY, W, 4, wallD);
  fill(ctx, ox, oy + chairY + 4, W, 2, 0xa48030); // brass
  fill(ctx, ox, oy + chairY + 4, W, 1, 0xffd040, 0.7);
  fill(ctx, ox, oy + chairY + 6, W, 3, wallD);

  // Warm amber backlight gradient — bright at center-top, fading down/outward
  for (let y = 20; y < chairY; y += 2) {
    const t = (y - 20) / (chairY - 20);
    const a = (1 - t) * 0.18;
    fill(ctx, ox + 200, oy + y, W - 400, 2, 0xffaa40, a);
  }

  // ---- LEFT THIRD: Bottle shelf (~80..640 x, behind the bar) ----
  const shelfX1 = 80;
  const shelfX2 = 640;
  const shelfY1 = 50;   // top shelf
  const shelfY2 = 130;  // middle shelf
  const shelfY3 = 210;  // bottom shelf

  // Wood-and-brass shelf planks
  for (const sy of [shelfY1, shelfY2, shelfY3]) {
    // Shelf plank — dark wood
    fill(ctx, ox + shelfX1 - 12, oy + sy, shelfX2 - shelfX1 + 24, 12, 0x3a2010);
    // Top edge lighter (catches light from above)
    fill(ctx, ox + shelfX1 - 12, oy + sy, shelfX2 - shelfX1 + 24, 3, 0x5a3018, 1);
    fill(ctx, ox + shelfX1 - 12, oy + sy + 1, shelfX2 - shelfX1 + 24, 1, 0x7a4828, 0.8);
    // Bottom edge darker (cast shadow)
    fill(ctx, ox + shelfX1 - 12, oy + sy + 10, shelfX2 - shelfX1 + 24, 2, 0x1a0a04);
    // Brass front lip
    fill(ctx, ox + shelfX1 - 12, oy + sy + 9, shelfX2 - shelfX1 + 24, 2, 0xa48030, 1);
    fill(ctx, ox + shelfX1 - 12, oy + sy + 9, shelfX2 - shelfX1 + 24, 1, 0xffd040, 0.7);
  }

  // Bottles on each shelf — alternating shapes/colors
  const bottleTypes = [
    { w: 12, h: 36, body: 0x3a8a4a, neck: 0x2a6a3a, label: 0xfff4d6 }, // green
    { w: 14, h: 32, body: 0x6a3a1a, neck: 0x4a2810, label: 0xc4a020 }, // amber
    { w: 10, h: 38, body: 0x4a3a8a, neck: 0x3a2a6a, label: 0xffffff }, // blue
    { w: 16, h: 30, body: 0x8a3a3a, neck: 0x6a2424, label: 0xffd040 }, // red
    { w: 12, h: 34, body: 0x2a4a6a, neck: 0x1a3a5a, label: 0xfff4d6 }, // teal
    { w: 14, h: 36, body: 0x6a5a3a, neck: 0x4a3a24, label: 0xc4a020 }, // brown
  ];
  for (const sy of [shelfY1, shelfY2, shelfY3]) {
    for (let bx = shelfX1; bx < shelfX2; bx += 36) {
      const type = bottleTypes[(bx + sy) % bottleTypes.length];
      const bottleX = bx + Math.floor((36 - type.w) / 2);
      const bottleTop = sy - type.h;
      // Body
      fill(ctx, ox + bottleX, oy + bottleTop, type.w, type.h, type.body);
      // Highlight column
      fill(ctx, ox + bottleX + 1, oy + bottleTop + 4, 2, type.h - 8, lighten(type.body, 1.4), 0.7);
      // Shadow column
      fill(ctx, ox + bottleX + type.w - 2, oy + bottleTop + 4, 1, type.h - 8, darken(type.body, 0.6), 0.8);
      // Neck (narrower)
      const neckW = Math.max(3, Math.floor(type.w * 0.35));
      const neckX = bottleX + Math.floor((type.w - neckW) / 2);
      fill(ctx, ox + neckX, oy + bottleTop - 10, neckW, 10, type.neck);
      fill(ctx, ox + neckX, oy + bottleTop - 10, 1, 10, lighten(type.neck, 1.3), 0.7);
      // Cork / cap
      fill(ctx, ox + neckX - 1, oy + bottleTop - 12, neckW + 2, 2, 0x8a6010);
      // Label band
      fill(ctx, ox + bottleX, oy + bottleTop + 14, type.w, 8, type.label);
      fill(ctx, ox + bottleX, oy + bottleTop + 14, type.w, 1, lighten(type.label, 1.1), 0.7);
      fill(ctx, ox + bottleX, oy + bottleTop + 21, type.w, 1, darken(type.label, 0.6), 0.8);
      // Outline silhouette
      fill(ctx, ox + bottleX - 1, oy + bottleTop, 1, type.h, 0x1a0a04);
      fill(ctx, ox + bottleX + type.w, oy + bottleTop, 1, type.h, 0x1a0a04);
      fill(ctx, ox + neckX - 1, oy + bottleTop - 10, 1, 10, 0x1a0a04);
      fill(ctx, ox + neckX + neckW, oy + bottleTop - 10, 1, 10, 0x1a0a04);
    }
  }

  // ---- CENTER: Framed picture + candle sconce ----
  // Big framed painting (~720..960)
  const frameX = 720;
  const frameY = 60;
  const frameW = 240;
  const frameH = 140;
  // Outer frame — ornate gold with brown inner
  fill(ctx, ox + frameX, oy + frameY, frameW, frameH, 0x6a4828);
  fill(ctx, ox + frameX, oy + frameY, frameW, 6, lighten(0x6a4828, 1.4), 0.85);
  fill(ctx, ox + frameX, oy + frameY + frameH - 6, frameW, 6, darken(0x6a4828, 0.6));
  fill(ctx, ox + frameX, oy + frameY, 6, frameH, lighten(0x6a4828, 1.4), 0.85);
  fill(ctx, ox + frameX + frameW - 6, oy + frameY, 6, frameH, darken(0x6a4828, 0.6));
  // Inner gold trim
  fill(ctx, ox + frameX + 8, oy + frameY + 8, frameW - 16, 4, 0xa48030);
  fill(ctx, ox + frameX + 8, oy + frameY + 8, frameW - 16, 1, 0xffd040, 0.8);
  fill(ctx, ox + frameX + 8, oy + frameY + frameH - 12, frameW - 16, 4, 0xa48030);
  fill(ctx, ox + frameX + 8, oy + frameY + 8, 4, frameH - 16, 0xa48030);
  fill(ctx, ox + frameX + frameW - 12, oy + frameY + 8, 4, frameH - 16, 0xa48030);
  // Inner canvas — a stylised ship at sea
  fill(ctx, ox + frameX + 12, oy + frameY + 12, frameW - 24, frameH - 24, 0x4a6a8a); // sky/sea
  // Sky (top half)
  fill(ctx, ox + frameX + 12, oy + frameY + 12, frameW - 24, (frameH - 24) / 2, 0x6a8aaa);
  fill(ctx, ox + frameX + 12, oy + frameY + 12, frameW - 24, 8, 0xa4c4d4); // bright horizon
  // Sun
  fill(ctx, ox + frameX + frameW - 50, oy + frameY + 24, 18, 18, 0xffd460);
  fill(ctx, ox + frameX + frameW - 50, oy + frameY + 24, 14, 14, 0xffeb80, 0.85);
  // Sea (bottom half)
  fill(ctx, ox + frameX + 12, oy + frameY + 12 + (frameH - 24) / 2, frameW - 24, (frameH - 24) / 2, 0x2a4a6a);
  fill(ctx, ox + frameX + 12, oy + frameY + 12 + (frameH - 24) / 2, frameW - 24, 4, 0x4a6a8a);
  // Wave crests
  for (let wx = frameX + 16; wx < frameX + frameW - 16; wx += 14) {
    fill(ctx, ox + wx, oy + frameY + frameH - 30, 6, 1, 0xa4c4d4, 0.7);
    fill(ctx, ox + wx + 4, oy + frameY + frameH - 20, 6, 1, 0xa4c4d4, 0.5);
  }
  // Ship silhouette
  const shipX = frameX + Math.floor((frameW - 24) / 2) - 18;
  const shipY = frameY + Math.floor(frameH / 2) - 4;
  // Hull
  fill(ctx, ox + shipX, oy + shipY, 36, 10, 0x2a1810);
  fill(ctx, ox + shipX + 4, oy + shipY + 10, 28, 4, 0x2a1810);
  // Masts + sails
  fill(ctx, ox + shipX + 8, oy + shipY - 24, 2, 24, 0x6a4828);
  fill(ctx, ox + shipX + 24, oy + shipY - 30, 2, 30, 0x6a4828);
  fill(ctx, ox + shipX + 4, oy + shipY - 20, 12, 18, 0xfff4d6);
  fill(ctx, ox + shipX + 20, oy + shipY - 26, 12, 24, 0xfff4d6);
  fill(ctx, ox + shipX + 4, oy + shipY - 20, 12, 4, 0xc4b890, 0.7);
  fill(ctx, ox + shipX + 20, oy + shipY - 26, 12, 4, 0xc4b890, 0.7);

  // Candle sconce LEFT of frame (~680)
  drawSconce(ctx, ox + 680, oy + 100);
  // Candle sconce RIGHT of frame (~980)
  drawSconce(ctx, ox + 980, oy + 100);

  // ---- RIGHT THIRD: Stone fireplace (~1100..1700) ----
  const fpX = 1100;
  const fpY = 30;
  const fpW = 600;
  const fpH = chairY - fpY - 10; // up to the chair rail
  // Stone mantel + sides
  drawStoneBlockWall(ctx, ox + fpX, oy + fpY, fpW, fpH);
  // Mantel ledge (heavy wooden beam across the top of the fireplace)
  fill(ctx, ox + fpX - 20, oy + fpY + 60, fpW + 40, 18, 0x3a2010);
  fill(ctx, ox + fpX - 20, oy + fpY + 60, fpW + 40, 4, 0x6a3a1a);
  fill(ctx, ox + fpX - 20, oy + fpY + 60, fpW + 40, 1, 0x8a5a3a, 0.85);
  fill(ctx, ox + fpX - 20, oy + fpY + 76, fpW + 40, 2, 0x1a0a04);
  // Mantel decor: 3 mugs/bottles
  for (let i = 0; i < 3; i++) {
    const mx = fpX + 120 + i * 160;
    const my = fpY + 60 - 32;
    // Mug body
    fill(ctx, ox + mx, oy + my, 26, 32, 0x6a4828);
    fill(ctx, ox + mx, oy + my, 26, 5, lighten(0x6a4828, 1.4), 0.8);
    fill(ctx, ox + mx + 22, oy + my + 4, 4, 24, darken(0x6a4828, 0.6));
    // Handle
    fill(ctx, ox + mx + 26, oy + my + 6, 8, 4, 0x6a4828);
    fill(ctx, ox + mx + 32, oy + my + 6, 2, 16, 0x6a4828);
    fill(ctx, ox + mx + 26, oy + my + 20, 8, 4, 0x6a4828);
    fill(ctx, ox + mx - 1, oy + my, 1, 32, 0x1a0a04);
    fill(ctx, ox + mx + 26, oy + my, 1, 6, 0x1a0a04);
    fill(ctx, ox + mx + 33, oy + my + 6, 2, 18, 0x1a0a04);
    fill(ctx, ox + mx + 26, oy + my + 24, 1, 4, 0x1a0a04);
    fill(ctx, ox + mx, oy + my - 1, 26, 1, 0x1a0a04);
    fill(ctx, ox + mx, oy + my + 32, 26, 1, 0x1a0a04);
    // Foam on top
    fill(ctx, ox + mx + 2, oy + my - 4, 22, 4, 0xfff4d6);
    fill(ctx, ox + mx + 4, oy + my - 6, 18, 2, 0xfff4d6);
    fill(ctx, ox + mx + 4, oy + my - 6, 18, 1, 0xffffff, 0.85);
  }

  // Fireplace opening (inside the stone — black with flames)
  const openX = fpX + 140;
  const openY = fpY + 110;
  const openW = fpW - 280;
  const openH = fpH - 130;
  // Black interior
  fill(ctx, ox + openX, oy + openY, openW, openH, 0x0a0604);
  // Inner stone arch outline
  for (let y = 0; y < 12; y++) {
    const inset = Math.round((12 - y) * 1.2);
    fill(ctx, ox + openX + inset, oy + openY + y, openW - inset * 2, 1, 0x3a2818, 1);
  }
  fill(ctx, ox + openX, oy + openY, 2, openH, 0x1a0a04);
  fill(ctx, ox + openX + openW - 2, oy + openY, 2, openH, 0x1a0a04);
  fill(ctx, ox + openX, oy + openY + openH - 4, openW, 4, 0x1a0a04);
  // Flames — wavy yellow/orange/red shape inside
  const flameW = openW - 60;
  const flameX = openX + 30;
  const flameY = openY + openH - 70;
  // Base log glow (red)
  fill(ctx, ox + flameX, oy + flameY + 50, flameW, 16, 0xc42010, 1);
  fill(ctx, ox + flameX, oy + flameY + 56, flameW, 4, 0xff5020, 0.85);
  fill(ctx, ox + flameX + 6, oy + flameY + 50, flameW - 12, 2, 0xffaa40, 0.7);
  // Logs
  for (let i = 0; i < 3; i++) {
    const lx = flameX + 8 + i * Math.floor((flameW - 16) / 3);
    fill(ctx, ox + lx, oy + flameY + 56, 30, 10, 0x3a1808);
    fill(ctx, ox + lx + 2, oy + flameY + 58, 26, 1, 0x6a3a18, 0.85);
    fill(ctx, ox + lx, oy + flameY + 64, 30, 2, 0x140804);
  }
  // Flame body — multiple tiered tongues
  fill(ctx, ox + flameX + 10, oy + flameY + 36, flameW - 20, 16, 0xff7020);
  fill(ctx, ox + flameX + 18, oy + flameY + 22, flameW - 36, 18, 0xffaa40);
  fill(ctx, ox + flameX + 26, oy + flameY + 8, flameW - 52, 18, 0xffd060);
  fill(ctx, ox + flameX + 34, oy + flameY - 4, flameW - 68, 18, 0xfff080);
  // Individual flame tips (taller in the middle)
  for (let i = 0; i < 5; i++) {
    const tx = flameX + 20 + i * Math.floor((flameW - 40) / 4);
    const th = 12 + (i === 2 ? 18 : i === 1 || i === 3 ? 10 : 4);
    fill(ctx, ox + tx, oy + flameY - 14 - th, 8, th + 10, 0xffaa40);
    fill(ctx, ox + tx + 2, oy + flameY - 12 - th, 4, th + 6, 0xffd060);
    fill(ctx, ox + tx + 3, oy + flameY - 10 - th, 2, th, 0xfff080);
  }
  // Inner ember glow
  fill(ctx, ox + flameX + 30, oy + flameY + 42, flameW - 60, 6, 0xffd060, 0.7);

  // Warm glow spilling out from the fireplace into the wall area
  for (let r = 1; r < 80; r += 2) {
    const a = 0.04 * (1 - r / 80);
    fill(ctx, ox + openX - r, oy + openY - r, openW + r * 2, openH + r * 2, 0xff8030, a);
  }

  // ---- Hanging horseshoe ABOVE the fireplace opening ----
  const hsX = openX + Math.floor(openW / 2) - 16;
  const hsY = openY - 50;
  fill(ctx, ox + hsX, oy + hsY, 32, 6, 0xa48030);
  fill(ctx, ox + hsX, oy + hsY, 32, 1, 0xffd040, 0.85);
  fill(ctx, ox + hsX, oy + hsY, 6, 16, 0xa48030);
  fill(ctx, ox + hsX + 26, oy + hsY, 6, 16, 0xa48030);
  fill(ctx, ox + hsX, oy + hsY, 1, 16, 0xffd040, 0.85);
  fill(ctx, ox + hsX + 26, oy + hsY, 1, 16, 0xffd040, 0.85);
  fill(ctx, ox + hsX - 1, oy + hsY, 1, 16, 0x4a3010);
  fill(ctx, ox + hsX + 6, oy + hsY, 1, 16, 0x4a3010);
  fill(ctx, ox + hsX + 25, oy + hsY, 1, 16, 0x4a3010);
  fill(ctx, ox + hsX + 32, oy + hsY, 1, 16, 0x4a3010);

  // ---- LEFT WALL: clover symbol painted on the wall ----
  const clX = 30;
  const clY = 50;
  fill(ctx, ox + clX, oy + clY, 4, 4, 0x2a8a3a);          // top
  fill(ctx, ox + clX - 6, oy + clY + 4, 4, 4, 0x2a8a3a);  // left
  fill(ctx, ox + clX + 6, oy + clY + 4, 4, 4, 0x2a8a3a);  // right
  fill(ctx, ox + clX, oy + clY + 8, 4, 4, 0x2a8a3a);      // bottom
  fill(ctx, ox + clX, oy + clY + 4, 4, 4, 0x2a8a3a);      // center
  // Highlight
  fill(ctx, ox + clX, oy + clY, 2, 2, 0x6abf60, 0.85);
  fill(ctx, ox + clX - 6, oy + clY + 4, 2, 2, 0x6abf60, 0.85);
  // Stem
  fill(ctx, ox + clX + 1, oy + clY + 12, 2, 8, 0x3a4a1a);

  // ---- Subtle wall scratches/dings for character ----
  for (const [sx, sy, sw] of [[180, 240, 12], [410, 180, 8], [880, 230, 14], [1820, 200, 10]]) {
    fill(ctx, ox + sx, oy + sy, sw, 1, wallD, 0.6);
    fill(ctx, ox + sx + 1, oy + sy + 1, sw - 2, 1, wallD, 0.4);
  }

  // ---- Top vignette: shadow at top of frame, suggesting low ceiling ----
  for (let y = 0; y < 20; y++) {
    fill(ctx, ox, oy + y, W, 1, 0x0a0604, 0.7 - y * 0.03);
  }

  // ---- Bottom darkening near the bar ----
  for (let y = chairY + 10; y < H; y++) {
    const t = (y - chairY - 10) / (H - chairY - 10);
    fill(ctx, ox, oy + y, W, 1, 0x0a0604, t * 0.35);
  }
}

/** Wall-mounted candle sconce — a metal bracket with a lit candle and flame. */
function drawSconce(ctx, x, y) {
  // Bracket (metal arm)
  fill(ctx, x, y, 4, 22, 0x4a3018);
  fill(ctx, x, y, 4, 2, 0x6a4828);
  fill(ctx, x - 6, y - 4, 16, 4, 0x4a3018); // top cup
  fill(ctx, x - 6, y - 4, 16, 1, 0x8a5a3a, 0.8);
  fill(ctx, x - 6, y, 16, 1, 0x1a0a04);
  // Candle wax
  fill(ctx, x - 2, y - 14, 8, 12, 0xf2deba);
  fill(ctx, x - 2, y - 14, 2, 12, 0xfff4d6, 0.85);
  fill(ctx, x + 4, y - 14, 2, 12, 0xc4b890, 0.85);
  // Wick
  fill(ctx, x + 1, y - 18, 1, 4, 0x1a1410);
  // Flame
  fill(ctx, x, y - 28, 4, 10, 0xffaa40);
  fill(ctx, x + 1, y - 32, 2, 14, 0xffd060);
  fill(ctx, x + 1, y - 32, 2, 6, 0xfff080);
  // Halo
  for (let r = 1; r < 30; r += 2) {
    fill(ctx, x - r + 2, y - 28 - r / 2, r * 2 - 2, 1, 0xff8030, 0.04 * (1 - r / 30));
  }
  fill(ctx, x - 10, y - 26, 20, 8, 0xffaa40, 0.12);
}

/** Pattern of stone blocks — randomized brick-like wall. */
function drawStoneBlockWall(ctx, x, y, w, h) {
  const stone = 0x6a5a4a;
  const stoneL = 0x9c8a72;
  const stoneD = 0x3a2a18;
  fill(ctx, x, y, w, h, stone);
  // Brick pattern — rows of stones, offset every other row.
  const rowH = 20;
  const stoneW = 50;
  for (let row = 0; row * rowH < h; row++) {
    const py = y + row * rowH;
    const offset = (row % 2) * Math.floor(stoneW / 2);
    for (let bx = -offset; bx < w; bx += stoneW) {
      // Stone tone variation
      const tone = (row + bx) % 3;
      const c = tone === 0 ? stone : tone === 1 ? lighten(stone, 1.1) : darken(stone, 0.85);
      fill(ctx, x + bx, py, stoneW, rowH, c);
      // Highlight top
      fill(ctx, x + bx, py, stoneW, 2, lighten(c, 1.3), 0.7);
      // Shadow bottom
      fill(ctx, x + bx, py + rowH - 2, stoneW, 2, darken(c, 0.5), 0.85);
      // Mortar lines
      fill(ctx, x + Math.max(0, bx), py + rowH - 1, Math.min(stoneW, w - bx), 1, stoneD);
      if (bx >= 0 && bx + stoneW <= w) {
        fill(ctx, x + bx + stoneW - 1, py, 1, rowH, stoneD);
      }
    }
  }
  // Outer outline
  fill(ctx, x - 2, y, 2, h, 0x1a0a04);
  fill(ctx, x + w, y, 2, h, 0x1a0a04);
  fill(ctx, x, y - 2, w, 2, 0x1a0a04);
}

// ============================================================================
// Stub backgrounds for levels 2-5 — fall through to the Irish pub for now.
// Will be replaced with bespoke draws in subsequent batches.
// ============================================================================
function drawTODO(ctx, ox, oy) {
  drawIrishPub(ctx, ox, oy);
  // Banner overlay to make it obvious this is a placeholder
  fill(ctx, ox, oy + 6, BG_W, 16, 0x000000, 0.5);
  ctx.fillStyle = 'rgba(255,212,64,1)';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('TODO — placeholder background', ox + 20, oy + 18);
}

// ============================================================================
// BACK-BAR WALLS — drawn between the bar strip and the counter-top, behind
// the row of taps. Width × Height = BACK_W × BACK_H = 1920 × 530.
// ============================================================================

// LEVEL 1 — IRISH PUB back-bar (minimalist):
// Plain dark vertical wood paneling. A single brass rail at the very top
// (under the bar strip) and a soft bottom shadow where the counter meets.
// Nothing else — the row of taps + cups + clients are the focus, the
// wall stays out of the way.
function drawIrishPubBack(ctx, ox = 0, oy = 0) {
  const W = BACK_W;
  const H = BACK_H;

  // Dark wood palette — noticeably darker than the customer-side wall.
  const wallM = 0x2a1408;
  const wallL = 0x3a1c0a;
  const wallD = 0x140804;
  const wallDeep = 0x080402;

  // Base fill
  fill(ctx, ox, oy, W, H, wallM);

  // Vertical panel seams every 60 px — darker line + thin lighter edge.
  for (let x = 0; x < W; x += 60) {
    fill(ctx, ox + x, oy, 2, H, wallD, 1);
    fill(ctx, ox + x + 2, oy, 1, H, wallL, 0.45);
  }

  // Brass rail along the very top — meets the underside of the bar strip.
  // Kept thin so it reads as a continuation of the bar, not a feature.
  fill(ctx, ox, oy, W, 3, wallDeep);
  fill(ctx, ox, oy + 3, W, 2, 0xa48030);
  fill(ctx, ox, oy + 3, W, 1, 0xffd040, 0.7);
  fill(ctx, ox, oy + 5, W, 2, wallD);

  // Subtle horizontal grain — a few faint darker bands across the wall,
  // every ~80 px. Reads as wood grain without being a visible feature.
  for (let y = 40; y < H - 30; y += 80) {
    fill(ctx, ox, oy + y, W, 1, wallDeep, 0.35);
    fill(ctx, ox, oy + y + 1, W, 1, wallL, 0.15);
  }

  // Light vignette at the top — very subtle warm spill from the bar overhead.
  for (let y = 6; y < 60; y += 2) {
    const t = (y - 6) / 54;
    fill(ctx, ox, oy + y, W, 2, 0xffaa40, (1 - t) * 0.05);
  }

  // Soft bottom-edge shadow where the counter starts.
  for (let y = H - 16; y < H; y++) {
    const t = (y - (H - 16)) / 16;
    fill(ctx, ox, oy + y, W, 1, 0x000000, t * 0.45);
  }
}

// Old busy back-bar kept around as reference; not used.
// Removing it would let the dead helpers (drawShelfPlank etc.) be pruned too.
function drawIrishPubBack_OLD_BUSY(ctx, ox = 0, oy = 0) {
  const W = BACK_W;
  const H = BACK_H;

  const wallM = 0x4a2818;
  const wallL = 0x6a3a24;
  const wallD = 0x2a1408;
  const wallDeep = 0x1a0a04;

  // Wall fill + vertical panel seams (same pattern as customer side)
  fill(ctx, ox, oy, W, H, wallM);
  for (let x = 0; x < W; x += 60) {
    fill(ctx, ox + x, oy, 2, H, wallD, 1);
    fill(ctx, ox + x + 2, oy, 1, H, wallL, 0.6);
  }

  // Brass rail along the very top — meets the underside of the bar strip
  fill(ctx, ox, oy, W, 4, wallDeep);
  fill(ctx, ox, oy + 4, W, 3, 0xa48030);
  fill(ctx, ox, oy + 4, W, 1, 0xffd040, 0.85);
  fill(ctx, ox, oy + 7, W, 3, wallD);
  fill(ctx, ox, oy + 10, W, 1, wallL);

  // Warm amber spill from above (light coming over the bar) — top 80 px
  for (let y = 12; y < 80; y += 2) {
    const t = (y - 12) / 68;
    fill(ctx, ox, oy + y, W, 2, 0xffaa40, (1 - t) * 0.18);
  }

  // ---- BACK SHELVES ----
  // Four shelves stacked vertically, full-width across most of the wall.
  // Front-row shelves carry bottles; one row carries kegs.
  const shelfStartX = 60;
  const shelfEndX = W - 60;
  const shelfY1 = 80;   // top
  const shelfY2 = 180;  // middle (bottles)
  const shelfY3 = 280;  // kegs row
  const shelfY4 = 410;  // bottom bottles

  for (const sy of [shelfY1, shelfY2, shelfY3, shelfY4]) {
    drawShelfPlank(ctx, ox + shelfStartX - 16, oy + sy, shelfEndX - shelfStartX + 32);
  }

  // Bottles on shelf 1 (top)
  const types1 = [
    { w: 14, h: 38, body: 0x3a8a4a, neck: 0x2a6a3a, label: 0xfff4d6 },
    { w: 16, h: 34, body: 0x6a3a1a, neck: 0x4a2810, label: 0xc4a020 },
    { w: 12, h: 40, body: 0x4a3a8a, neck: 0x3a2a6a, label: 0xffffff },
    { w: 18, h: 32, body: 0x8a3a3a, neck: 0x6a2424, label: 0xffd040 },
    { w: 14, h: 36, body: 0x2a4a6a, neck: 0x1a3a5a, label: 0xfff4d6 },
    { w: 16, h: 38, body: 0x6a5a3a, neck: 0x4a3a24, label: 0xc4a020 },
  ];
  for (let bx = shelfStartX; bx < shelfEndX; bx += 38) {
    const t = types1[(bx) % types1.length];
    drawBottle(ctx, ox + bx + Math.floor((38 - t.w) / 2), oy + shelfY1 - t.h, t);
  }

  // Shelf 2 — different bottle row
  for (let bx = shelfStartX; bx < shelfEndX; bx += 38) {
    const t = types1[(bx + 3) % types1.length];
    drawBottle(ctx, ox + bx + Math.floor((38 - t.w) / 2), oy + shelfY2 - t.h, t);
  }

  // Shelf 3 — KEGS lying on their sides
  const kegColors = [0x8a5a30, 0x6a4828, 0x9c6a3c, 0x6a4030, 0xa47040];
  for (let kx = shelfStartX + 10; kx < shelfEndX; kx += 110) {
    drawKeg(ctx, ox + kx, oy + shelfY3 - 70, kegColors[(kx) % kegColors.length]);
  }

  // Shelf 4 (bottom) — taller bottles
  const types4 = [
    { w: 16, h: 50, body: 0x3a8a4a, neck: 0x2a6a3a, label: 0xfff4d6 },
    { w: 18, h: 46, body: 0x6a3a1a, neck: 0x4a2810, label: 0xc4a020 },
    { w: 14, h: 54, body: 0x4a3a8a, neck: 0x3a2a6a, label: 0xffffff },
    { w: 20, h: 44, body: 0x8a3a3a, neck: 0x6a2424, label: 0xffd040 },
    { w: 16, h: 48, body: 0x2a4a6a, neck: 0x1a3a5a, label: 0xfff4d6 },
  ];
  for (let bx = shelfStartX; bx < shelfEndX; bx += 44) {
    const t = types4[(bx + 5) % types4.length];
    drawBottle(ctx, ox + bx + Math.floor((44 - t.w) / 2), oy + shelfY4 - t.h, t);
  }

  // ---- BIG BREWERY MIRROR in the middle of the wall ----
  // Sits between shelves 2 and 3, framed in gold.
  const mirX = Math.floor(W / 2) - 250;
  const mirY = shelfY2 + 18;
  const mirW = 500;
  const mirH = 70;
  // Frame
  fill(ctx, ox + mirX - 8, oy + mirY - 8, mirW + 16, mirH + 16, 0xa48030);
  fill(ctx, ox + mirX - 8, oy + mirY - 8, mirW + 16, 4, 0xffd040, 0.85);
  fill(ctx, ox + mirX - 8, oy + mirY + mirH + 4, mirW + 16, 4, 0x6a4020);
  fill(ctx, ox + mirX - 8, oy + mirY - 8, 4, mirH + 16, 0xffd040, 0.7);
  fill(ctx, ox + mirX + mirW + 4, oy + mirY - 8, 4, mirH + 16, 0x6a4020);
  // Mirror surface — dark with subtle reflections
  fill(ctx, ox + mirX, oy + mirY, mirW, mirH, 0x2a3a4a);
  fill(ctx, ox + mirX, oy + mirY, mirW, 8, 0x4a5a6a);
  // Etched brewery text — a stylized "ALES & STOUT" rectangle banner
  const bannerW = 220;
  const bannerX = mirX + Math.floor((mirW - bannerW) / 2);
  const bannerY = mirY + 22;
  fill(ctx, ox + bannerX, oy + bannerY, bannerW, 26, 0xc4a020);
  fill(ctx, ox + bannerX, oy + bannerY, bannerW, 4, 0xffd040, 0.85);
  fill(ctx, ox + bannerX, oy + bannerY + 22, bannerW, 4, 0x6a4020);
  fill(ctx, ox + bannerX - 2, oy + bannerY, 2, 26, 0x6a4020);
  fill(ctx, ox + bannerX + bannerW, oy + bannerY, 2, 26, 0x6a4020);
  // Text rendered as canvas text (compact, readable)
  ctx.fillStyle = 'rgba(26,10,4,1)';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ALES & STOUT', ox + bannerX + bannerW / 2, oy + bannerY + 14);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Reflection streak on the mirror
  fill(ctx, ox + mirX + 30, oy + mirY + 4, 80, 2, 0xfff4d6, 0.25);
  fill(ctx, ox + mirX + 30, oy + mirY + 4, 30, 2, 0xfff4d6, 0.55);

  // ---- BREWERY POSTERS flanking the mirror ----
  // Left poster: green clover badge
  drawPoster(ctx, ox + mirX - 220, oy + mirY - 6, 110, 90, 0x2a8a3a, 'O\'MALLEY', '— SINCE 1842 —');
  // Right poster: red harp/badge
  drawPoster(ctx, ox + mirX + mirW + 110, oy + mirY - 6, 110, 90, 0xc4202a, 'GUINNESS', '— DUBLIN —');

  // ---- HANGING MUGS hooked along the bottom of shelf 1 ----
  for (let mx = shelfStartX + 60; mx < shelfEndX - 30; mx += 110) {
    drawHangingMug(ctx, ox + mx, oy + shelfY1 + 12);
  }

  // ---- DARTBOARD on the far right ----
  drawDartboard(ctx, ox + W - 130, oy + 50);

  // ---- Soft bottom-edge shadow where the counter starts ----
  for (let y = H - 14; y < H; y++) {
    const t = (y - (H - 14)) / 14;
    fill(ctx, ox, oy + y, W, 1, 0x000000, t * 0.4);
  }
}

function drawShelfPlank(ctx, x, y, w) {
  fill(ctx, x, y, w, 14, 0x3a2010);
  fill(ctx, x, y, w, 3, 0x5a3018, 1);
  fill(ctx, x, y + 1, w, 1, 0x7a4828, 0.8);
  fill(ctx, x, y + 12, w, 2, 0x1a0a04);
  fill(ctx, x, y + 11, w, 2, 0xa48030, 1);
  fill(ctx, x, y + 11, w, 1, 0xffd040, 0.7);
}

function drawBottle(ctx, x, y, t) {
  // Body
  fill(ctx, x, y, t.w, t.h, t.body);
  fill(ctx, x + 1, y + 4, 2, t.h - 8, lighten(t.body, 1.4), 0.7);
  fill(ctx, x + t.w - 2, y + 4, 1, t.h - 8, darken(t.body, 0.6), 0.8);
  // Neck
  const neckW = Math.max(3, Math.floor(t.w * 0.35));
  const neckX = x + Math.floor((t.w - neckW) / 2);
  fill(ctx, neckX, y - 10, neckW, 10, t.neck);
  fill(ctx, neckX, y - 10, 1, 10, lighten(t.neck, 1.3), 0.7);
  fill(ctx, neckX - 1, y - 12, neckW + 2, 2, 0x8a6010);
  // Label
  fill(ctx, x, y + 14, t.w, 8, t.label);
  fill(ctx, x, y + 14, t.w, 1, lighten(t.label, 1.1), 0.7);
  fill(ctx, x, y + 21, t.w, 1, darken(t.label, 0.6), 0.8);
  // Outline
  fill(ctx, x - 1, y, 1, t.h, 0x1a0a04);
  fill(ctx, x + t.w, y, 1, t.h, 0x1a0a04);
  fill(ctx, neckX - 1, y - 10, 1, 10, 0x1a0a04);
  fill(ctx, neckX + neckW, y - 10, 1, 10, 0x1a0a04);
}

function drawKeg(ctx, x, y, color) {
  const kw = 90;
  const kh = 60;
  // Body
  fill(ctx, x, y, kw, kh, color);
  fill(ctx, x, y, kw, 6, lighten(color, 1.3), 0.85);
  fill(ctx, x, y + kh - 6, kw, 6, darken(color, 0.55), 0.95);
  // Outline
  fill(ctx, x - 1, y, 1, kh, 0x1a0a04);
  fill(ctx, x + kw, y, 1, kh, 0x1a0a04);
  fill(ctx, x, y - 1, kw, 1, 0x1a0a04);
  fill(ctx, x, y + kh, kw, 1, 0x1a0a04);
  // Bands (metal rings)
  for (const by of [8, 24, 44]) {
    fill(ctx, x, y + by, kw, 4, 0x6a6a72);
    fill(ctx, x, y + by, kw, 1, 0xc4c4cc, 0.85);
    fill(ctx, x, y + by + 3, kw, 1, 0x2a2a2a, 0.85);
  }
  // Tap/spigot in the front center
  fill(ctx, x + Math.floor(kw / 2) - 4, y + 18, 8, 12, 0x4a3010);
  fill(ctx, x + Math.floor(kw / 2) - 5, y + 30, 10, 4, 0x4a3010);
  fill(ctx, x + Math.floor(kw / 2) - 1, y + 34, 2, 6, 0x6a4020);
  fill(ctx, x + Math.floor(kw / 2) - 4, y + 18, 1, 12, 0x8a5a30, 0.85);
  // End cap (a circle hint)
  fill(ctx, x + 6, y + 20, 12, 20, 0x4a3010);
  fill(ctx, x + 8, y + 22, 8, 16, darken(color, 0.55));
  fill(ctx, x + 8, y + 22, 8, 2, 0xc4c4cc, 0.4);
  fill(ctx, x + 6, y + 20, 1, 20, 0x1a0a04);
  fill(ctx, x + 18, y + 20, 1, 20, 0x1a0a04);
}

function drawPoster(ctx, x, y, w, h, badgeColor, line1, line2) {
  // Paper background
  fill(ctx, x, y, w, h, 0xe8d9a8);
  fill(ctx, x, y, w, 4, 0xfff4d6);
  fill(ctx, x, y + h - 4, w, 4, 0xc4b890);
  fill(ctx, x - 2, y, 2, h, 0x4a3010);
  fill(ctx, x + w, y, 2, h, 0x4a3010);
  fill(ctx, x, y - 2, w, 2, 0x4a3010);
  fill(ctx, x, y + h, w, 2, 0x4a3010);
  // Round badge in the upper portion
  const bx = x + Math.floor(w / 2) - 18;
  const by = y + 14;
  for (let dy = 0; dy < 36; dy++) {
    const t = Math.abs(dy - 17.5) / 17.5;
    const inset = Math.round(t * t * 8);
    fill(ctx, bx + inset, by + dy, 36 - inset * 2, 1, badgeColor);
  }
  fill(ctx, bx + 4, by + 4, 28, 8, lighten(badgeColor, 1.3), 0.65);
  // Text rows
  ctx.fillStyle = 'rgba(26,10,4,1)';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(line1, x + w / 2, y + 62);
  ctx.font = '9px monospace';
  ctx.fillText(line2, x + w / 2, y + 76);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawHangingMug(ctx, x, y) {
  // Hook
  fill(ctx, x + 9, y, 2, 6, 0x6a6a72);
  fill(ctx, x + 9, y, 1, 6, 0xc4c4cc, 0.85);
  fill(ctx, x + 8, y - 1, 4, 2, 0x6a6a72);
  // Mug body — hangs upside-down by the handle
  fill(ctx, x, y + 6, 20, 28, 0x6a4828);
  fill(ctx, x, y + 6, 20, 4, lighten(0x6a4828, 1.4), 0.75);
  fill(ctx, x + 16, y + 8, 3, 24, darken(0x6a4828, 0.6));
  // Handle (offset right)
  fill(ctx, x + 20, y + 12, 6, 4, 0x6a4828);
  fill(ctx, x + 24, y + 12, 2, 12, 0x6a4828);
  fill(ctx, x + 20, y + 22, 6, 4, 0x6a4828);
  // Outline
  fill(ctx, x - 1, y + 6, 1, 28, 0x1a0a04);
  fill(ctx, x + 20, y + 6, 1, 6, 0x1a0a04);
  fill(ctx, x + 25, y + 12, 1, 14, 0x1a0a04);
  fill(ctx, x + 20, y + 26, 1, 4, 0x1a0a04);
  fill(ctx, x, y + 5, 20, 1, 0x1a0a04);
  fill(ctx, x, y + 34, 20, 1, 0x1a0a04);
}

function drawDartboard(ctx, x, y) {
  const r = 38;
  const cx = x + r;
  const cy = y + r;
  // Outer ring (black)
  for (let dy = -r; dy <= r; dy++) {
    const span = Math.round(Math.sqrt(r * r - dy * dy));
    fill(ctx, cx - span, cy + dy, span * 2, 1, 0x1a1410);
  }
  // Wedge ring (alternating cream/dark)
  const r2 = r - 4;
  for (let dy = -r2; dy <= r2; dy++) {
    const span = Math.round(Math.sqrt(r2 * r2 - dy * dy));
    // 8 wedges
    for (let i = 0; i < 8; i++) {
      const start = -span + Math.floor((span * 2 * i) / 8);
      const end = -span + Math.floor((span * 2 * (i + 1)) / 8);
      fill(ctx, cx + start, cy + dy, end - start, 1, i % 2 === 0 ? 0xfff4d6 : 0x3a2418);
    }
  }
  // Inner ring (red/green target)
  const r3 = 16;
  for (let dy = -r3; dy <= r3; dy++) {
    const span = Math.round(Math.sqrt(r3 * r3 - dy * dy));
    fill(ctx, cx - span, cy + dy, span * 2, 1, 0xc4202a);
  }
  const r4 = 8;
  for (let dy = -r4; dy <= r4; dy++) {
    const span = Math.round(Math.sqrt(r4 * r4 - dy * dy));
    fill(ctx, cx - span, cy + dy, span * 2, 1, 0x2a8a3a);
  }
  // Bullseye
  fill(ctx, cx - 3, cy - 3, 6, 6, 0xc4202a);
  fill(ctx, cx - 2, cy - 2, 4, 4, 0xff4040);
  // 3 darts stuck in
  drawDart(ctx, cx + 8, cy - 6);
  drawDart(ctx, cx - 12, cy + 10);
  drawDart(ctx, cx + 4, cy + 16);
}

function drawDart(ctx, tipX, tipY) {
  // Shaft + flight
  fill(ctx, tipX - 2, tipY - 1, 14, 2, 0xc4c4cc);
  fill(ctx, tipX + 8, tipY - 4, 4, 8, 0xff4040);
  fill(ctx, tipX + 8, tipY - 4, 4, 1, 0xff8080);
  fill(ctx, tipX - 3, tipY, 1, 1, 0x6a6a72);
}

// Other levels — placeholder back-bars while we wait on full art.
function drawTODOBack(ctx, ox, oy) {
  drawIrishPubBack(ctx, ox, oy);
  fill(ctx, ox, oy + 6, BACK_W, 16, 0x000000, 0.5);
  ctx.fillStyle = 'rgba(255,212,64,1)';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('TODO — placeholder back-bar', ox + 20, oy + 18);
}

// ============================================================================
// REGISTRY — each entry has an id (folder name) + draw + drawBack functions.
// ============================================================================
export const BACKGROUNDS = [
  { id: 'level_1', label: 'Irish Pub',          draw: drawIrishPub, drawBack: drawIrishPubBack },
  { id: 'level_2', label: 'Mexican Cantina',    draw: drawTODO,     drawBack: drawTODOBack },
  { id: 'level_3', label: 'German Beer Hall',   draw: drawTODO,     drawBack: drawTODOBack },
  { id: 'level_4', label: 'Pirate Dive',        draw: drawTODO,     drawBack: drawTODOBack },
  { id: 'level_5', label: 'Sci-Fi Spaceport Bar', draw: drawTODO,   drawBack: drawTODOBack },
];

/** Texture key used at runtime for the upper customer-side background. */
export function bgTextureKey(id) {
  return `bg_${id}`;
}

/** Texture key for the back-bar wall (drawn behind the row of taps). */
export function bgBackTextureKey(id) {
  return `bg_back_${id}`;
}

/** Look up the background for a given 1-indexed level number. */
export function backgroundForLevel(level) {
  const idx = ((level - 1) % BACKGROUNDS.length + BACKGROUNDS.length) % BACKGROUNDS.length;
  return BACKGROUNDS[idx];
}
