/** Keyboard and gamepad mapping. Pure: callers pass key sets and pad snapshots. */

export const DEFAULT_BINDINGS = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "KeyF", secondary: "KeyG" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", action: "Slash", secondary: "Period" },
  { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "Semicolon", secondary: "Quote" },
  { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", action: "Numpad0", secondary: "NumpadEnter" },
];

const ACTION_KEYS = ["up", "down", "left", "right", "action", "secondary"];

const FRIENDLY = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  NumpadEnter: "Num Enter",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Comma: ",",
};

export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return bindings.map((row) => ({ ...row }));
}

export function formatCode(code) {
  if (!code) return "—";
  if (FRIENDLY[code]) return FRIENDLY[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

function directionFromRow(codes, row) {
  if (row.up && codes.has(row.up)) return "up";
  if (row.down && codes.has(row.down)) return "down";
  if (row.left && codes.has(row.left)) return "left";
  if (row.right && codes.has(row.right)) return "right";
  return null;
}

export function readKeyboard(codes, bindings = DEFAULT_BINDINGS) {
  const down = codes instanceof Set ? codes : new Set(codes);
  return bindings.map((row) => ({
    direction: directionFromRow(down, row),
    action: !!(row.action && down.has(row.action)),
    secondary: !!(row.secondary && down.has(row.secondary)),
    source: "keyboard",
  }));
}

function buttonPressed(buttons, index) {
  const button = buttons && buttons[index];
  if (!button) return false;
  if (typeof button === "boolean") return button;
  return !!button.pressed;
}

function stickDirection(x, y) {
  const ax = Math.abs(x || 0);
  const ay = Math.abs(y || 0);
  if (ax < 0.5 && ay < 0.5) return null;
  if (ay >= ax) return y < 0 ? "up" : "down";
  return x < 0 ? "left" : "right";
}

/**
 * Browser Gamepad snapshot, or a mock of the same shape:
 * `{ connected, axes: [x, y], buttons: [{ pressed }] }`.
 * Standard mapping: A=0, B=1, Start=9, D-pad=12..15.
 */
export function readGamepad(pad) {
  if (!pad || !pad.connected) return null;
  const buttons = pad.buttons || [];
  let direction = null;
  if (buttonPressed(buttons, 12)) direction = "up";
  else if (buttonPressed(buttons, 13)) direction = "down";
  else if (buttonPressed(buttons, 14)) direction = "left";
  else if (buttonPressed(buttons, 15)) direction = "right";
  else direction = stickDirection(pad.axes?.[0] ?? 0, pad.axes?.[1] ?? 0);

  return {
    direction,
    action: buttonPressed(buttons, 0),
    secondary: buttonPressed(buttons, 1),
    pause: buttonPressed(buttons, 9),
    connected: true,
    source: "gamepad",
  };
}

/** A connected pad replaces that player's keyboard for as long as it is plugged in. */
export function resolvePlayers(keyboardPlayers, gamepads = []) {
  return keyboardPlayers.map((kb, index) => {
    const pad = readGamepad(gamepads[index]);
    if (pad) {
      return {
        direction: pad.direction,
        action: pad.action,
        secondary: pad.secondary,
        source: "gamepad",
      };
    }
    return {
      direction: kb.direction,
      action: kb.action,
      secondary: kb.secondary,
      source: "keyboard",
    };
  });
}

export function pausePressed(codes, gamepads = []) {
  const down = codes instanceof Set ? codes : new Set(codes);
  if (down.has("Escape")) return true;
  return gamepads.some((pad) => readGamepad(pad)?.pause);
}

export function rebind(bindings, player, action, code) {
  if (!ACTION_KEYS.includes(action)) return cloneBindings(bindings);
  if (!code || player < 0 || player > 3) return cloneBindings(bindings);
  const next = cloneBindings(bindings);
  for (const row of next) {
    for (const key of ACTION_KEYS) {
      if (row[key] === code) row[key] = null;
    }
  }
  next[player][action] = code;
  return next;
}
