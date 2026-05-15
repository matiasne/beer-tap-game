/**
 * 8 distinct glass shapes. Each is defined by a vertical width profile
 * `widthProfile(t)` where t∈[0,1] (0=bottom, 1=top of the fill line) maps
 * to a value in [0,1] representing the fraction of `innerWidthPx` the
 * glass is wide at that height.
 *
 * The full glass outline texture is `outerWidthPx × outerHeightPx`. The
 * drawable inner area (where beer goes) is `innerWidthPx × innerHeightPx`,
 * vertically offset from the top by `topPaddingPx` (rim) and from the
 * bottom by `bottomPaddingPx` (base).
 *
 * Pour math: while pouring, beer arrives at a constant volumetric rate
 * (% of total volume per second). The Glass class precomputes a
 * cumulative-volume table from `widthProfile` so the visible fill height
 * tracks volume, not height — narrow sections rise fast, wide sections
 * rise slow.
 *
 * Native sizes were doubled when the canvas moved to 1920×1080 so the
 * drawing code has twice as many pixels to add detail (richer rim, base
 * bevel, thicker handles, multi-pixel stem highlights, etc.).
 */

// Helpers
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth bell-ish bulge centered at `c` with half-width `w` and peak `peak`.
const bell = (t, c, w, peak) => {
  const x = (t - c) / w;
  if (Math.abs(x) >= 1) return 0;
  return peak * Math.cos((Math.PI * x) / 2);
};

export const GLASS_SHAPES = [
  // 1) PINT — slight outward taper toward the top. Classic.
  // Baseline foam behavior.
  {
    key: 'pint',
    label: 'Pint',
    outerWidthPx: 64,
    outerHeightPx: 96,
    innerWidthPx: 44,
    innerHeightPx: 76,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 1.0,
    widthProfile: (t) => lerp(0.78, 1.0, t),
  },

  // 2) PILSNER — tall narrow, gentle taper. Wider at top than bottom.
  // Narrow surface area lets gas escape slowly → less foam.
  {
    key: 'pilsner',
    label: 'Pilsner',
    outerWidthPx: 52,
    outerHeightPx: 108,
    innerWidthPx: 32,
    innerHeightPx: 88,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 0.7,
    widthProfile: (t) => lerp(0.6, 1.0, t),
  },

  // 3) MUG / STEIN — straight cylinder, with a handle on the right.
  // Average surface, average foam.
  {
    key: 'mug',
    label: 'Stein',
    outerWidthPx: 76,
    outerHeightPx: 88,
    innerWidthPx: 52,
    innerHeightPx: 68,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: true,
    foamFactor: 1.0,
    widthProfile: () => 1.0,
  },

  // 4) TULIP — narrow rim, bulge in the middle-upper, narrow base.
  // Curved bulge traps foam → more head.
  {
    key: 'tulip',
    label: 'Tulip',
    outerWidthPx: 64,
    outerHeightPx: 96,
    innerWidthPx: 44,
    innerHeightPx: 76,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 1.4,
    widthProfile: (t) => {
      // narrow at top, bulge ~0.55, narrow at bottom
      const base = 0.5 + 0.35 * Math.sin(Math.PI * t); // arches 0.5→0.85→0.5
      const rim = t > 0.85 ? -0.15 * (t - 0.85) / 0.15 : 0; // pinch the rim
      return Math.max(0.45, Math.min(1.0, base + rim + 0.15));
    },
  },

  // 5) SNIFTER — wide round bowl bottom, sharply narrows near the top.
  // Wide bowl agitates the pour, narrow neck concentrates foam.
  {
    key: 'snifter',
    label: 'Snifter',
    outerWidthPx: 72,
    outerHeightPx: 76,
    innerWidthPx: 52,
    innerHeightPx: 56,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 1.3,
    widthProfile: (t) => {
      // wide bowl (0..0.6), narrow neck (0.6..1)
      if (t < 0.6) return 0.85 + bell(t, 0.3, 0.3, 0.15);
      const k = (t - 0.6) / 0.4;
      return lerp(0.95, 0.5, k);
    },
  },

  // 6) WEIZEN — tall, narrow waist around 1/3, wider top & bottom.
  // Iconic foam-builder — the flared top is designed to pile head.
  {
    key: 'weizen',
    label: 'Weizen',
    outerWidthPx: 60,
    outerHeightPx: 112,
    innerWidthPx: 44,
    innerHeightPx: 92,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 1.5,
    widthProfile: (t) => {
      // waist at t≈0.35, fat top
      const base = lerp(0.7, 1.0, t); // gradual widen
      const waist = -0.2 * Math.exp(-Math.pow((t - 0.35) / 0.12, 2));
      return Math.max(0.5, Math.min(1.0, base + waist));
    },
  },

  // 7) GOBLET — wide bowl with a short stem look (just visual; fill is bowl only).
  // Wide rounded bowl, foam grows quickly.
  {
    key: 'goblet',
    label: 'Goblet',
    outerWidthPx: 72,
    outerHeightPx: 100,
    innerWidthPx: 56,
    innerHeightPx: 60,
    topPaddingPx: 8,
    bottomPaddingPx: 32, // taller bottom padding makes room for the stem+foot
    handle: false,
    stem: true,
    foamFactor: 1.25,
    widthProfile: (t) => {
      // wide rounded bowl
      const k = Math.sin(Math.PI * (0.2 + 0.6 * t));
      return Math.max(0.55, Math.min(1.0, 0.55 + 0.45 * k));
    },
  },

  // 8) FLUTE — very narrow, gentle taper outward at top.
  // Tiny surface area: barely any foam at all.
  {
    key: 'flute',
    label: 'Flute',
    outerWidthPx: 36,
    outerHeightPx: 116,
    innerWidthPx: 20,
    innerHeightPx: 96,
    topPaddingPx: 8,
    bottomPaddingPx: 12,
    handle: false,
    foamFactor: 0.55,
    widthProfile: (t) => lerp(0.7, 1.0, t),
  },
];

export function pickRandomShape() {
  return GLASS_SHAPES[Math.floor(Math.random() * GLASS_SHAPES.length)];
}
