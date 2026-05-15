// Builds a single canvas-backed atlas with all client characters × states ×
// animation frames. Each frame is `FRAME_W` × `FRAME_H`, laid out left→right,
// top→bottom. Frame keys: `<characterId>_<state>_<frameIndex>` (e.g.
// `client_0_idle_0`). Phaser animations are registered separately, keyed
// `<characterId>_<state>`.
//
// Why generate at runtime instead of shipping a PNG: the game already ships
// zero external art assets and procedural generation lets every variant share
// the same drawing primitives (hair, accessory, eyes). When you're ready to
// hand-paint frames, you can replace this module by loading a PNG+JSON atlas
// with `this.load.atlas('clients', ...)` in BootScene.preload() — the rest of
// the code only depends on frame keys + animation keys, not on how the texture
// was built.

export const FRAME_W = 32;
export const FRAME_H = 44;

// Order matters: it defines the column layout in the generated atlas image.
// Each state has FRAMES_PER_STATE frames, looped as an animation.
export const STATES = ['idle', 'normal', 'antsy', 'furious', 'talking_left', 'talking_right'];
export const FRAMES_PER_STATE = 2;

// Per-state animation cadence (ms per frame) and whether it should loop.
export const STATE_ANIM = {
  idle: { frameRate: 2, repeat: -1 },
  normal: { frameRate: 3, repeat: -1 },
  antsy: { frameRate: 6, repeat: -1 },
  furious: { frameRate: 10, repeat: -1 },
  talking_left: { frameRate: 6, repeat: -1 },
  talking_right: { frameRate: 6, repeat: -1 },
};

// Common characters: drawn from the everyday queue at uniform random.
// hairStyle: 'parted' | 'swept' | 'messy' | 'flat'
// accessory: null | 'cap' | 'beanie' | 'bandana' | 'glasses'
export const COMMON_CHARACTERS = [
  { id: 'client_0', skin: 0xe8c39a, hair: 0x3a2418, shirt: 0xc33a3a, hairStyle: 'parted', accessory: null },
  { id: 'client_1', skin: 0xc99172, hair: 0x1a1a1a, shirt: 0x2a6acc, hairStyle: 'flat',   accessory: 'cap' },
  { id: 'client_2', skin: 0xf2d6b3, hair: 0xd9a64a, shirt: 0x2a8a3a, hairStyle: 'swept',  accessory: null },
  { id: 'client_3', skin: 0x9c6a4a, hair: 0x2a1a10, shirt: 0xd9a64a, hairStyle: 'messy',  accessory: 'bandana' },
  { id: 'client_4', skin: 0xe8c39a, hair: 0x5a3a24, shirt: 0x6a3aa8, hairStyle: 'parted', accessory: 'glasses' },
  { id: 'client_5', skin: 0xc99172, hair: 0xb84a24, shirt: 0x3a3a3a, hairStyle: 'messy',  accessory: 'beanie' },
];

// Special characters: rolled with low probability. Visual-only — they don't
// change gameplay (tip, patience, etc), only their look. `special: true`
// gates the spawn roll in clientSpriteSheet.pickCharacter().
export const SPECIAL_CHARACTERS = [
  { id: 'client_pirate', special: true, skin: 0xd9a878, hair: 0x1a1010, shirt: 0x8a1818, hairStyle: 'messy',  accessory: 'pirate' },
  { id: 'client_dandy',  special: true, skin: 0xf2d6b3, hair: 0x3a2418, shirt: 0x2a1a40, hairStyle: 'parted', accessory: 'tophat' },
  { id: 'client_punk',   special: true, skin: 0xc99172, hair: 0xff2a6a, shirt: 0x1a1a1a, hairStyle: 'mohawk', accessory: 'shades' },
];

export const ALL_CHARACTERS = [...COMMON_CHARACTERS, ...SPECIAL_CHARACTERS];

// Probability that a newly-spawned client is a special one. Per-spawn roll.
const SPECIAL_SPAWN_CHANCE = 0.1;

/** Returns a character config to use for a new client. */
export function pickCharacter() {
  if (Math.random() < SPECIAL_SPAWN_CHANCE) {
    return SPECIAL_CHARACTERS[Math.floor(Math.random() * SPECIAL_CHARACTERS.length)];
  }
  return COMMON_CHARACTERS[Math.floor(Math.random() * COMMON_CHARACTERS.length)];
}

/** Frame name as stored in the atlas. */
export function frameName(charId, state, frameIndex) {
  return `${charId}_${state}_${frameIndex}`;
}

/** Animation key (one per character × state). */
export function animKey(charId, state) {
  return `${charId}_${state}`;
}

/**
 * Build the full atlas as a single offscreen canvas + frame index, then
 * register it with Phaser. Call once from BootScene.create().
 *
 * Layout: one row per character, one column-pair per state. So for state s
 * (0..STATES.length-1) and frame f (0..FRAMES_PER_STATE-1), the frame sits at
 * (col = s*FRAMES_PER_STATE + f, row = characterIndex).
 */
export function buildClientAtlas(scene) {
  // Preferred path: the PNG+JSON atlas was loaded in BootScene.preload(). In
  // that case the texture already exists with all frames defined — we just
  // need to register the animations.
  if (atlasIsFullyLoaded(scene)) {
    registerAnimations(scene);
    return;
  }

  // Fallback path: draw the whole atlas to an in-memory canvas. Used when
  // sprites/clients.png is missing (no `npm run sprites` yet, dist removed,
  // etc) so the game still runs.
  const cols = STATES.length * FRAMES_PER_STATE;
  const rows = ALL_CHARACTERS.length;
  const canvas = document.createElement('canvas');
  canvas.width = cols * FRAME_W;
  canvas.height = rows * FRAME_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ALL_CHARACTERS.forEach((char, rowIdx) => {
    STATES.forEach((state, stateIdx) => {
      for (let f = 0; f < FRAMES_PER_STATE; f++) {
        const col = stateIdx * FRAMES_PER_STATE + f;
        const x = col * FRAME_W;
        const y = rowIdx * FRAME_H;
        drawClientFrame(ctx, x, y, char, state, f);
      }
    });
  });

  if (scene.textures.exists('clients_atlas')) {
    scene.textures.remove('clients_atlas');
  }
  const texture = scene.textures.addCanvas('clients_atlas', canvas);
  ALL_CHARACTERS.forEach((char, rowIdx) => {
    STATES.forEach((state, stateIdx) => {
      for (let f = 0; f < FRAMES_PER_STATE; f++) {
        const col = stateIdx * FRAMES_PER_STATE + f;
        const x = col * FRAME_W;
        const y = rowIdx * FRAME_H;
        texture.add(frameName(char.id, state, f), 0, x, y, FRAME_W, FRAME_H);
      }
    });
  });

  registerAnimations(scene);
}

/**
 * True if `clients_atlas` was loaded from the PNG+JSON and has at least the
 * frames we expect (sanity-check one frame per character). If load failed
 * silently — e.g. 404 on the PNG — Phaser still creates a stub texture, but
 * without our named frames; this check catches that and triggers the
 * procedural fallback.
 */
function atlasIsFullyLoaded(scene) {
  if (!scene.textures.exists('clients_atlas')) return false;
  const tex = scene.textures.get('clients_atlas');
  return ALL_CHARACTERS.every((char) => tex.has(frameName(char.id, 'normal', 0)));
}

/** Register Phaser animations for every character × state. Idempotent. */
function registerAnimations(scene) {
  ALL_CHARACTERS.forEach((char) => {
    STATES.forEach((state) => {
      const key = animKey(char.id, state);
      if (scene.anims.exists(key)) return;
      const frames = [];
      for (let f = 0; f < FRAMES_PER_STATE; f++) {
        frames.push({ key: 'clients_atlas', frame: frameName(char.id, state, f) });
      }
      const cadence = STATE_ANIM[state];
      scene.anims.create({
        key,
        frames,
        frameRate: cadence.frameRate,
        repeat: cadence.repeat,
      });
    });
  });
}

// =============================================================================
// Drawing — everything below is pure 2D canvas, drawing one 32×44 frame at a
// time onto the shared atlas canvas at offset (ox, oy). State + frame index
// drive the per-state variations (mouth open/closed, head tilt, eyebrow shape,
// body bob).
// =============================================================================

// Exported so the offline `scripts/build-sprite-sheet.js` Node script can
// render the atlas to a real PNG using node-canvas. Browser code goes through
// buildClientAtlas() above; the drawing function itself is identical.
export function drawClientFrame(ctx, ox, oy, char, state, frameIdx) {
  const { skin, hair, shirt, hairStyle, accessory } = char;
  const shirtDark = darken(shirt, 0.7);
  const shirtDarker = darken(shirt, 0.5);
  const shirtLight = lighten(shirt, 1.2);
  const skinShadow = darken(skin, 0.8);
  const skinHighlight = lighten(skin, 1.08);
  const hairLight = lighten(hair, 1.25);
  const hairDark = darken(hair, 0.7);

  // Per-state pose modifiers. headDX shifts the head sideways, bodyDY shifts
  // body + arms vertically (breathing/fidgeting). These are small (±1 px) so
  // the silhouette stays readable.
  let headDX = 0;
  let bodyDY = 0;
  let bakedTint = null; // optional global multiply at the end (for furious red).

  if (state === 'normal') {
    bodyDY = frameIdx === 0 ? 0 : -1; // gentle breathing
  } else if (state === 'antsy') {
    bodyDY = frameIdx === 0 ? 0 : -1;
    headDX = frameIdx === 0 ? 0 : 1;  // tiny head fidget
  } else if (state === 'furious') {
    bodyDY = frameIdx === 0 ? 0 : 1;  // angry shake (down-up)
    headDX = frameIdx === 0 ? -1 : 1; // big shake side to side
    bakedTint = { color: 0xff4a2a, alpha: 0.35 };
  } else if (state === 'talking_left') {
    headDX = -1;
  } else if (state === 'talking_right') {
    headDX = 1;
  }

  const w = FRAME_W;
  const h = FRAME_H;

  // Ground shadow under the torso — slightly more spread when bodyDY < 0
  // (suggests body lift).
  pxRect(ctx, ox + 5, oy + h - 1, w - 10, 1, 0x000000, 0.35);

  // Torso (with arms) — top of torso shifts by bodyDY.
  const torsoTop = 21 + bodyDY;
  pxRect(ctx, ox + 6, oy + torsoTop, w - 12, h - torsoTop, shirt, 1);
  pxRect(ctx, ox + 7, oy + torsoTop, w - 14, 1, shirtLight, 1);
  pxRect(ctx, ox + 7, oy + torsoTop + 1, 4, 1, shirtLight, 1);
  pxRect(ctx, ox + 6, oy + torsoTop, 1, h - torsoTop, shirtDark, 1);
  pxRect(ctx, ox + w - 7, oy + torsoTop, 1, h - torsoTop, shirtDark, 1);
  if ((shirt & 1) === 1) {
    pxRect(ctx, ox + 11, oy + torsoTop + 2, 1, h - torsoTop - 3, shirtDarker, 0.6);
    pxRect(ctx, ox + w - 12, oy + torsoTop + 2, 1, h - torsoTop - 3, shirtDarker, 0.6);
  }
  // Placket + buttons + collar
  const cx = w / 2;
  pxRect(ctx, ox + cx - 1, oy + torsoTop + 3, 2, h - torsoTop - 3, shirtDark, 1);
  pxRect(ctx, ox + cx, oy + torsoTop + 5, 1, 1, shirtLight, 1);
  pxRect(ctx, ox + cx, oy + torsoTop + 11, 1, 1, shirtLight, 1);
  pxRect(ctx, ox + cx, oy + torsoTop + 17, 1, 1, shirtLight, 1);
  pxRect(ctx, ox + cx - 3, oy + torsoTop, 6, 3, shirtDark, 1);
  pxRect(ctx, ox + cx - 2, oy + torsoTop + 1, 4, 1, shirtDarker, 1);
  pxRect(ctx, ox + cx - 1, oy + torsoTop + 2, 2, 1, shirtDarker, 1);

  // Arms + hands — same vertical shift as torso.
  const armTop = torsoTop + 3;
  const armBot = h - 6;
  pxRect(ctx, ox + 2, oy + armTop, 4, armBot - armTop, shirt, 1);
  pxRect(ctx, ox + w - 6, oy + armTop, 4, armBot - armTop, shirt, 1);
  pxRect(ctx, ox + 2, oy + armTop, 1, armBot - armTop, shirtLight, 1);
  pxRect(ctx, ox + w - 6, oy + armTop, 1, armBot - armTop, shirtLight, 1);
  pxRect(ctx, ox + 5, oy + armTop, 1, armBot - armTop, shirtDark, 1);
  pxRect(ctx, ox + w - 3, oy + armTop, 1, armBot - armTop, shirtDark, 1);
  pxRect(ctx, ox + 2, oy + armBot - 2, 4, 1, shirtLight, 1);
  pxRect(ctx, ox + w - 6, oy + armBot - 2, 4, 1, shirtLight, 1);
  pxRect(ctx, ox + 2, oy + armBot - 1, 4, 1, shirtDark, 1);
  pxRect(ctx, ox + w - 6, oy + armBot - 1, 4, 1, shirtDark, 1);
  pxRect(ctx, ox + 2, oy + armBot, 4, 3, skin, 1);
  pxRect(ctx, ox + w - 6, oy + armBot, 4, 3, skin, 1);
  pxRect(ctx, ox + 3, oy + armBot + 1, 1, 1, skinShadow, 1);
  pxRect(ctx, ox + 5, oy + armBot + 1, 1, 1, skinShadow, 1);
  pxRect(ctx, ox + w - 5, oy + armBot + 1, 1, 1, skinShadow, 1);
  pxRect(ctx, ox + w - 3, oy + armBot + 1, 1, 1, skinShadow, 1);

  // Neck — also follows the body's vertical drift, but only by half so the
  // head feels anchored on the torso.
  const neckTop = 17 + bodyDY;
  pxRect(ctx, ox + cx - 3, oy + neckTop, 6, 4, skin, 1);
  pxRect(ctx, ox + cx - 3, oy + neckTop + 3, 6, 1, skinShadow, 1);
  pxRect(ctx, ox + cx + 1, oy + neckTop, 2, 3, skinShadow, 1);

  // Head — applies headDX so it can tilt left/right.
  const headX = cx - 6 + headDX;
  const headY = 4 + bodyDY;
  const headW = 12;
  const headH = 12;
  pxRect(ctx, ox + headX, oy + headY, headW, headH, skin, 1);
  // Chamfered corners — overpaint with background tone so silhouette reads round.
  pxRect(ctx, ox + headX, oy + headY, 1, 1, 0x1a1612, 1);
  pxRect(ctx, ox + headX + headW - 1, oy + headY, 1, 1, 0x1a1612, 1);
  pxRect(ctx, ox + headX, oy + headY + headH - 1, 1, 1, 0x1a1612, 1);
  pxRect(ctx, ox + headX + headW - 1, oy + headY + headH - 1, 1, 1, 0x1a1612, 1);
  pxRect(ctx, ox + headX + headW - 2, oy + headY + 1, 1, headH - 2, skinShadow, 1);
  pxRect(ctx, ox + headX + 1, oy + headY + headH - 2, headW - 2, 1, skinShadow, 1);
  pxRect(ctx, ox + headX + 2, oy + headY + 5, 1, 3, skinHighlight, 1);
  pxRect(ctx, ox + headX + 3, oy + headY + 2, 4, 1, skinHighlight, 0.5);

  // Ears
  pxRect(ctx, ox + headX - 1, oy + headY + 5, 1, 3, skin, 1);
  pxRect(ctx, ox + headX + headW, oy + headY + 5, 1, 3, skin, 1);
  pxRect(ctx, ox + headX - 1, oy + headY + 7, 1, 1, skinShadow, 1);
  pxRect(ctx, ox + headX + headW, oy + headY + 7, 1, 1, skinShadow, 1);

  // Hair (style varies per-variant; mohawk is special-only).
  drawHair(ctx, ox, oy, hairStyle, hair, hairLight, hairDark, headX, headY, headW);

  // Eyebrows — angle depends on mood. Calm/normal/idle = level. Antsy =
  // worried (inner ends down). Furious = angry V (inner ends down hard).
  // Talking states reuse the calm brow.
  drawEyebrows(ctx, ox, oy, headX, headY, headW, hairDark, state);

  // Eyes — sclera + pupil + catchlight. Furious has narrowed eyes.
  drawEyes(ctx, ox, oy, headX, headY, headW, state);

  // Nose — same in all states.
  pxRect(ctx, ox + headX + 5, oy + headY + 7, 2, 2, skinShadow, 1);
  pxRect(ctx, ox + headX + 5, oy + headY + 7, 1, 1, skinHighlight, 0.6);

  // Mouth — state-dependent shape, and (for talking states) toggled by frameIdx.
  drawMouth(ctx, ox, oy, headX, headY, headW, state, frameIdx);

  // Accessory on top of hair/head.
  drawAccessory(ctx, ox, oy, accessory, headX, headY, headW);

  // Baked global tint (used by furious to pre-pulse the red).
  if (bakedTint) {
    pxRect(ctx, ox, oy, w, h, bakedTint.color, bakedTint.alpha);
  }
}

// ----------------- per-feature drawers -------------------

function drawHair(ctx, ox, oy, style, hair, hairLight, hairDark, headX, headY, headW) {
  if (style === 'mohawk') {
    // Shaved sides + tall central strip — punk character.
    pxRect(ctx, ox + headX, oy + headY + 1, headW, 2, hairDark, 1); // dark stubble band
    const stripX = headX + Math.floor(headW / 2) - 1;
    pxRect(ctx, ox + stripX, oy + headY - 4, 2, 6, hair, 1);
    pxRect(ctx, ox + stripX, oy + headY - 4, 1, 6, hairLight, 1);
    pxRect(ctx, ox + stripX + 1, oy + headY - 2, 1, 4, hairDark, 1);
    return;
  }
  // Default cap covering top of head + sideburns.
  pxRect(ctx, ox + headX, oy + headY - 1, headW, 5, hair, 1);
  pxRect(ctx, ox + headX - 1, oy + headY + 1, 1, 4, hair, 1);
  pxRect(ctx, ox + headX + headW, oy + headY + 1, 1, 4, hair, 1);

  if (style === 'parted') {
    pxRect(ctx, ox + headX + headW / 2, oy + headY + 3, headW / 2 - 1, 1, hairDark, 1);
    pxRect(ctx, ox + headX + 1, oy + headY - 1, headW / 2 - 1, 1, hairLight, 1);
    pxRect(ctx, ox + headX + 2, oy + headY, 2, 1, hairLight, 1);
  } else if (style === 'swept') {
    pxRect(ctx, ox + headX + 1, oy + headY + 3, 3, 1, hair, 1);
    pxRect(ctx, ox + headX + 1, oy + headY - 1, headW - 4, 1, hairLight, 1);
    pxRect(ctx, ox + headX + 2, oy + headY, 4, 1, hairLight, 1);
  } else if (style === 'messy') {
    pxRect(ctx, ox + headX, oy + headY - 2, 1, 1, hair, 1);
    pxRect(ctx, ox + headX + 2, oy + headY - 2, 1, 1, hair, 1);
    pxRect(ctx, ox + headX + 5, oy + headY - 2, 1, 1, hair, 1);
    pxRect(ctx, ox + headX + 7, oy + headY - 2, 1, 1, hair, 1);
    pxRect(ctx, ox + headX + headW - 2, oy + headY - 2, 1, 1, hair, 1);
    pxRect(ctx, ox + headX + 1, oy + headY - 1, 2, 1, hairLight, 1);
    pxRect(ctx, ox + headX + 6, oy + headY - 1, 3, 1, hairLight, 1);
  } else if (style === 'flat') {
    pxRect(ctx, ox + headX, oy + headY + 3, headW, 1, hairDark, 1);
    pxRect(ctx, ox + headX, oy + headY - 1, headW, 4, hair, 1);
  } else {
    pxRect(ctx, ox + headX + 2, oy + headY - 1, headW - 4, 1, hairLight, 1);
  }
}

function drawEyebrows(ctx, ox, oy, headX, headY, headW, color, state) {
  const lx = headX + 2;
  const rx = headX + headW - 4;
  const y = headY + 5;
  if (state === 'furious') {
    // Inner-low angry V — inner pixels drop a row, outer pixels stay.
    pxRect(ctx, ox + lx, oy + y, 1, 1, color, 1);
    pxRect(ctx, ox + lx + 1, oy + y + 1, 1, 1, color, 1);
    pxRect(ctx, ox + rx + 1, oy + y, 1, 1, color, 1);
    pxRect(ctx, ox + rx, oy + y + 1, 1, 1, color, 1);
  } else if (state === 'antsy') {
    // Slight worried angle — inner ends drop just one pixel, outer stays.
    pxRect(ctx, ox + lx, oy + y, 2, 1, color, 1);
    pxRect(ctx, ox + lx + 1, oy + y + 1, 1, 1, color, 1);
    pxRect(ctx, ox + rx, oy + y, 2, 1, color, 1);
    pxRect(ctx, ox + rx, oy + y + 1, 1, 1, color, 1);
  } else {
    pxRect(ctx, ox + lx, oy + y, 2, 1, color, 1);
    pxRect(ctx, ox + rx, oy + y, 2, 1, color, 1);
  }
}

function drawEyes(ctx, ox, oy, headX, headY, headW, state) {
  const lx = headX + 2;
  const rx = headX + headW - 5;
  const ey = headY + 6;
  if (state === 'furious') {
    // Narrowed — only 1 row of sclera visible, pupil tight.
    pxRect(ctx, ox + lx, oy + ey + 1, 3, 1, 0xfff4d6, 1);
    pxRect(ctx, ox + rx, oy + ey + 1, 3, 1, 0xfff4d6, 1);
    pxRect(ctx, ox + lx + 1, oy + ey + 1, 1, 1, 0x1a1a1a, 1);
    pxRect(ctx, ox + rx + 1, oy + ey + 1, 1, 1, 0x1a1a1a, 1);
  } else {
    pxRect(ctx, ox + lx, oy + ey, 3, 2, 0xfff4d6, 1);
    pxRect(ctx, ox + rx, oy + ey, 3, 2, 0xfff4d6, 1);
    pxRect(ctx, ox + lx + 1, oy + ey, 1, 2, 0x1a1a1a, 1);
    pxRect(ctx, ox + rx + 1, oy + ey, 1, 2, 0x1a1a1a, 1);
    // catchlight
    pxRect(ctx, ox + lx + 1, oy + ey, 1, 1, 0xffffff, 1);
    pxRect(ctx, ox + rx + 1, oy + ey, 1, 1, 0xffffff, 1);
  }
}

function drawMouth(ctx, ox, oy, headX, headY, headW, state, frameIdx) {
  const my = headY + 10;
  const baseX = headX + 4;
  if (state === 'furious') {
    // Bared-teeth snarl — wider, with two dark gaps.
    pxRect(ctx, ox + baseX - 1, oy + my, 5, 2, 0x4a1a10, 1);
    pxRect(ctx, ox + baseX, oy + my, 1, 1, 0xfff4d6, 1);
    pxRect(ctx, ox + baseX + 2, oy + my, 1, 1, 0xfff4d6, 1);
  } else if (state === 'antsy') {
    pxRect(ctx, ox + baseX, oy + my, 3, 1, 0x4a2a1a, 1); // flat worried line
  } else if (state === 'talking_left' || state === 'talking_right') {
    if (frameIdx === 0) {
      // Closed
      pxRect(ctx, ox + baseX, oy + my, 3, 1, 0x4a2a1a, 1);
    } else {
      // Open — 3×2 dark oval suggesting an "o" shape mid-sentence.
      pxRect(ctx, ox + baseX, oy + my, 3, 2, 0x2a1410, 1);
      pxRect(ctx, ox + baseX + 1, oy + my + 1, 1, 1, 0x6a3a28, 1);
    }
  } else {
    // idle / normal — neutral smirk (current art).
    pxRect(ctx, ox + baseX, oy + my, 3, 1, 0x4a2a1a, 1);
    pxRect(ctx, ox + baseX, oy + my, 1, 1, 0x2a1a10, 1);
  }
}

function drawAccessory(ctx, ox, oy, accessory, headX, headY, headW) {
  if (!accessory) return;

  if (accessory === 'cap') {
    pxRect(ctx, ox + headX, oy + headY - 2, headW, 5, 0x2a2a2a, 1);
    pxRect(ctx, ox + headX - 1, oy + headY, 1, 3, 0x2a2a2a, 1);
    pxRect(ctx, ox + headX + 1, oy + headY - 2, headW - 3, 1, 0x4a4a4a, 1);
    pxRect(ctx, ox + headX + 2, oy + headY - 1, 3, 1, 0x4a4a4a, 1);
    pxRect(ctx, ox + headX - 4, oy + headY + 3, 8, 2, 0x2a2a2a, 1);
    pxRect(ctx, ox + headX - 4, oy + headY + 3, 1, 1, 0x4a4a4a, 1);
    pxRect(ctx, ox + headX - 4, oy + headY + 4, 8, 1, 0x1a1a1a, 1);
    pxRect(ctx, ox + headX + 2, oy + headY, 2, 2, 0xc33a3a, 1);
    pxRect(ctx, ox + headX + 2, oy + headY, 1, 1, 0xffffff, 1);
  } else if (accessory === 'beanie') {
    pxRect(ctx, ox + headX, oy + headY - 3, headW, 7, 0x6a3a2a, 1);
    pxRect(ctx, ox + headX - 1, oy + headY - 1, 1, 5, 0x6a3a2a, 1);
    pxRect(ctx, ox + headX + headW, oy + headY - 1, 1, 5, 0x6a3a2a, 1);
    for (let i = 0; i < headW; i += 3) {
      pxRect(ctx, ox + headX + i, oy + headY - 2, 1, 5, 0x4a2418, 0.5);
    }
    pxRect(ctx, ox + headX + 1, oy + headY - 3, headW - 3, 1, 0x8a5a3a, 1);
    pxRect(ctx, ox + headX, oy + headY - 2, 1, 1, 0x8a5a3a, 1);
    pxRect(ctx, ox + headX, oy + headY + 4, headW, 1, 0x4a2418, 1);
    pxRect(ctx, ox + headX, oy + headY + 3, headW, 1, 0x6a3a2a, 1);
    pxRect(ctx, ox + headX + 1, oy + headY + 3, headW - 2, 1, 0x8a5a3a, 1);
    const pomX = headX + headW / 2 - 1;
    pxRect(ctx, ox + pomX, oy + headY - 5, 2, 2, 0xe8d9a8, 1);
    pxRect(ctx, ox + pomX + 1, oy + headY - 4, 1, 1, 0xa28960, 1);
    pxRect(ctx, ox + pomX, oy + headY - 5, 1, 1, 0xffffff, 1);
  } else if (accessory === 'bandana') {
    pxRect(ctx, ox + headX, oy + headY + 3, headW, 3, 0xc33a3a, 1);
    pxRect(ctx, ox + headX, oy + headY + 3, headW, 1, 0xe85a5a, 1);
    pxRect(ctx, ox + headX, oy + headY + 5, headW, 1, 0x8a1a1a, 1);
    pxRect(ctx, ox + headX + 2, oy + headY + 4, 1, 1, 0xe85a5a, 0.9);
    pxRect(ctx, ox + headX + 6, oy + headY + 4, 1, 1, 0xe85a5a, 0.9);
    pxRect(ctx, ox + headX + 10, oy + headY + 4, 1, 1, 0xe85a5a, 0.9);
    pxRect(ctx, ox + headX + headW, oy + headY + 4, 2, 2, 0xc33a3a, 1);
    pxRect(ctx, ox + headX + headW + 1, oy + headY + 6, 1, 3, 0xc33a3a, 1);
    pxRect(ctx, ox + headX + headW + 1, oy + headY + 8, 1, 1, 0x8a1a1a, 1);
    pxRect(ctx, ox + headX + headW, oy + headY + 4, 1, 1, 0xe85a5a, 1);
  } else if (accessory === 'glasses') {
    const lx = headX + 1;
    const ly = headY + 5;
    pxRect(ctx, ox + lx, oy + ly, 5, 1, 0x1a1a10, 1);
    pxRect(ctx, ox + lx, oy + ly + 3, 5, 1, 0x1a1a10, 1);
    pxRect(ctx, ox + lx, oy + ly + 1, 1, 2, 0x1a1a10, 1);
    pxRect(ctx, ox + lx + 4, oy + ly + 1, 1, 2, 0x1a1a10, 1);
    const rx = headX + headW - 6;
    pxRect(ctx, ox + rx, oy + ly, 5, 1, 0x1a1a10, 1);
    pxRect(ctx, ox + rx, oy + ly + 3, 5, 1, 0x1a1a10, 1);
    pxRect(ctx, ox + rx, oy + ly + 1, 1, 2, 0x1a1a10, 1);
    pxRect(ctx, ox + rx + 4, oy + ly + 1, 1, 2, 0x1a1a10, 1);
    pxRect(ctx, ox + lx + 5, oy + ly + 1, rx - lx - 5, 1, 0x1a1a10, 1);
    pxRect(ctx, ox + lx + 1, oy + ly, 3, 1, 0x8a8a8a, 0.5);
    pxRect(ctx, ox + rx + 1, oy + ly, 3, 1, 0x8a8a8a, 0.5);
    pxRect(ctx, ox + lx + 3, oy + ly + 1, 1, 1, 0xffffff, 0.9);
    pxRect(ctx, ox + rx + 3, oy + ly + 1, 1, 1, 0xffffff, 0.9);
  } else if (accessory === 'pirate') {
    // Bandana wrap + eyepatch over the left eye, with a knotted tail on the
    // right side of the head.
    pxRect(ctx, ox + headX - 1, oy + headY + 2, headW + 2, 3, 0x2a2018, 1); // bandana
    pxRect(ctx, ox + headX, oy + headY + 2, headW, 1, 0x4a3828, 1); // top highlight
    // Skull-and-cross dot pattern (tiny white pixel for flavor)
    pxRect(ctx, ox + headX + 3, oy + headY + 3, 1, 1, 0xfff4d6, 0.9);
    pxRect(ctx, ox + headX + 8, oy + headY + 3, 1, 1, 0xfff4d6, 0.9);
    // Knot tail on the right
    pxRect(ctx, ox + headX + headW, oy + headY + 3, 2, 2, 0x2a2018, 1);
    pxRect(ctx, ox + headX + headW + 1, oy + headY + 5, 1, 3, 0x2a2018, 1);
    // Eyepatch on the left eye — covers eye + ear-strap line.
    pxRect(ctx, ox + headX + 1, oy + headY + 6, 4, 2, 0x0a0a0a, 1);
    pxRect(ctx, ox + headX + 1, oy + headY + 5, 1, 1, 0x0a0a0a, 1);
    pxRect(ctx, ox + headX, oy + headY + 5, 1, 1, 0x1a1a1a, 1);
    pxRect(ctx, ox + headX + 4, oy + headY + 5, 1, 1, 0x1a1a1a, 1);
  } else if (accessory === 'tophat') {
    // Tall black hat with a band — extends above the head by 5 px.
    pxRect(ctx, ox + headX - 2, oy + headY - 1, headW + 4, 1, 0x0a0a0a, 1); // brim
    pxRect(ctx, ox + headX - 1, oy + headY - 2, headW + 2, 1, 0x1a1a1a, 1); // brim top edge
    pxRect(ctx, ox + headX + 1, oy + headY - 7, headW - 2, 5, 0x0a0a0a, 1); // crown
    pxRect(ctx, ox + headX + 1, oy + headY - 3, headW - 2, 1, 0x6a3a2a, 1); // band
    pxRect(ctx, ox + headX + 2, oy + headY - 7, headW - 5, 1, 0x4a4a4a, 1); // highlight strip
    // Monocle on the right eye — a metal ring with a tiny chain.
    const mx = headX + headW - 5;
    const my2 = headY + 5;
    pxRect(ctx, ox + mx, oy + my2, 5, 1, 0xc4c4cc, 1);
    pxRect(ctx, ox + mx, oy + my2 + 3, 5, 1, 0xc4c4cc, 1);
    pxRect(ctx, ox + mx, oy + my2 + 1, 1, 2, 0xc4c4cc, 1);
    pxRect(ctx, ox + mx + 4, oy + my2 + 1, 1, 2, 0xc4c4cc, 1);
    pxRect(ctx, ox + mx + 4, oy + my2 + 4, 1, 3, 0xc4c4cc, 1); // chain dropping down
  } else if (accessory === 'shades') {
    // Wraparound sunglasses — a single dark bar across both eyes.
    pxRect(ctx, ox + headX + 1, oy + headY + 5, headW - 2, 2, 0x0a0a0a, 1);
    pxRect(ctx, ox + headX + 1, oy + headY + 5, headW - 2, 1, 0x2a2a2a, 1); // top edge
    pxRect(ctx, ox + headX + 3, oy + headY + 6, 1, 1, 0xff4a8a, 1); // neon glint
    pxRect(ctx, ox + headX + headW - 4, oy + headY + 6, 1, 1, 0xff4a8a, 1);
  }
}

// ----------------- canvas helpers -------------------

function pxRect(ctx, x, y, w, h, color, alpha) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function rgba(color, alpha) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
