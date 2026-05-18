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
 * Native sizes doubled (again) to match the client sprite pixel density.
 * Pair this with halving spriteScale (4 → 2) so the on-screen footprint
 * stays the same — twice the source pixels mean smoother curves, finer
 * shading bands, and more detail per glass component.
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
    outerWidthPx: 128,
    outerHeightPx: 192,
    innerWidthPx: 88,
    innerHeightPx: 152,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 1.0,
    widthProfile: (t) => lerp(0.78, 1.0, t),
  },

  // 2) PILSNER — tall narrow, gentle taper.
  {
    key: 'pilsner',
    label: 'Pilsner',
    outerWidthPx: 104,
    outerHeightPx: 216,
    innerWidthPx: 64,
    innerHeightPx: 176,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 0.7,
    widthProfile: (t) => lerp(0.6, 1.0, t),
  },

  // 3) MUG / STEIN — straight cylinder, with a handle on the right.
  {
    key: 'mug',
    label: 'Stein',
    outerWidthPx: 152,
    outerHeightPx: 176,
    innerWidthPx: 104,
    innerHeightPx: 136,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: true,
    foamFactor: 1.0,
    widthProfile: () => 1.0,
  },

  // 4) TULIP — narrow rim, bulge in the middle-upper, narrow base.
  {
    key: 'tulip',
    label: 'Tulip',
    outerWidthPx: 128,
    outerHeightPx: 192,
    innerWidthPx: 88,
    innerHeightPx: 152,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 1.4,
    widthProfile: (t) => {
      const base = 0.5 + 0.35 * Math.sin(Math.PI * t);
      const rim = t > 0.85 ? -0.15 * (t - 0.85) / 0.15 : 0;
      return Math.max(0.45, Math.min(1.0, base + rim + 0.15));
    },
  },

  // 5) SNIFTER — wide round bowl bottom, narrows near the top.
  {
    key: 'snifter',
    label: 'Snifter',
    outerWidthPx: 144,
    outerHeightPx: 152,
    innerWidthPx: 104,
    innerHeightPx: 112,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 1.3,
    widthProfile: (t) => {
      if (t < 0.6) return 0.85 + bell(t, 0.3, 0.3, 0.15);
      const k = (t - 0.6) / 0.4;
      return lerp(0.95, 0.5, k);
    },
  },

  // 6) WEIZEN — tall with a waist.
  {
    key: 'weizen',
    label: 'Weizen',
    outerWidthPx: 120,
    outerHeightPx: 224,
    innerWidthPx: 88,
    innerHeightPx: 184,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 1.5,
    widthProfile: (t) => {
      const base = lerp(0.7, 1.0, t);
      const waist = -0.2 * Math.exp(-Math.pow((t - 0.35) / 0.12, 2));
      return Math.max(0.5, Math.min(1.0, base + waist));
    },
  },

  // 7) GOBLET — wide bowl with stem + foot.
  {
    key: 'goblet',
    label: 'Goblet',
    outerWidthPx: 144,
    outerHeightPx: 200,
    innerWidthPx: 112,
    innerHeightPx: 120,
    topPaddingPx: 16,
    bottomPaddingPx: 64,
    handle: false,
    stem: true,
    foamFactor: 1.25,
    widthProfile: (t) => {
      const k = Math.sin(Math.PI * (0.2 + 0.6 * t));
      return Math.max(0.55, Math.min(1.0, 0.55 + 0.45 * k));
    },
  },

  // 8) FLUTE — very narrow.
  {
    key: 'flute',
    label: 'Flute',
    outerWidthPx: 72,
    outerHeightPx: 232,
    innerWidthPx: 40,
    innerHeightPx: 192,
    topPaddingPx: 16,
    bottomPaddingPx: 24,
    handle: false,
    foamFactor: 0.55,
    widthProfile: (t) => lerp(0.7, 1.0, t),
  },
];

export function pickRandomShape() {
  return GLASS_SHAPES[Math.floor(Math.random() * GLASS_SHAPES.length)];
}
