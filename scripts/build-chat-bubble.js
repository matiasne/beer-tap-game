// Renders the chat bubble to a real PNG on disk.
// Run: `node scripts/build-chat-bubble.js`. Outputs public/sprites/chat_bubble.png.
//
// Drawing lives in src/chatBubble.js so the runtime and offline paths
// produce pixel-identical output.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAT_BUBBLE_W,
  CHAT_BUBBLE_H,
  drawChatBubble,
} from '../src/chatBubble.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'sprites');
const PNG_PATH = resolve(OUT_DIR, 'chat_bubble.png');

const canvas = createCanvas(CHAT_BUBBLE_W, CHAT_BUBBLE_H);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

drawChatBubble(ctx, 0, 0);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(PNG_PATH, canvas.toBuffer('image/png'));

console.log(`Wrote ${PNG_PATH} (${CHAT_BUBBLE_W}×${CHAT_BUBBLE_H})`);
