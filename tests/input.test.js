import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BINDINGS,
  pausePressed,
  readGamepad,
  readKeyboard,
  rebind,
  resolvePlayers,
} from "../src/core/input.js";

function pad({ connected = true, axes = [0, 0], pressed = {} } = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  for (const [index, isPressed] of Object.entries(pressed)) {
    buttons[Number(index)] = { pressed: isPressed };
  }
  return { connected, axes, buttons };
}

test("default keyboard bindings match the four local seats", () => {
  const cases = [
    [{ KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right", KeyF: "action", KeyG: "secondary" }, 0],
    [{ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Slash: "action", Period: "secondary" }, 1],
    [{ KeyI: "up", KeyK: "down", KeyJ: "left", KeyL: "right", Semicolon: "action", Quote: "secondary" }, 2],
    [{ Numpad8: "up", Numpad5: "down", Numpad4: "left", Numpad6: "right", Numpad0: "action", NumpadEnter: "secondary" }, 3],
  ];
  for (const [spec, index] of cases) {
    for (const [code, field] of Object.entries(spec)) {
      const [player] = readKeyboard(new Set([code])).filter((row, i) => i === index);
      if (field === "action" || field === "secondary") {
        assert.equal(player[field], true, `${code} -> P${index + 1} ${field}`);
        assert.equal(player.direction, null);
      } else {
        assert.equal(player.direction, field, `${code} -> P${index + 1}`);
      }
      assert.equal(player.source, "keyboard");
    }
  }
  assert.equal(DEFAULT_BINDINGS[1].action, "Slash");
  assert.equal(DEFAULT_BINDINGS[3].secondary, "NumpadEnter");
});

test("keyboard direction priority is up, down, left, then right", () => {
  const [player] = readKeyboard(new Set(["KeyW", "KeyA"]));
  assert.equal(player.direction, "up");
});

test("a connected gamepad overrides that player's keyboard", () => {
  const keyboard = readKeyboard(new Set(["KeyW", "KeyF"]));
  const pads = [
    pad({ axes: [0.9, 0], pressed: { 1: true } }),
    null,
    null,
    null,
  ];
  const resolved = resolvePlayers(keyboard, pads);
  assert.equal(resolved[0].source, "gamepad");
  assert.equal(resolved[0].direction, "right");
  assert.equal(resolved[0].action, false);
  assert.equal(resolved[0].secondary, true);
  assert.equal(resolved[1].source, "keyboard");
  assert.equal(resolved[1].direction, null);
});

test("a disconnected pad falls back to the keyboard", () => {
  const keyboard = readKeyboard(new Set(["ArrowLeft"]));
  const resolved = resolvePlayers(keyboard, [pad({ connected: false, axes: [1, 0] }), null, null, null]);
  assert.equal(resolved[0].source, "keyboard");
  assert.equal(resolved[1].direction, "left");
  assert.equal(readGamepad({ connected: false, axes: [0, 0], buttons: [] }), null);
});

test("D-pad wins over the stick, and the stick uses the stronger axis", () => {
  const dpad = readGamepad(pad({ axes: [0, 0.95], pressed: { 14: true } }));
  assert.equal(dpad.direction, "left");
  const stick = readGamepad(pad({ axes: [0.2, -0.8] }));
  assert.equal(stick.direction, "up");
  const dead = readGamepad(pad({ axes: [0.2, -0.2] }));
  assert.equal(dead.direction, null);
  const buttons = readGamepad(pad({ pressed: { 0: true, 9: true } }));
  assert.equal(buttons.action, true);
  assert.equal(buttons.pause, true);
});

test("Escape or Start pauses, and remapping steals a shared key", () => {
  assert.equal(pausePressed(new Set(["Escape"]), []), true);
  assert.equal(pausePressed(new Set(), [pad({ pressed: { 9: true } })]), true);
  assert.equal(pausePressed(new Set(["KeyM"]), [null]), false);

  const next = rebind(DEFAULT_BINDINGS, 1, "up", "KeyW");
  assert.equal(next[1].up, "KeyW");
  assert.equal(next[0].up, null);
  const players = readKeyboard(new Set(["KeyW"]), next);
  assert.equal(players[0].direction, null);
  assert.equal(players[1].direction, "up");
});
