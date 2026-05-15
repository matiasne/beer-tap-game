// Renders the 8 glass outline sprites to a single PNG + Phaser atlas JSON.
// Run: `node scripts/build-glass-sprite-sheet.js`. Outputs to public/sprites/.
//
// The drawing logic lives in src/glassSpriteSheet.js so the browser path and
// the offline export draw pixel-identical frames. This script just runs that
// drawing into a node-canvas context, then serialises the result to disk.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLASS_SHAPES, drawGlass, glassFrameName } from '../src/glassSpriteSheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'sprites');
const PNG_PATH = resolve(OUT_DIR, 'glasses.png');
const JSON_PATH = resolve(OUT_DIR, 'glasses.json');

// Lay glasses out left-to-right in a single row. Tallest glass dictates
// the canvas height; each shape gets a column wide enough for its own
// outerWidthPx with a 1px gutter between columns (avoids texture bleed
// at fractional scales).
const GUTTER = 1;
const totalWidth =
  GLASS_SHAPES.reduce((acc, s) => acc + s.outerWidthPx, 0) +
  GUTTER * (GLASS_SHAPES.length - 1);
const maxHeight = GLASS_SHAPES.reduce((h, s) => Math.max(h, s.outerHeightPx), 0);

const canvas = createCanvas(totalWidth, maxHeight);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const frames = {};
let cursorX = 0;
for (const shape of GLASS_SHAPES) {
  const x = cursorX;
  const y = 0;
  const w = shape.outerWidthPx;
  const h = shape.outerHeightPx;
  drawGlass(ctx, x, y, shape);
  frames[glassFrameName(shape.key)] = {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
  };
  cursorX += w + GUTTER;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(PNG_PATH, canvas.toBuffer('image/png'));

const atlas = {
  frames,
  meta: {
    app: 'beer-tap-game/build-glass-sprite-sheet',
    version: '1.0',
    image: 'glasses.png',
    format: 'RGBA8888',
    size: { w: totalWidth, h: maxHeight },
    scale: '1',
  },
};
writeFileSync(JSON_PATH, JSON.stringify(atlas, null, 2));

console.log(`Wrote ${PNG_PATH} (${totalWidth}x${maxHeight}, ${Object.keys(frames).length} frames)`);
console.log(`Wrote ${JSON_PATH}`);
