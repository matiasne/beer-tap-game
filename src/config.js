export const GAME_CONFIG = {
  // Pouring — liquid arrives at this rate (% of total volume / second).
  pourRatePerSecond: 40,
  glassCapacity: 100,
  overflowThreshold: 110, // liquid alone overflows at this point
  foamOvershootAllowance: 30, // foam can crown above the rim by this many % of total volume before overflowing

  // Foam simulation
  foam: {
    growthPerSecond: 38, // foam added per second while pouring (% of total volume)
    settlePerSecond: 6, // foam shrink rate per second when idle
    settleToLiquidRatio: 0.5, // fraction of settled foam that converts back to liquid
    idealMinPct: 8, // % foam relative to liquid for perfect head
    idealMaxPct: 18,
    // Feathering: if the user re-presses the tap within `featherWindowMs` of
    // releasing it, foam growth is scaled by `featherFoamMultiplier` for the
    // next `featherEffectMs`. Liquid rate is unaffected. Rewards tap-tap-tap
    // pouring technique.
    featherWindowMs: 300,
    featherEffectMs: 500,
    featherFoamMultiplier: 0.2,
  },

  // Scoring zones (based on liquid+foam total volume)
  scoring: {
    wastedBelow: 70, // < 70%: no points
    decentBelow: 90, // 70-89%: +10 * fillPct
    goodBelow: 96, // 90-95%: +100
    perfectBelow: 100.01, // 96-100%: +250 (widened from 99-100 for forgiveness)
    overflowPenalty: -50, // > 100%: -50
    foamHeadBonus: 100, // bonus when foam head is within ideal range AND total fill is good+
    foamPenaltyTooMuch: -50, // foam > ~2x ideal max
  },

  // Visual
  spriteScale: 4,
  // Separate scale for glasses since their source resolution is now 2× the
  // other procedural sprites — keeps screen footprint consistent with the
  // pre-resolution-bump version while delivering 2× the pixel density.
  glassSpriteScale: 2,
  // World is 1920×1080. The 4 taps are spread evenly across the wider canvas.
  tapY: 450,
  glassY: 780,
  tapXs: [320, 760, 1200, 1640],

  // Glass cycle timings (ms)
  glassReleaseDuration: 450,
  glassSpawnDelay: 250,
  glassReleaseAfterIdleMs: 2000, // auto-release the glass after the tap has been off this long

  // Clients
  clients: {
    queueSize: 3, // visible clients per tap
    queueXOffset: 8, // each client behind shifts this much horizontally
    queueYOffset: -2, // and this much vertically (depth illusion)
    queueScale: 0.7, // sprite scale (frames are 192×264 source px; 0.7 → ~185 px on-screen)
    queueScaleFalloff: 0.85, // each further-back client shrinks by this factor
    queueAlphaFalloff: 0.92, // and dims
    frontBottomY: 360, // y-coord of the front client's feet (just above the bar strip)
    tipMin: 0,
    tipMax: 25,
    patienceMs: 45000, // 45s from spawn to angry-leave
    angryPenalty: -100, // score change when a client leaves angry
    spawnMinDelayMs: 1200, // min delay before refilling an empty slot
    spawnMaxDelayMs: 2800, // max delay
    initialSpawnDelayMs: 400,
  },
};
