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
  {
    key: 'pint',
    label: 'Pint',
    outerWidthPx: 32,
    outerHeightPx: 48,
    innerWidthPx: 22,
    innerHeightPx: 38,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => lerp(0.78, 1.0, t),
  },

  // 2) PILSNER — tall narrow, gentle taper. Wider at top than bottom.
  {
    key: 'pilsner',
    label: 'Pilsner',
    outerWidthPx: 26,
    outerHeightPx: 54,
    innerWidthPx: 16,
    innerHeightPx: 44,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => lerp(0.6, 1.0, t),
  },

  // 3) MUG / STEIN — straight cylinder, with a handle on the right.
  {
    key: 'mug',
    label: 'Stein',
    outerWidthPx: 38,
    outerHeightPx: 44,
    innerWidthPx: 26,
    innerHeightPx: 34,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: true,
    widthProfile: () => 1.0,
  },

  // 4) TULIP — narrow rim, bulge in the middle-upper, narrow base.
  {
    key: 'tulip',
    label: 'Tulip',
    outerWidthPx: 32,
    outerHeightPx: 48,
    innerWidthPx: 22,
    innerHeightPx: 38,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => {
      // narrow at top, bulge ~0.55, narrow at bottom
      const base = 0.5 + 0.35 * Math.sin(Math.PI * t); // arches 0.5→0.85→0.5
      const rim = t > 0.85 ? -0.15 * (t - 0.85) / 0.15 : 0; // pinch the rim
      return Math.max(0.45, Math.min(1.0, base + rim + 0.15));
    },
  },

  // 5) SNIFTER — wide round bowl bottom, sharply narrows near the top.
  {
    key: 'snifter',
    label: 'Snifter',
    outerWidthPx: 36,
    outerHeightPx: 38,
    innerWidthPx: 26,
    innerHeightPx: 28,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => {
      // wide bowl (0..0.6), narrow neck (0.6..1)
      if (t < 0.6) return 0.85 + bell(t, 0.3, 0.3, 0.15);
      const k = (t - 0.6) / 0.4;
      return lerp(0.95, 0.5, k);
    },
  },

  // 6) WEIZEN — tall, narrow waist around 1/3, wider top & bottom.
  {
    key: 'weizen',
    label: 'Weizen',
    outerWidthPx: 30,
    outerHeightPx: 56,
    innerWidthPx: 22,
    innerHeightPx: 46,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => {
      // waist at t≈0.35, fat top
      const base = lerp(0.7, 1.0, t); // gradual widen
      const waist = -0.2 * Math.exp(-Math.pow((t - 0.35) / 0.12, 2));
      return Math.max(0.5, Math.min(1.0, base + waist));
    },
  },

  // 7) GOBLET — wide bowl with a short stem look (just visual; fill is bowl only).
  {
    key: 'goblet',
    label: 'Goblet',
    outerWidthPx: 36,
    outerHeightPx: 50,
    innerWidthPx: 28,
    innerHeightPx: 30,
    topPaddingPx: 4,
    bottomPaddingPx: 16, // taller bottom padding makes room for the stem+foot
    handle: false,
    stem: true,
    widthProfile: (t) => {
      // wide rounded bowl
      const k = Math.sin(Math.PI * (0.2 + 0.6 * t));
      return Math.max(0.55, Math.min(1.0, 0.55 + 0.45 * k));
    },
  },

  // 8) FLUTE — very narrow, gentle taper outward at top.
  {
    key: 'flute',
    label: 'Flute',
    outerWidthPx: 18,
    outerHeightPx: 58,
    innerWidthPx: 10,
    innerHeightPx: 48,
    topPaddingPx: 4,
    bottomPaddingPx: 6,
    handle: false,
    widthProfile: (t) => lerp(0.7, 1.0, t),
  },
];

export function pickRandomShape() {
  return GLASS_SHAPES[Math.floor(Math.random() * GLASS_SHAPES.length)];
}
