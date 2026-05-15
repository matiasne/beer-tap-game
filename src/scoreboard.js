/**
 * Local high-score board persisted in localStorage.
 * One stored value: an array of up to TOP_N entries sorted by score desc.
 *
 * Entry shape: { name, score, level, date } where date is an ISO string.
 */

const STORAGE_KEY = 'perfectPouring.scoreboard';
export const TOP_N = 10;

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private mode, quota) — silently no-op.
  }
}

/** Returns the current top entries, highest score first. */
export function getAll() {
  return readRaw()
    .filter((e) => e && typeof e.score === 'number')
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
}

/**
 * Would the given score earn a slot on the board? True when either the
 * board has fewer than TOP_N entries, or the score beats the lowest
 * existing entry.
 */
export function qualifies(score) {
  if (score <= 0) return false;
  const entries = getAll();
  if (entries.length < TOP_N) return true;
  return score > entries[entries.length - 1].score;
}

/**
 * Insert a new entry and persist. Returns the new entry's 0-based rank
 * (0 = top) or -1 if it didn't make the cut.
 */
export function insert({ name, score, level }) {
  const entry = {
    name: (name || 'AAAA').slice(0, 4),
    score: Math.max(0, Math.round(score)),
    level: Math.max(1, Math.round(level || 1)),
    date: new Date().toISOString(),
  };
  const merged = [...getAll(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
  writeRaw(merged);
  return merged.indexOf(entry);
}
