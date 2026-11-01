import { DEFAULT_ROUNDS_TO_WIN } from "../core/constants.js";
import { cloneBindings, DEFAULT_BINDINGS } from "../core/input.js";

const SETTINGS_KEY = "lightcyclequad.settings";
const BINDINGS_KEY = "lightcyclequad.bindings";

export function defaultSettings() {
  return {
    volume: 0.8,
    muted: false,
    roundsToWin: DEFAULT_ROUNDS_TO_WIN,
  };
}

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.8;
  return Math.min(1, Math.max(0, Math.round(n * 10) / 10));
}

function clampRounds(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 20) return DEFAULT_ROUNDS_TO_WIN;
  return n;
}

export function loadSettings() {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      volume: clampVolume(parsed.volume),
      muted: !!parsed.muted,
      roundsToWin: clampRounds(parsed.roundsToWin),
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        volume: clampVolume(settings.volume),
        muted: !!settings.muted,
        roundsToWin: clampRounds(settings.roundsToWin),
      }),
    );
  } catch {
    /* private mode or a full disk — the match still runs */
  }
}

export function loadBindings() {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return cloneBindings(DEFAULT_BINDINGS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 4) return cloneBindings(DEFAULT_BINDINGS);
    const keys = ["up", "down", "left", "right", "action", "secondary"];
    const ok = parsed.every((row) => row && keys.every((key) => key in row));
    return ok ? parsed.map((row) => ({ ...row })) : cloneBindings(DEFAULT_BINDINGS);
  } catch {
    return cloneBindings(DEFAULT_BINDINGS);
  }
}

export function saveBindings(bindings) {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore quota / private mode */
  }
}
