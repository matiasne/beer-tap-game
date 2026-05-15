/**
 * Procedural infinite level progression.
 *
 * Each level has a fixed time window and a cumulative score target the
 * player must hit by the time the timer expires. Failing means GAME OVER
 * — the player restarts from level 1 with score reset to $0.
 */

export const LEVELS_CONFIG = {
  minTimeSec: 30,
  baseTimeSec: 60,
  timeStepSec: 3,         // time shrinks by this much each level
  baseTarget: 200,        // cumulative target at level 1 (200)
  targetStepPerLevel: 250, // and grows by this much each subsequent level
};

/** Time limit in seconds for level N (N is 1-indexed). */
export function levelTimeSec(n) {
  return Math.max(
    LEVELS_CONFIG.minTimeSec,
    LEVELS_CONFIG.baseTimeSec - LEVELS_CONFIG.timeStepSec * (n - 1),
  );
}

/**
 * Cumulative score target by the end of level N. The player must reach
 * this score (or higher) before the timer hits 0 to advance.
 */
export function levelTarget(n) {
  return LEVELS_CONFIG.baseTarget + LEVELS_CONFIG.targetStepPerLevel * (n - 1);
}

/** Score earned during the previous levels only — used to display "you need to earn $X more". */
export function previousLevelsTarget(n) {
  if (n <= 1) return 0;
  return levelTarget(n - 1);
}
