/**
 * Match rules for Light Cycle Quad.
 * No DOM and no canvas: a 60 Hz caller feeds `tick`, tests call it directly.
 *
 * Movement resolves every cycle that is due this frame together. A cell vacated
 * with the trail still on becomes a wall for anyone else moving this same frame,
 * so head-on swaps are mutual crashes. If every cycle still in the round dies
 * on that frame, the round is a draw. Otherwise the last one riding scores.
 */

import { chooseBotDirection } from "./bot.js";
import {
  BASE_MOVE_INTERVAL,
  BOOST_DURATION,
  BOOST_MOVE_INTERVAL,
  COUNTDOWN_FRAMES,
  DEFAULT_ROUNDS_TO_WIN,
  DEFAULT_STARTS,
  DIR_DELTA,
  GAP_DURATION,
  GRID_H,
  GRID_W,
  MAX_JUMP_CHARGES,
  PLAYER_COUNT,
  POWERUP_MAX,
  POWERUP_SPAWN_INTERVAL,
  POWERUP_TYPES,
  ROUND_END_FRAMES,
  cellIndex,
  inBounds,
  isOpposite,
} from "./constants.js";
import { createRng } from "./rng.js";

function normalizeSlot(slot) {
  if (slot === "human" || slot === "bot" || slot === "off") return slot;
  if (slot && (slot.kind === "human" || slot.kind === "bot" || slot.kind === "off")) return slot.kind;
  return "bot";
}

function alivePlayers(match) {
  return match.players.filter((player) => player.participating && player.alive);
}

function applyPowerup(player, type) {
  if (type === "boost") {
    player.boostTimer = BOOST_DURATION;
    if (player.moveTimer > BOOST_MOVE_INTERVAL) player.moveTimer = BOOST_MOVE_INTERVAL;
  } else if (type === "gap") {
    player.gapTimer = GAP_DURATION;
  } else if (type === "jump") {
    player.jumpCharges = Math.min(MAX_JUMP_CHARGES, player.jumpCharges + 1);
  }
}

function takePowerup(match, x, y) {
  const index = match.powerups.findIndex((item) => item.x === x && item.y === y);
  if (index < 0) return null;
  const [item] = match.powerups.splice(index, 1);
  return item.type;
}

function spawnPowerup(match) {
  if (match.powerups.length >= POWERUP_MAX) return;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const x = match.rng.int(GRID_W);
    const y = match.rng.int(GRID_H);
    if (match.grid[cellIndex(x, y)]) continue;
    if (match.powerups.some((item) => item.x === x && item.y === y)) continue;
    const crowded = match.players.some((player) => {
      if (!player.participating || !player.alive) return false;
      return Math.abs(player.x - x) + Math.abs(player.y - y) <= 3;
    });
    if (crowded) continue;
    const type = POWERUP_TYPES[match.rng.int(POWERUP_TYPES.length)];
    match.powerups.push({ x, y, type });
    return;
  }
}

function finishRound(match, alive) {
  if (alive.length === 1) {
    const winner = alive[0].id;
    match.scores[winner] += 1;
    match.result = { kind: "win", player: winner };
  } else {
    match.result = { kind: "draw", player: null };
  }
  match.events.push({ type: "round", result: match.result });

  const leader = match.scores.findIndex((score) => score >= match.roundsToWin);
  if (leader >= 0) {
    match.winner = leader;
    match.phase = "matchEnd";
    match.timer = 0;
    match.events.push({ type: "match", winner: leader });
    return;
  }

  if (match.roundEndFrames <= 0) {
    beginRound(match, false);
    return;
  }
  match.phase = "roundEnd";
  match.timer = match.roundEndFrames;
}

function resolveMovement(match) {
  const movers = [];

  for (const player of match.players) {
    if (!player.participating || !player.alive) continue;
    if (player.kind === "bot") {
      const choice = chooseBotDirection(match, player);
      player.pendingDir = choice && !isOpposite(player.dir, choice) ? choice : null;
    }

    const boosted = player.boostTimer > 0;
    const gapped = player.gapTimer > 0;
    if (player.boostTimer > 0) player.boostTimer -= 1;
    if (player.gapTimer > 0) player.gapTimer -= 1;
    player.moveTimer -= 1;
    if (player.moveTimer > 0) continue;

    if (player.pendingDir && !isOpposite(player.dir, player.pendingDir) && player.pendingDir !== player.dir) {
      player.dir = player.pendingDir;
    }
    player.pendingDir = null;

    const jumping = player.jumpCharges > 0;
    if (jumping) player.jumpCharges -= 1;
    const delta = DIR_DELTA[player.dir];
    const steps = jumping ? 2 : 1;
    player.intent = {
      x: player.x + delta.x * steps,
      y: player.y + delta.y * steps,
      leaveTrail: !gapped,
    };
    player.moveTimer = boosted ? BOOST_MOVE_INTERVAL : BASE_MOVE_INTERVAL;
    movers.push(player);
  }

  const destCount = new Map();
  for (const player of movers) {
    const key = `${player.intent.x},${player.intent.y}`;
    destCount.set(key, (destCount.get(key) || 0) + 1);
  }

  const stationary = new Set();
  for (const player of match.players) {
    if (!player.participating || !player.alive || movers.includes(player)) continue;
    stationary.add(`${player.x},${player.y}`);
  }

  const vacated = new Map();
  for (const player of movers) {
    if (player.intent.leaveTrail) vacated.set(`${player.x},${player.y}`, player.id + 1);
  }

  const deaths = new Set();
  for (const player of movers) {
    const { x, y } = player.intent;
    const key = `${x},${y}`;
    const blocked =
      !inBounds(x, y) ||
      (inBounds(x, y) && match.grid[cellIndex(x, y)] !== 0) ||
      (destCount.get(key) || 0) > 1 ||
      stationary.has(key) ||
      vacated.has(key);
    if (blocked) deaths.add(player.id);
  }

  for (const player of movers) {
    if (!player.intent.leaveTrail) continue;
    if (!inBounds(player.x, player.y)) continue;
    match.grid[cellIndex(player.x, player.y)] = player.id + 1;
  }

  for (const player of movers) {
    if (deaths.has(player.id)) {
      player.alive = false;
      player.intent = null;
      match.events.push({ type: "crash", player: player.id });
      continue;
    }
    player.x = player.intent.x;
    player.y = player.intent.y;
    player.intent = null;
    const picked = takePowerup(match, player.x, player.y);
    if (picked) {
      applyPowerup(player, picked);
      match.events.push({ type: "pickup", player: player.id, power: picked });
    }
  }

  const alive = alivePlayers(match);
  if (alive.length < 2) finishRound(match, alive);
}

function stepPlay(match) {
  const alive = alivePlayers(match);
  if (alive.length < 2) {
    finishRound(match, alive);
    return;
  }
  resolveMovement(match);
  if (match.phase !== "playing") return;
  match.spawnTimer -= 1;
  if (match.spawnTimer <= 0) {
    match.spawnTimer = POWERUP_SPAWN_INTERVAL;
    spawnPowerup(match);
  }
}

function beginRound(match, first) {
  if (!first) match.roundNumber += 1;
  match.grid = new Uint8Array(GRID_W * GRID_H);
  match.powerups = first ? match.initialPowerups.map((item) => ({ ...item })) : [];
  match.spawnTimer = POWERUP_SPAWN_INTERVAL;
  match.frame = 0;
  match.result = null;
  match.players = [];

  for (let id = 0; id < PLAYER_COUNT; id += 1) {
    const start = match.starts[id];
    const kind = match.slots[id];
    const effects = first ? match.initialEffects[id] || {} : {};
    const participating = kind !== "off";
    const boostTimer = effects.boostTimer || 0;
    match.players.push({
      id,
      kind,
      x: start.x,
      y: start.y,
      dir: start.dir,
      alive: participating,
      participating,
      moveTimer: boostTimer > 0 ? BOOST_MOVE_INTERVAL : BASE_MOVE_INTERVAL,
      pendingDir: null,
      boostTimer,
      gapTimer: effects.gapTimer || 0,
      jumpCharges: effects.jumpCharges || 0,
      intent: null,
    });
  }

  if (first && match.initialTrails) {
    for (const trail of match.initialTrails) {
      if (inBounds(trail.x, trail.y)) match.grid[cellIndex(trail.x, trail.y)] = trail.owner;
    }
  }

  const participants = match.players.filter((player) => player.participating);
  if (participants.length === 0) {
    match.phase = "matchEnd";
    match.result = { kind: "draw", player: null };
    match.winner = null;
    match.timer = 0;
    return;
  }

  if (match.countdownFrames > 0) {
    match.phase = "countdown";
    match.timer = match.countdownFrames;
  } else {
    match.phase = "playing";
    match.timer = 0;
  }
}

export function createMatch(options = {}) {
  const slots = [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    if (options.slots && options.slots[i] != null) slots.push(normalizeSlot(options.slots[i]));
    else slots.push(i === 0 ? "human" : "bot");
  }

  const starts = [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    starts.push({ ...DEFAULT_STARTS[i], ...(options.starts ? options.starts[i] : null) });
  }

  const match = {
    seed: options.seed ?? 1,
    rng: createRng(options.seed ?? 1),
    roundsToWin: options.roundsToWin ?? DEFAULT_ROUNDS_TO_WIN,
    countdownFrames: options.countdownFrames ?? COUNTDOWN_FRAMES,
    roundEndFrames: options.roundEndFrames ?? ROUND_END_FRAMES,
    slots,
    starts,
    initialPowerups: (options.powerups || []).map((item) => ({ ...item })),
    initialTrails: (options.trails || []).map((item) => ({ ...item })),
    initialEffects: options.effects || {},
    scores: [0, 0, 0, 0],
    roundNumber: 1,
    phase: "countdown",
    timer: 0,
    result: null,
    winner: null,
    grid: new Uint8Array(GRID_W * GRID_H),
    players: [],
    powerups: [],
    spawnTimer: POWERUP_SPAWN_INTERVAL,
    frame: 0,
    events: [],
  };

  beginRound(match, true);
  return match;
}

/** Queue a 90-degree turn. A reverse command is ignored. */
export function queueDirection(match, playerId, dir) {
  const player = match.players[playerId];
  if (!player || !player.participating || !player.alive) return;
  if (match.phase !== "playing" && match.phase !== "countdown") return;
  if (!DIR_DELTA[dir]) return;
  if (isOpposite(player.dir, dir)) return;
  if (dir === player.dir) {
    player.pendingDir = null;
    return;
  }
  player.pendingDir = dir;
}

export function skipRoundEnd(match) {
  if (match.phase !== "roundEnd") return;
  beginRound(match, false);
}

export function getCell(match, x, y) {
  if (!inBounds(x, y)) return -1;
  return match.grid[cellIndex(x, y)];
}

export function tick(match) {
  match.events = [];

  if (match.phase === "countdown") {
    match.timer -= 1;
    const shown = Math.ceil((match.timer + 1) / 60);
    const next = Math.ceil(Math.max(match.timer, 0) / 60);
    if (match.timer <= 0) {
      match.phase = "playing";
      match.frame = 0;
      match.events.push({ type: "go" });
    } else if (next !== shown && next > 0) {
      match.events.push({ type: "countdown", value: next });
    }
    return match;
  }

  if (match.phase === "roundEnd") {
    match.timer -= 1;
    if (match.timer <= 0) beginRound(match, false);
    return match;
  }

  if (match.phase === "playing") {
    match.frame += 1;
    stepPlay(match);
  }

  return match;
}

export function standings(match) {
  return match.scores
    .map((score, player) => ({
      player,
      score,
      kind: match.slots[player],
    }))
    .sort((a, b) => b.score - a.score || a.player - b.player);
}

export { GRID_W, GRID_H, BASE_MOVE_INTERVAL, BOOST_MOVE_INTERVAL, PLAYER_COUNT };
