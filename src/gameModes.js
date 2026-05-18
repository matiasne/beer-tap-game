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
//   noTimer       — true if the level has no timer (Survival)
//   noClients     — true to skip the client preferences / tip system
//   fixedClientCount      — function(level) → number of clients per level
//                           (Tanda: must clear a fixed roster). null otherwise.
//   clientsLeaveOnlyWhenServed — true to disable patience-decay angry-leave;
//                                bad pours dump the glass, the client stays

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
    noTimer: false,
    noClients: false,
    fixedClientCount: null,
    clientsLeaveOnlyWhenServed: false,
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
    noTimer: false,
    noClients: true,
    fixedClientCount: null,
    clientsLeaveOnlyWhenServed: false,
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
    noTimer: true,
    noClients: false,
    fixedClientCount: null,
    clientsLeaveOnlyWhenServed: false,
  },
  {
    id: 'tanda',
    label: 'TANDA',
    tagline: 'limpiá la barra antes de que se acabe el tiempo',
    details: [
      'cantidad fija de clientes por nivel',
      'los clientes se van solo si los servís bien',
      'una mala servida tira la cerveza',
    ],
    color: 0x6acc4a,
    classic: false,
    taps: 4,
    timeOverrideSec: null,
    livesOverride: null,
    infiniteLevels: false,
    noTimer: false,
    noClients: false,
    // 6 clients on level 1, +1 each level (level 1 = 6, level 2 = 7, …)
    fixedClientCount: (level) => 5 + level,
    clientsLeaveOnlyWhenServed: true,
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
