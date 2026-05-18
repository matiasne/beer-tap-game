// Renders the client sprite sheets to real PNG files on disk, organised by
// folder per character, one PNG per state. Each PNG is a horizontal strip
// of FRAMES_PER_STATE frames at FRAME_W × FRAME_H each.
//
// Layout written to public/sprites/clients/:
//   manifest.json                 ← lists characters + states + frame counts
//   <characterId>/
//     idle.png        (6 × FRAME_W wide)
//     normal.png
//     antsy.png
//     furious.png
//     talking_left.png
//     talking_right.png
//     walking.png
//
// Run: `node scripts/build-sprite-sheet.js`.
//
// The drawing logic lives in src/clientSpriteSheet.js so the browser path and
// the offline export draw pixel-identical frames. This script just runs that
// drawing into per-state node-canvas contexts, then serialises each to disk.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_CHARACTERS,
  STATES,
  FRAMES_PER_STATE,
  FRAME_W,
  FRAME_H,
  drawClientFrame,
} from '../src/clientSpriteSheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '..', 'public', 'sprites');
const CLIENTS_DIR = resolve(SPRITES_DIR, 'clients');

// Clean slate: remove old per-character folders + the legacy single-atlas files
// so stale frames don't linger when a character is renamed or removed.
if (existsSync(CLIENTS_DIR)) {
  rmSync(CLIENTS_DIR, { recursive: true, force: true });
}
const LEGACY_PNG = resolve(SPRITES_DIR, 'clients.png');
const LEGACY_JSON = resolve(SPRITES_DIR, 'clients.json');
if (existsSync(LEGACY_PNG)) rmSync(LEGACY_PNG);
if (existsSync(LEGACY_JSON)) rmSync(LEGACY_JSON);

mkdirSync(CLIENTS_DIR, { recursive: true });

const stripWidth = FRAMES_PER_STATE * FRAME_W;
const stripHeight = FRAME_H;

let totalFrames = 0;
const charsManifest = [];

for (const char of ALL_CHARACTERS) {
  const charDir = resolve(CLIENTS_DIR, char.id);
  mkdirSync(charDir, { recursive: true });
  const stateFiles = [];

  for (const state of STATES) {
    const canvas = createCanvas(stripWidth, stripHeight);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let f = 0; f < FRAMES_PER_STATE; f++) {
      drawClientFrame(ctx, f * FRAME_W, 0, char, state, f);
      totalFrames += 1;
    }

    const fileName = `${state}.png`;
    const filePath = resolve(charDir, fileName);
    writeFileSync(filePath, canvas.toBuffer('image/png'));
    stateFiles.push(fileName);
  }

  charsManifest.push({
    id: char.id,
    label: char.label || char.id,
    special: !!char.special,
    states: stateFiles,
  });
  console.log(`Wrote sprites/clients/${char.id}/ (${STATES.length} PNGs)`);
}

const manifest = {
  version: 2,
  frameWidth: FRAME_W,
  frameHeight: FRAME_H,
  framesPerState: FRAMES_PER_STATE,
  states: STATES,
  characters: charsManifest,
};
writeFileSync(resolve(CLIENTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\nWrote ${charsManifest.length} characters, ${totalFrames} total frames.`);
console.log(`Manifest: sprites/clients/manifest.json`);
