import { createAudio } from "./audio.js";
import { CELL, PLAYER_COLORS, PLAYER_COUNT, VIEW_H, VIEW_W } from "../core/constants.js";
import { createMatch, queueDirection, skipRoundEnd, tick } from "../core/game.js";
import { readGamepad, readKeyboard, rebind, resolvePlayers } from "../core/input.js";
import { ACTION_ROWS, PAUSE_ITEMS, SETTINGS_ITEMS, render } from "./render.js";
import { loadBindings, loadSettings, saveBindings, saveSettings } from "./storage.js";

const STEP_MS = 1000 / 60;
const ROUND_OPTIONS = [1, 3, 5, 7, 10];

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const audio = createAudio();
const settings = loadSettings();
let bindings = loadBindings();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);

const keys = new Set();
const latched = new Set();
const cover = new Image();
cover.src = "assets/cover.jpg";
const icon = new Image();
icon.src = "assets/icon.jpg";

const state = {
  screen: "title",
  settingsBack: "title",
  slots: ["bot", "bot", "bot", "bot"],
  match: null,
  paused: false,
  menuIndex: 0,
  pauseIndex: 0,
  controlIndex: 0,
  rebinding: null,
  pads: [false, false, false, false],
  toast: "",
  toastTimer: 0,
  uiTime: 0,
  particles: [],
  shake: 0,
  settings,
  bindings,
};

let lastCue = null;
let sawCountdown = false;
const prev = {
  keys: new Set(),
  action: [false, false, false, false],
  secondary: [false, false, false, false],
  start: [false, false, false, false],
  dir: null,
};

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pollPads() {
  const list = [null, null, null, null];
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    const pad = pads && pads[i];
    if (pad && pad.connected) {
      list[i] = pad;
      state.pads[i] = true;
    } else {
      state.pads[i] = false;
    }
  }
  return list;
}

function freshSlots() {
  state.slots = ["bot", "bot", "bot", "bot"];
}

function startMatch() {
  const seed = (Date.now() ^ (Math.floor(Math.random() * 0x7fffffff))) >>> 0;
  state.match = createMatch({
    seed,
    slots: state.slots.slice(),
    roundsToWin: settings.roundsToWin,
  });
  state.screen = "play";
  state.paused = false;
  state.particles = [];
  state.shake = 0;
  lastCue = null;
  sawCountdown = false;
  audio.unlock();
}

function toast(text) {
  state.toast = text;
  state.toastTimer = 120;
}

function burst(player) {
  const color = PLAYER_COLORS[player.id];
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const speed = 1.2 + (i % 4) * 0.45;
    state.particles.push({
      x: player.x * CELL + CELL / 2,
      y: player.y * CELL + CELL / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 26,
      max: 26,
      color,
    });
  }
  state.shake = 8;
}

function watchMatchAudio(match) {
  if (!match) return;
  if (match.phase === "countdown") {
    const cue = Math.max(1, Math.ceil(match.timer / 60));
    if (cue !== lastCue) {
      audio.countdown(cue);
      lastCue = cue;
    }
    sawCountdown = true;
  } else if (sawCountdown && match.phase === "playing") {
    audio.go();
    sawCountdown = false;
    lastCue = null;
  }
  const events = match.events || [];
  const matchOver = events.some((event) => event.type === "match");
  for (const event of events) {
    if (event.type === "crash") {
      audio.ko();
      const player = match.players[event.player];
      if (player) burst(player);
    } else if (event.type === "pickup") audio.pickup(event.power);
    else if (event.type === "round" && !matchOver) {
      if (event.result.kind === "win") audio.roundWin();
      else audio.draw();
    } else if (event.type === "match") audio.matchWin();
  }
}

function menuDirection(resolved) {
  for (const player of resolved) {
    if (player.direction) return player.direction;
  }
  if (keys.has("ArrowUp") || keys.has("KeyW")) return "up";
  if (keys.has("ArrowDown") || keys.has("KeyS")) return "down";
  if (keys.has("ArrowLeft") || keys.has("KeyA")) return "left";
  if (keys.has("ArrowRight") || keys.has("KeyD")) return "right";
  return null;
}

function edgeDirection(resolved) {
  const dir = menuDirection(resolved);
  if (dir === prev.dir) return null;
  prev.dir = dir;
  return dir;
}

function changeRounds(delta) {
  let index = ROUND_OPTIONS.indexOf(settings.roundsToWin);
  if (index < 0) index = ROUND_OPTIONS.findIndex((n) => n >= settings.roundsToWin);
  if (index < 0) index = 2;
  index = (index + delta + ROUND_OPTIONS.length) % ROUND_OPTIONS.length;
  settings.roundsToWin = ROUND_OPTIONS[index];
  if (state.match) {
    state.match.roundsToWin = settings.roundsToWin;
    const leader = state.match.scores.findIndex((score) => score >= settings.roundsToWin);
    if (leader >= 0 && state.match.phase !== "matchEnd") {
      state.match.winner = leader;
      state.match.phase = "matchEnd";
    }
  }
  saveSettings(settings);
}

function step() {
  state.uiTime += 1;
  if (state.toastTimer > 0) state.toastTimer -= 1;
  state.particles.forEach((bit) => {
    bit.x += bit.vx;
    bit.y += bit.vy;
    bit.life -= 1;
  });
  state.particles = state.particles.filter((bit) => bit.life > 0);
  state.shake *= 0.86;
  if (state.shake < 0.15) state.shake = 0;

  const gamepads = pollPads();
  const effective = new Set(keys);
  latched.forEach((code) => effective.add(code));
  const resolved = resolvePlayers(readKeyboard(effective, bindings), gamepads);
  const held = resolvePlayers(readKeyboard(keys, bindings), gamepads);
  const down = (code) => effective.has(code) && !prev.keys.has(code);
  const confirm = down("Enter") || down("Space");
  const esc = down("Escape");
  const mute = down("KeyM");
  const action = resolved.map((player, i) => player.action && !prev.action[i]);
  const secondary = resolved.map((player, i) => player.secondary && !prev.secondary[i]);
  const start = [0, 1, 2, 3].map((i) => {
    const pressed = !!readGamepad(gamepads[i])?.pause;
    const edge = pressed && !prev.start[i];
    prev.start[i] = pressed;
    return edge;
  });
  const startEdge = start.some(Boolean);
  const actionAny = action.some(Boolean);
  const dir = state.screen === "play" && !state.paused ? null : edgeDirection(resolved);

  if (mute && !state.rebinding) {
    settings.muted = !settings.muted;
    audio.setMuted(settings.muted);
    saveSettings(settings);
    audio.unlock();
  }

  if (state.screen === "title") {
    if (confirm || startEdge) {
      freshSlots();
      state.screen = "join";
      audio.unlock();
    } else if (esc) openSettings("title");
  } else if (state.screen === "join") {
    for (let i = 0; i < PLAYER_COUNT; i += 1) {
      if (action[i]) state.slots[i] = "human";
      else if (secondary[i]) {
        const slot = state.slots[i];
        state.slots[i] = slot === "human" ? "bot" : slot === "bot" ? "off" : "bot";
      }
    }
    if (esc) state.screen = "title";
    else if (confirm || startEdge) {
      const active = state.slots.filter((slot) => slot !== "off").length;
      if (active < 2) toast("Need at least two cycles");
      else startMatch();
    }
  } else if (state.screen === "settings") {
    if (dir === "up") state.menuIndex = (state.menuIndex + SETTINGS_ITEMS.length - 1) % SETTINGS_ITEMS.length;
    if (dir === "down") state.menuIndex = (state.menuIndex + 1) % SETTINGS_ITEMS.length;
    const item = SETTINGS_ITEMS[state.menuIndex].id;
    if (item === "volume" && (dir === "left" || dir === "right")) {
      const delta = dir === "left" ? -0.1 : 0.1;
      settings.volume = Math.min(1, Math.max(0, Math.round((settings.volume + delta) * 10) / 10));
      audio.setVolume(settings.volume);
      saveSettings(settings);
    }
    if (item === "rounds" && (dir === "left" || dir === "right")) changeRounds(dir === "right" ? 1 : -1);
    if ((confirm || actionAny || startEdge) && item === "mute") {
      settings.muted = !settings.muted;
      audio.setMuted(settings.muted);
      saveSettings(settings);
    }
    if ((confirm || actionAny || startEdge) && item === "controls") {
      state.screen = "controls";
      state.controlIndex = 0;
      state.rebinding = null;
    }
    if ((confirm || actionAny || startEdge) && item === "back") closeSettings();
    if (esc) closeSettings();
  } else if (state.screen === "controls") {
    const total = PLAYER_COUNT * ACTION_ROWS.length;
    if (dir === "up") state.controlIndex = (state.controlIndex + total - 1) % total;
    if (dir === "down") state.controlIndex = (state.controlIndex + 1) % total;
    if ((confirm || actionAny) && !state.rebinding) {
      const player = Math.floor(state.controlIndex / ACTION_ROWS.length);
      const actionName = ACTION_ROWS[state.controlIndex % ACTION_ROWS.length][0];
      state.rebinding = { player, action: actionName };
    }
    if (esc && !state.rebinding) state.screen = "settings";
  } else if (state.screen === "play" && state.match) {
    stepPlay(resolved, { confirm, esc, startEdge, actionAny, dir });
  }

  prev.keys = new Set(keys);
  prev.action = held.map((player) => player.action);
  prev.secondary = held.map((player) => player.secondary);
  latched.clear();
  state.bindings = bindings;
}

function openSettings(back) {
  state.settingsBack = back;
  state.menuIndex = 0;
  state.screen = "settings";
  audio.unlock();
}

function closeSettings() {
  state.screen = state.settingsBack;
  if (state.settingsBack === "play") state.paused = true;
}

function stepPlay(resolved, edge) {
  const match = state.match;
  if (state.paused) {
    if (edge.dir === "up") state.pauseIndex = (state.pauseIndex + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
    if (edge.dir === "down") state.pauseIndex = (state.pauseIndex + 1) % PAUSE_ITEMS.length;
    if (edge.esc) {
      state.paused = false;
      return;
    }
    if (edge.confirm || edge.startEdge || edge.actionAny) activatePause();
    return;
  }

  if (match.phase === "matchEnd") {
    if (edge.confirm || edge.startEdge || edge.actionAny) startMatch();
    else if (edge.esc) {
      state.screen = "title";
      state.match = null;
    }
    return;
  }

  if (edge.esc || edge.startEdge) {
    state.paused = true;
    state.pauseIndex = 0;
    prev.dir = menuDirection(resolved);
    return;
  }

  if (match.phase === "playing" || match.phase === "countdown") {
    for (let i = 0; i < PLAYER_COUNT; i += 1) {
      if (resolved[i].direction) queueDirection(match, i, resolved[i].direction);
    }
  }

  let skipped = false;
  if (match.phase === "roundEnd" && (edge.confirm || edge.actionAny)) {
    skipRoundEnd(match);
    skipped = true;
  }
  if (!skipped && match.phase !== "matchEnd") {
    tick(match);
    watchMatchAudio(match);
  }
}

function activatePause() {
  const item = PAUSE_ITEMS[state.pauseIndex].id;
  if (item === "resume") state.paused = false;
  else if (item === "settings") openSettings("play");
  else {
    state.screen = "title";
    state.match = null;
    state.paused = false;
  }
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (!event.metaKey && !event.ctrlKey && !event.altKey) event.preventDefault();
  audio.unlock();
  if (state.rebinding) {
    if (event.code !== "Escape") {
      bindings = rebind(bindings, state.rebinding.player, state.rebinding.action, event.code);
      saveBindings(bindings);
      state.bindings = bindings;
    }
    state.rebinding = null;
    keys.delete(event.code);
    return;
  }
  keys.add(event.code);
  latched.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});

canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  audio.unlock();
});

function frame(now) {
  if (!frame.last) frame.last = now;
  let acc = frame.acc || 0;
  acc += Math.min(100, now - frame.last);
  frame.last = now;
  if (acc > 250) acc = 250;
  while (acc >= STEP_MS) {
    step();
    acc -= STEP_MS;
  }
  frame.acc = acc;
  render(ctx, {
    screen: state.screen,
    settingsBack: state.settingsBack,
    slots: state.slots,
    match: state.match,
    paused: state.paused,
    menuIndex: state.menuIndex,
    pauseIndex: state.pauseIndex,
    controlIndex: state.controlIndex,
    rebinding: state.rebinding,
    pads: state.pads,
    toast: state.toast,
    toastTimer: state.toastTimer,
    uiTime: state.uiTime,
    particles: state.particles,
    shake: state.shake,
    settings,
    bindings,
    cover,
    icon,
  });
  requestAnimationFrame(frame);
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
canvas.focus();
requestAnimationFrame(frame);
