// Game-mode definitions. The player picks one after pressing Start; the
// chosen mode's `id` flows through Menu → ModeSelect → LevelIntro → Game
// → LevelResult as a string passed in each scene's init data.
//
// Each entry has:
//   id          — stable identifier passed between scenes
//   label       — display name shown on the mode-select screen
//   tagline     — one-line pitch (also shown on the selection screen)
//   details     — array of 2-3 short bullet lines describing the mode
//   color       — accent color for the mode card / handle
//   classic     — true for the legacy default behavior; everything else
//                 reads scene-level overrides off this object
//   taps        — number of pour stations active (defaults to 4)
//   timeOverrideSec — fixed level time, or null to use the per-level default
//   livesOverride — number of lives for survival mode, or null = no limit
//   infiniteLevels — true if the run never advances past level 1's intro
//                    (i.e. survival keeps you in one ongoing level)
//   onlyPerfectsScore — true if non-perfect pours score 0
//   noClients    — true to skip the client preferences / tip system

export const GAME_MODES = [
  {
    id: 'classic',
    label: 'CLASIC',
    tagline: 'el juego normal — 4 canillas, propinas, niveles',
    details: [
      '4 canillas, 4 colas',
      'serví la cerveza que cada cliente pide',
      'subí de nivel para ganar más propinas',
    ],
    color: 0xffd93d,
    classic: true,
    taps: 4,
    timeOverrideSec: null,
    livesOverride: null,
    infiniteLevels: false,
    onlyPerfectsScore: false,
    noClients: false,
  },
  {
    id: 'speedrun',
    label: 'VELOCIDAD',
    tagline: '1 canilla, 30 segundos — pura técnica de servida',
    details: [
      'una canilla, sin clientes',
      '30 segundos contra el reloj',
      'todo es por la calidad de la servida',
    ],
    color: 0xff7a4a,
    classic: false,
    taps: 1,
    timeOverrideSec: 30,
    livesOverride: null,
    infiniteLevels: false,
    onlyPerfectsScore: false,
    noClients: true,
  },
  {
    id: 'survival',
    label: 'SOBREVIVIR',
    tagline: '3 vidas, sin reloj — los clientes no paran de venir',
    details: [
      '4 canillas, sin reloj',
      'arrancás con 3 vidas',
      'cada cliente enojado: -1 vida',
    ],
    color: 0xff4a2a,
    classic: false,
    taps: 4,
    timeOverrideSec: null,
    livesOverride: 3,
    infiniteLevels: true,
    noTimer: true, // no countdown — the run only ends via lives or quit
    onlyPerfectsScore: false,
    noClients: false,
  },
  {
    id: 'combo',
    label: 'COMBO',
    tagline: 'solo las perfectas suman — un error y se rompe',
    details: [
      'únicamente servidas perfectas dan puntos',
      'cualquier error rompe el combo',
      'apuntá a la racha más larga',
    ],
    color: 0x6acc4a,
    classic: false,
    taps: 4,
    timeOverrideSec: null,
    livesOverride: null,
    infiniteLevels: false,
    onlyPerfectsScore: true,
    noClients: false,
  },
];

/** Get a mode definition by id, falling back to Classic if missing/unknown. */
export function getMode(id) {
  return GAME_MODES.find((m) => m.id === id) || GAME_MODES[0];
}

export const DEFAULT_MODE_ID = 'classic';

/**
 * Whether the mode-selection screen is enabled.
 *
 * Read from the build-time Vite env var `VITE_GAME_MODES_ENABLED`:
 *   unset / 'true' / '1' → enabled (default). Menu shows mode selection.
 *   'false' / '0'        → disabled. Menu skips selection and starts Classic
 *                          directly, restoring the pre-mode-select flow.
 *
 * Set it in a `.env` (or `.env.local`) file at the project root and restart
 * `npm run dev` for it to take effect.
 */
export function gameModesEnabled() {
  const raw = import.meta.env?.VITE_GAME_MODES_ENABLED;
  if (raw === undefined || raw === null || raw === '') return true;
  const v = String(raw).toLowerCase().trim();
  return v !== 'false' && v !== '0' && v !== 'off' && v !== 'no';
}
