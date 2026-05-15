/**
 * Lightweight button helper. Adds a rectangle with a text label centered
 * on (x, y), wires hover + click handlers, and returns a small object the
 * caller can `.destroy()` or hide/show.
 */
export function createButton(scene, x, y, label, onClick, opts = {}) {
  const {
    width = 220,
    height = 56,
    bgColor = 0xc74a2a,
    bgHover = 0xff6b3d,
    bgPress = 0x9a3a22,
    textColor = '#fff4d6',
    fontSize = '20px',
  } = opts;

  const bg = scene.add.rectangle(x, y, width, height, bgColor, 1);
  bg.setStrokeStyle(3, 0x2a1f14);
  bg.setOrigin(0.5, 0.5);
  bg.setInteractive({ useHandCursor: true });

  const text = scene.add.text(x, y, label, {
    fontFamily: 'monospace',
    fontSize,
    color: textColor,
    stroke: '#1a120a',
    strokeThickness: 3,
  });
  text.setOrigin(0.5, 0.5);

  bg.on('pointerover', () => bg.setFillStyle(bgHover, 1));
  bg.on('pointerout', () => bg.setFillStyle(bgColor, 1));
  bg.on('pointerdown', () => bg.setFillStyle(bgPress, 1));
  bg.on('pointerup', () => {
    bg.setFillStyle(bgHover, 1);
    onClick();
  });

  return {
    bg,
    text,
    setEnabled(enabled) {
      if (enabled) bg.setInteractive({ useHandCursor: true });
      else bg.disableInteractive();
      bg.setAlpha(enabled ? 1 : 0.5);
      text.setAlpha(enabled ? 1 : 0.5);
    },
    destroy() {
      bg.destroy();
      text.destroy();
    },
  };
}
