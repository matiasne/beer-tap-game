// Shared low-level drawing helpers used by every per-character draw function
// in clientArchetypes.js. Pure canvas operations — no Phaser dependencies, so
// the offline atlas-builder script can call into them via node-canvas.

export const OUTLINE = 0x1a1410;
export const SHADOW_BG = 0x000000;

export function pxRect(ctx, x, y, w, h, color, alpha) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

export function rgba(color, alpha) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darken(color, factor) {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export function lighten(color, factor) {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * Returns per-state, per-frame pose offsets shared by most human-shaped
 * characters. State controls the mood (normal/antsy/furious/talking) and
 * frameIdx 0..5 controls the sub-frame within the state's loop.
 *
 *   bodyDY: vertical body offset (breathing / fidgeting / shaking)
 *   headDX: horizontal head offset (tilting toward a speaker, shaking)
 *   armSwingDX: how far the arms swing left/right (for walking)
 *   legPhase: -1..+1, used by walking to drive leg position
 *   tint: optional baked global multiply applied at the end of the frame
 */
export function getPoseForFrame(state, frameIdx) {
  let bodyDY = 0;
  let headDX = 0;
  let armSwingDX = 0;
  let legPhase = 0;
  let tint = null;

  if (state === 'idle') {
    // Slow ambient sway — 6 frames cycling through a smooth bob.
    const cycle = [0, -1, -2, -2, -1, 0];
    bodyDY = cycle[frameIdx % cycle.length];
  } else if (state === 'normal') {
    // Gentle breathing — 6-frame smooth in/out.
    const cycle = [0, -2, -4, -4, -2, 0];
    bodyDY = cycle[frameIdx % cycle.length];
  } else if (state === 'antsy') {
    // Faster, jitterier — alternating fidget.
    const cycle = [0, -4, 0, -4, 0, -4];
    const heads = [0, 3, 0, -3, 0, 3];
    bodyDY = cycle[frameIdx % cycle.length];
    headDX = heads[frameIdx % heads.length];
  } else if (state === 'furious') {
    // Hard shake — frame-by-frame zigzag.
    const cycle = [0, 4, -2, 4, -2, 4];
    const heads = [-6, 6, -6, 6, -4, 4];
    bodyDY = cycle[frameIdx % cycle.length];
    headDX = heads[frameIdx % heads.length];
    tint = { color: 0xff4a2a, alpha: 0.32 };
  } else if (state === 'talking_left') {
    headDX = -6;
    // Subtle bob while talking
    const cycle = [0, -1, -2, -1, 0, -1];
    bodyDY = cycle[frameIdx % cycle.length];
  } else if (state === 'talking_right') {
    headDX = 6;
    const cycle = [0, -1, -2, -1, 0, -1];
    bodyDY = cycle[frameIdx % cycle.length];
  } else if (state === 'walking') {
    // 6-frame walk cycle: legs swing back/forward in opposing phase to arms.
    // legPhase oscillates -1..+1 over 6 frames.
    const legCycle = [0, 0.7, 1, 0.7, 0, -0.7]; // not used yet — left for full-leg redraw
    legPhase = legCycle[frameIdx % legCycle.length];
    armSwingDX = legPhase * 5; // arms swing opposite legs
    // Slight head bob
    const bobCycle = [0, -2, -3, -2, 0, -2];
    bodyDY = bobCycle[frameIdx % bobCycle.length];
  }

  return { bodyDY, headDX, armSwingDX, legPhase, tint };
}

/**
 * Draw a soft ground shadow centered horizontally below the figure.
 * Width scales with how wide the body is at the waist.
 */
export function drawGroundShadow(ctx, ox, oy, cx, h, halfBodyW) {
  const shadowW = Math.round(halfBodyW * 2.4);
  pxRect(ctx, ox + cx - shadowW / 2, oy + h - 6, shadowW, 6, SHADOW_BG, 0.35);
  pxRect(ctx, ox + cx - shadowW / 4, oy + h - 8, shadowW / 2, 2, SHADOW_BG, 0.2);
}
