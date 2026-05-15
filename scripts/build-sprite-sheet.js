// Renders the client sprite sheet to a real PNG + Phaser atlas JSON.
// Run: `node scripts/build-sprite-sheet.js`. Outputs to public/sprites/.
//
// The drawing logic lives in src/clientSpriteSheet.js so the browser path and
// the offline export draw pixel-identical frames. This script just runs that
// drawing into a node-canvas context, then serialises the result to disk.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_CHARACTERS,
  STATES,
  FRAMES_PER_STATE,
  FRAME_W,
  FRAME_H,
  drawClientFrame,
  frameName,
} from '../src/clientSpriteSheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'sprites');
const PNG_PATH = resolve(OUT_DIR, 'clients.png');
const JSON_PATH = resolve(OUT_DIR, 'clients.json');

const cols = STATES.length * FRAMES_PER_STATE;
const rows = ALL_CHARACTERS.length;
const W = cols * FRAME_W;
const H = rows * FRAME_H;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const frames = {};
ALL_CHARACTERS.forEach((char, rowIdx) => {
  STATES.forEach((state, stateIdx) => {
    for (let f = 0; f < FRAMES_PER_STATE; f++) {
      const col = stateIdx * FRAMES_PER_STATE + f;
      const x = col * FRAME_W;
      const y = rowIdx * FRAME_H;
      drawClientFrame(ctx, x, y, char, state, f);
      // Phaser hash atlas entry — frame rect + source size (no trimming).
      frames[frameName(char.id, state, f)] = {
        frame: { x, y, w: FRAME_W, h: FRAME_H },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        sourceSize: { w: FRAME_W, h: FRAME_H },
      };
    }
  });
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(PNG_PATH, canvas.toBuffer('image/png'));

const atlas = {
  frames,
  meta: {
    app: 'beer-tap-game/build-sprite-sheet',
    version: '1.0',
    image: 'clients.png',
    format: 'RGBA8888',
    size: { w: W, h: H },
    scale: '1',
  },
};
writeFileSync(JSON_PATH, JSON.stringify(atlas, null, 2));

console.log(`Wrote ${PNG_PATH} (${W}x${H}, ${Object.keys(frames).length} frames)`);
console.log(`Wrote ${JSON_PATH}`);
