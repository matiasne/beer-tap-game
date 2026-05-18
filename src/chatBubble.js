// Pure pixel-art renderer for the chat bubble used above each client's head.
// Same drawing logic used both at runtime (BootScene fallback when the PNG
// is missing) and offline (scripts/build-chat-bubble.js writes the PNG).
//
// Layout: 28×28 px, where the top 22 rows are the bubble body and the
// bottom 6 rows are the down-left tail.

export const CHAT_BUBBLE_W = 28;
export const CHAT_BUBBLE_H = 28;
export const CHAT_BUBBLE_BODY_H = 22;

function rgba(color, alpha) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Render the bubble into `ctx` at offset (ox, oy). Caller must allocate
 * CHAT_BUBBLE_W × CHAT_BUBBLE_H of room.
 */
export function drawChatBubble(ctx, ox = 0, oy = 0) {
  const W = CHAT_BUBBLE_W;
  const H = CHAT_BUBBLE_H;
  const bubbleH = CHAT_BUBBLE_BODY_H;

  const fill = 0xfff4d6;
  const fillLight = 0xffffff;
  const outline = 0x2a1f14;
  const shadow = 0xd9c89a;

  const setFill = (c, a = 1) => { ctx.fillStyle = rgba(c, a); };
  const rect = (x, y, w, h) => ctx.fillRect(ox + x, oy + y, w, h);

  // Body fill — rounded corners knocked out after.
  setFill(fill);
  rect(1, 1, W - 2, bubbleH - 2);

  // Outline (top/bottom/left/right) — skip 4 corner pixels.
  setFill(outline);
  rect(2, 0, W - 4, 1);
  rect(2, bubbleH - 1, W - 4, 1);
  rect(0, 2, 1, bubbleH - 4);
  rect(W - 1, 2, 1, bubbleH - 4);
  // Corner step pixels (one in, one down from each corner)
  rect(1, 1, 1, 1);
  rect(W - 2, 1, 1, 1);
  rect(1, bubbleH - 2, 1, 1);
  rect(W - 2, bubbleH - 2, 1, 1);

  // Inner top highlight
  setFill(fillLight);
  rect(2, 1, W - 4, 1);
  rect(1, 2, 1, 1);
  rect(W - 2, 2, 1, 1);

  // Inner bottom shadow
  setFill(shadow);
  rect(2, bubbleH - 2, W - 4, 1);

  // Tail — outline first, then fill, pointing down-left.
  setFill(outline);
  rect(6, bubbleH, 5, 1);
  rect(5, bubbleH + 1, 5, 1);
  rect(4, bubbleH + 2, 4, 1);
  rect(3, bubbleH + 3, 3, 1);
  rect(3, bubbleH + 4, 2, 1);
  rect(3, bubbleH + 5, 1, 1);
  setFill(fill);
  rect(7, bubbleH, 3, 1);
  rect(6, bubbleH + 1, 3, 1);
  rect(5, bubbleH + 2, 2, 1);
  rect(4, bubbleH + 3, 1, 1);
  // Erase the outline pixels right under where the tail meets the bubble.
  setFill(fill);
  rect(6, bubbleH - 1, 4, 1);
}
