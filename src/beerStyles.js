/**
 * 6 beer styles. Each session randomly picks 4 of them and assigns one
 * per tap. Each style has a distinct liquid color and a matching tap-handle
 * color. Foam stays cream/white across all styles for readability.
 */

export const BEER_STYLES = [
  {
    key: 'red',
    label: 'RED',
    liquidColor: 0xa83820,    // deep reddish-amber
    liquidEdgeColor: 0x6a1f10,
    handleColor: 0xc74a2a,
    handleHighlight: 0xff6b3d,
  },
  {
    key: 'ipa',
    label: 'IPA',
    liquidColor: 0xe88a18,    // bright orange-amber, hazy
    liquidEdgeColor: 0xa65a0a,
    handleColor: 0xe89a30,
    handleHighlight: 0xffbb55,
  },
  {
    key: 'apa',
    label: 'APA',
    liquidColor: 0xd9a830,    // golden-amber, slightly paler than IPA
    liquidEdgeColor: 0x8a6a18,
    handleColor: 0xc9b04a,
    handleHighlight: 0xffd96b,
  },
  {
    key: 'golden',
    label: 'GOLDEN',
    liquidColor: 0xf2c84a,    // bright pale gold
    liquidEdgeColor: 0xb88a18,
    handleColor: 0xf2d36b,
    handleHighlight: 0xfff1a8,
  },
  {
    key: 'lager',
    label: 'LAGER',
    liquidColor: 0xeac058,    // straw-pale yellow
    liquidEdgeColor: 0xa68a18,
    handleColor: 0xa8c9d9,    // muted blue handle to differentiate from golden
    handleHighlight: 0xd8e8f2,
  },
  {
    key: 'stout',
    label: 'STOUT',
    liquidColor: 0x1a0d06,    // near-black, very dark brown
    liquidEdgeColor: 0x080302,
    handleColor: 0x3a2418,
    handleHighlight: 0x6a3a20,
  },
];

export const BEER_STYLES_BY_KEY = Object.fromEntries(
  BEER_STYLES.map((s) => [s.key, s]),
);

/**
 * Pick 4 distinct styles from the 6 available, in a random order.
 * Returns an array of style objects, length 4, indexed by tap position.
 */
export function shuffleAndPickStyles(count = 4) {
  const pool = [...BEER_STYLES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
