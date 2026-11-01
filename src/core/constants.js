/** Shared rules and layout numbers. Pure data — no DOM. */

export const GRID_W = 48;
export const GRID_H = 32;
export const PLAYER_COUNT = 4;

/** Frames between cell steps at 60 Hz. Boost halves the wait. */
export const BASE_MOVE_INTERVAL = 6;
export const BOOST_MOVE_INTERVAL = 3;
export const BOOST_DURATION = 180;
export const GAP_DURATION = 90;
export const MAX_JUMP_CHARGES = 3;

export const COUNTDOWN_FRAMES = 180;
export const ROUND_END_FRAMES = 150;
export const DEFAULT_ROUNDS_TO_WIN = 5;

export const POWERUP_MAX = 3;
export const POWERUP_SPAWN_INTERVAL = 240;
export const POWERUP_TYPES = ["boost", "gap", "jump"];

export const DIR_ORDER = ["up", "right", "down", "left"];

export const DIR_DELTA = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Inset from the walls so the first seconds are about choosing a line. */
export const DEFAULT_STARTS = [
  { x: 6, y: 16, dir: "right" },
  { x: 41, y: 16, dir: "left" },
  { x: 24, y: 5, dir: "down" },
  { x: 24, y: 26, dir: "up" },
];

export const PLAYER_COLORS = ["#3ee0ff", "#ff8a2a", "#e14bff", "#c6ff3a"];
export const PLAYER_NAMES = ["P1", "P2", "P3", "P4"];

export const CELL = 18;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 72;

export function isOpposite(a, b) {
  return OPPOSITE[a] === b;
}

export function turnLeft(dir) {
  const i = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(i + 3) % 4];
}

export function turnRight(dir) {
  const i = DIR_ORDER.indexOf(dir);
  return DIR_ORDER[(i + 1) % 4];
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
}

export function cellIndex(x, y) {
  return y * GRID_W + x;
}
