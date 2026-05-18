// Renders the 5 level backgrounds to PNG files on disk.
// Output layout:
//   public/sprites/backgrounds/<level_id>/bg.png
//
// Run: `node scripts/build-backgrounds.js`.
// Drawing logic lives in src/backgrounds.js (pure Canvas2D) so runtime + offline
// produce pixel-identical output.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKGROUNDS, BG_W, BG_H, BACK_W, BACK_H } from '../src/backgrounds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '..', 'public', 'sprites');
const BG_DIR = resolve(SPRITES_DIR, 'backgrounds');

// Wipe stale backgrounds folder so renames/removals don't leave orphans.
if (existsSync(BG_DIR)) rmSync(BG_DIR, { recursive: true, force: true });
mkdirSync(BG_DIR, { recursive: true });

for (const bg of BACKGROUNDS) {
  const dir = resolve(BG_DIR, bg.id);
  mkdirSync(dir, { recursive: true });

  // Customer-side wall (upper area)
  {
    const canvas = createCanvas(BG_W, BG_H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    bg.draw(ctx, 0, 0);
    writeFileSync(resolve(dir, 'bg.png'), canvas.toBuffer('image/png'));
    console.log(`Wrote sprites/backgrounds/${bg.id}/bg.png (${BG_W}×${BG_H}) — ${bg.label}`);
  }

  // Back-bar wall (behind the row of taps) — optional per level
  if (bg.drawBack) {
    const canvas = createCanvas(BACK_W, BACK_H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    bg.drawBack(ctx, 0, 0);
    writeFileSync(resolve(dir, 'back.png'), canvas.toBuffer('image/png'));
    console.log(`Wrote sprites/backgrounds/${bg.id}/back.png (${BACK_W}×${BACK_H}) — ${bg.label} back-bar`);
  }
}

console.log(`\nWrote ${BACKGROUNDS.length} backgrounds.`);
