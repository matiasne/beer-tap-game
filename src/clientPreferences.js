/**
 * Client preference matrix: 3 fill levels × 3 foam levels = 9 archetypes.
 *
 * Each preference is matched against the served glass's liquid+foam state:
 *   - `fillTarget`     — desired liquid % of total volume (center of window)
 *   - `fillTolerance`  — ± window around fillTarget for "match"
 *   - `foamRatioTarget` — desired foam/liquid ratio % (center)
 *   - `foamTolerance`  — ± window around foamRatioTarget for "match"
 *
 * Scoring at release uses these to:
 *   1) award/penalize a fill-match bonus
 *   2) compute a tip multiplier (0.4×–1.5×)
 */

export const FILL_PREFS = {
  HALF:    { key: 'half',    label: '½',  fillTarget: 55,  fillTolerance: 12 },
  FULL:    { key: 'full',    label: 'full',    fillTarget: 90,  fillTolerance: 8  },
  HEAPING: { key: 'heaping', label: 'heaping', fillTarget: 98,  fillTolerance: 4  },
};

export const FOAM_PREFS = {
  FLAT:    { key: 'flat',    label: 'flat',    foamRatioTarget: 4,   foamTolerance: 6  },
  NORMAL:  { key: 'normal',  label: 'head',    foamRatioTarget: 14,  foamTolerance: 8  },
  TALL:    { key: 'tall',    label: 'tall',    foamRatioTarget: 30,  foamTolerance: 10 },
};

// All 9 combinations. iconKey maps to a texture generated in BootScene.
export const CLIENT_PREFERENCES = [];
for (const fk of Object.keys(FILL_PREFS)) {
  for (const fmk of Object.keys(FOAM_PREFS)) {
    const fill = FILL_PREFS[fk];
    const foam = FOAM_PREFS[fmk];
    CLIENT_PREFERENCES.push({
      key: `${fill.key}_${foam.key}`,
      iconKey: `pref_${fill.key}_${foam.key}`,
      fill,
      foam,
      label: `${fill.label}/${foam.label}`,
    });
  }
}

export function pickRandomPreference() {
  return CLIENT_PREFERENCES[Math.floor(Math.random() * CLIENT_PREFERENCES.length)];
}

/** Compose the texture key for a (preference × beer style) icon. */
export function prefIconKey(pref, beerStyle) {
  return `${pref.iconKey}_${beerStyle.key}`;
}

/**
 * Evaluate a poured glass against a client's preference.
 * Returns:
 *   matchScore: 0..1 (how close to ideal across both axes)
 *   fillBonus: int score points to add (positive=match, negative=miss)
 *   tipMultiplier: 0.4..1.5
 *   label: short feedback string e.g. "perfect for them!" or "too foamy"
 */
export function evaluateAgainstPreference(liquidPct, foamPct, pref) {
  const fillErr = Math.abs(liquidPct - pref.fill.fillTarget);
  const foamRatio = liquidPct > 1 ? (foamPct / liquidPct) * 100 : 0;
  const foamErr = Math.abs(foamRatio - pref.foam.foamRatioTarget);

  // Normalize to [0..1]: 0 = perfect, 1+ = way off. Clamp at 2x tolerance for tip math.
  const fillNorm = Math.min(1, fillErr / (pref.fill.fillTolerance * 2));
  const foamNorm = Math.min(1, foamErr / (pref.foam.foamTolerance * 2));

  const matchScore = 1 - (fillNorm + foamNorm) / 2;

  const fillInWindow = fillErr <= pref.fill.fillTolerance;
  const foamInWindow = foamErr <= pref.foam.foamTolerance;

  // Fill bonus / penalty
  let fillBonus = 0;
  if (fillInWindow) fillBonus += 50;
  else if (fillErr > pref.fill.fillTolerance * 1.8) fillBonus -= 25;

  // Tip multiplier: 0.4× (terrible) to 1.5× (perfect)
  const tipMultiplier = 0.4 + 1.1 * matchScore;

  let label = '';
  if (fillInWindow && foamInWindow) label = 'just right!';
  else if (!fillInWindow && !foamInWindow) label = 'not their style';
  else if (!fillInWindow) {
    label = liquidPct > pref.fill.fillTarget ? 'too much' : 'too little';
  } else {
    label = foamRatio > pref.foam.foamRatioTarget ? 'too foamy' : 'too flat';
  }

  return { matchScore, fillBonus, tipMultiplier, label, fillInWindow, foamInWindow };
}
