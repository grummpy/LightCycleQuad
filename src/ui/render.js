import {
  CELL,
  GRID_H,
  GRID_W,
  HUD_H,
  PLAYER_COLORS,
  PLAYER_NAMES,
  VIEW_H,
  VIEW_W,
} from "../core/constants.js";
import { formatCode } from "../core/input.js";
import { getCell, standings } from "../core/game.js";

const INK = "#e7f4ff";
const DIM = "#8ea6bb";
const PANEL = "#101820";

const SETTINGS_ITEMS = [
  { id: "volume", label: "Volume" },
  { id: "rounds", label: "First to" },
  { id: "mute", label: "Mute" },
  { id: "controls", label: "Controls" },
  { id: "back", label: "Back" },
];

const PAUSE_ITEMS = [
  { id: "resume", label: "Resume" },
  { id: "settings", label: "Settings" },
  { id: "quit", label: "Quit to title" },
];

const ACTION_ROWS = [
  ["up", "Up"],
  ["down", "Down"],
  ["left", "Left"],
  ["right", "Right"],
  ["action", "Action"],
  ["secondary", "Secondary"],
];

export function arenaRect() {
  const w = GRID_W * CELL;
  const h = GRID_H * CELL;
  return {
    x: Math.floor((VIEW_W - w) / 2),
    y: HUD_H + Math.floor((VIEW_H - HUD_H - h) / 2),
    w,
    h,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function fillRound(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px "Segoe UI", "Trebuchet MS", sans-serif`;
  ctx.textBaseline = "middle";
}

function coverCrop(ctx, image) {
  if (!image || !image.complete || !image.naturalWidth) return false;
  const scale = Math.max(VIEW_W / image.naturalWidth, VIEW_H / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h);
  return true;
}

function drawPadIcon(ctx, x, y, on) {
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.28;
  fillRound(ctx, x, y, 22, 14, 3, on ? "#163044" : "#1a222c");
  ctx.strokeStyle = on ? "#7fdfff" : "#44515e";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 0.5, y + 0.5, 21, 13, 3);
  ctx.stroke();
  ctx.fillStyle = on ? "#d8f6ff" : "#66788a";
  ctx.fillRect(x + 4, y + 6, 3, 3);
  ctx.fillRect(x + 13, y + 4, 3, 3);
  ctx.fillRect(x + 16, y + 6, 3, 3);
  ctx.restore();
}

function drawToast(ctx, view) {
  if (!view.toast || view.toastTimer <= 0) return;
  font(ctx, 20);
  const text = view.toast;
  const w = ctx.measureText(text).width + 36;
  fillRound(ctx, (VIEW_W - w) / 2, VIEW_H - 78, w, 40, 8, "rgba(8, 12, 18, 0.92)");
  ctx.fillStyle = "#ffd27a";
  ctx.textAlign = "center";
  ctx.fillText(text, VIEW_W / 2, VIEW_H - 58);
}

function drawTitle(ctx, view) {
  const drew = coverCrop(ctx, view.cover);
  if (!drew) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#071018");
    g.addColorStop(1, "#140816");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.fillStyle = "rgba(3, 6, 12, 0.68)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (view.icon && view.icon.complete && view.icon.naturalWidth) {
    ctx.save();
    roundRect(ctx, VIEW_W / 2 - 36, 118, 72, 72, 12);
    ctx.clip();
    ctx.drawImage(view.icon, VIEW_W / 2 - 36, 118, 72, 72);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.shadowColor = "#3ee0ff";
  ctx.shadowBlur = 22;
  font(ctx, 76, 800);
  ctx.fillStyle = "#f4fbff";
  ctx.letterSpacing = "8px";
  ctx.fillText("LIGHT CYCLE", VIEW_W / 2, 280);
  ctx.fillStyle = "#7af0ff";
  ctx.fillText("QUAD", VIEW_W / 2, 358);
  ctx.restore();

  ctx.letterSpacing = "0px";
  font(ctx, 20, 600);
  ctx.fillStyle = DIM;
  ctx.textAlign = "center";
  ctx.fillText("Four cycles. One grid. Last light running takes the round.", VIEW_W / 2, 430);

  const blink = Math.floor(view.uiTime / 32) % 2 === 0;
  font(ctx, 28, 800);
  ctx.fillStyle = blink ? "#ffffff" : "rgba(255,255,255,0.35)";
  ctx.fillText("PRESS ENTER / START", VIEW_W / 2, 520);

  font(ctx, 16, 600);
  ctx.fillStyle = "#9eb4c6";
  ctx.fillText("Esc  settings     M  mute", VIEW_W / 2, 575);
  ctx.fillText("Local versus  ·  keyboard or gamepad  ·  bots welcome", VIEW_W / 2, 608);
}

function slotLabel(kind) {
  if (kind === "human") return "READY";
  if (kind === "off") return "OFF";
  return "BOT";
}

function drawJoin(ctx, view) {
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  font(ctx, 42, 800);
  ctx.fillStyle = INK;
  ctx.fillText("JOIN", VIEW_W / 2, 78);
  font(ctx, 18, 600);
  ctx.fillStyle = DIM;
  ctx.fillText("Action claims a seat. Secondary cycles bot / off. Enter starts.", VIEW_W / 2, 118);

  const gap = 24;
  const w = 260;
  const total = w * 4 + gap * 3;
  const x0 = (VIEW_W - total) / 2;
  for (let i = 0; i < 4; i += 1) {
    const x = x0 + i * (w + gap);
    const kind = view.slots[i];
    fillRound(ctx, x, 180, w, 340, 16, "#0d141c");
    ctx.strokeStyle = PLAYER_COLORS[i];
    ctx.lineWidth = 3;
    roundRect(ctx, x + 1.5, 181.5, w - 3, 337, 16);
    ctx.stroke();
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillRect(x + 24, 210, w - 48, 8);
    font(ctx, 32, 800);
    ctx.fillStyle = INK;
    ctx.fillText(PLAYER_NAMES[i], x + w / 2, 270);
    font(ctx, 28, 800);
    ctx.fillStyle = kind === "off" ? DIM : PLAYER_COLORS[i];
    ctx.fillText(slotLabel(kind), x + w / 2, 330);
    font(ctx, 16, 600);
    ctx.fillStyle = DIM;
    const hint = kind === "human" ? "Seat taken" : kind === "off" ? "Not racing" : "Will ride itself";
    ctx.fillText(hint, x + w / 2, 378);
    drawPadIcon(ctx, x + w / 2 - 11, 420, view.pads[i]);
    font(ctx, 14, 600);
    ctx.fillStyle = view.pads[i] ? "#b7e9ff" : "#5e7284";
    ctx.fillText(view.pads[i] ? "Pad connected" : "Keyboard", x + w / 2, 460);
  }

  font(ctx, 16, 600);
  ctx.fillStyle = "#a9c0d2";
  ctx.fillText("P1 WASD   P2 Arrows   P3 IJKL   P4 Numpad     ·     gamepad A joins, B cycles", VIEW_W / 2, 580);
  ctx.fillStyle = DIM;
  ctx.fillText("Esc back to title", VIEW_W / 2, 620);
  drawToast(ctx, view);
}

function drawSettings(ctx, view) {
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  font(ctx, 42, 800);
  ctx.fillStyle = INK;
  ctx.fillText("SETTINGS", VIEW_W / 2, 110);
  font(ctx, 16, 600);
  ctx.fillStyle = DIM;
  ctx.fillText(view.settingsBack === "play" ? "Match paused" : "Saved on this machine", VIEW_W / 2, 152);

  SETTINGS_ITEMS.forEach((item, index) => {
    const y = 230 + index * 68;
    const selected = index === view.menuIndex;
    fillRound(ctx, 390, y, 500, 54, 10, selected ? "#163044" : "#101820");
    if (selected) {
      ctx.strokeStyle = "#3ee0ff";
      ctx.lineWidth = 2;
      roundRect(ctx, 391, y + 1, 498, 52, 10);
      ctx.stroke();
    }
    font(ctx, 22, 700);
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.fillText(item.label, 420, y + 27);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9be7ff";
    ctx.fillText(settingsValue(view, item.id), 860, y + 27);
  });

  ctx.textAlign = "center";
  font(ctx, 16, 600);
  ctx.fillStyle = DIM;
  ctx.fillText("Up / down select    Left / right change    Enter confirm    Esc back    M mute", VIEW_W / 2, 650);
}

function settingsValue(view, id) {
  if (id === "volume") return `${Math.round(view.settings.volume * 100)}%`;
  if (id === "rounds") return `${view.settings.roundsToWin} rounds`;
  if (id === "mute") return view.settings.muted ? "On" : "Off";
  if (id === "controls") return "Remap";
  return "";
}

function drawControls(ctx, view) {
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  font(ctx, 36, 800);
  ctx.fillStyle = INK;
  ctx.fillText("CONTROLS", VIEW_W / 2, 58);
  font(ctx, 16, 600);
  ctx.fillStyle = DIM;
  ctx.fillText("Enter a row, then press the new key. Esc returns without eating the match.", VIEW_W / 2, 96);

  for (let player = 0; player < 4; player += 1) {
    const col = player % 2;
    const row = Math.floor(player / 2);
    const x = 120 + col * 540;
    const y = 140 + row * 270;
    font(ctx, 20, 800);
    ctx.textAlign = "left";
    ctx.fillStyle = PLAYER_COLORS[player];
    ctx.fillText(PLAYER_NAMES[player], x, y);
    ACTION_ROWS.forEach(([action, label], actionIndex) => {
      const index = player * 6 + actionIndex;
      const ry = y + 28 + actionIndex * 34;
      const selected = index === view.controlIndex;
      fillRound(ctx, x, ry, 460, 30, 6, selected ? "#163044" : "#0e141b");
      font(ctx, 16, 700);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.fillText(label, x + 14, ry + 15);
      ctx.textAlign = "right";
      const waiting = view.rebinding && view.rebinding.player === player && view.rebinding.action === action;
      ctx.fillStyle = waiting ? "#ffd27a" : "#9be7ff";
      ctx.fillText(waiting ? "PRESS A KEY" : formatCode(view.bindings[player][action]), x + 444, ry + 15);
    });
  }
}

function drawHud(ctx, view) {
  const match = view.match;
  ctx.fillStyle = "#080d13";
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.strokeStyle = "rgba(90, 180, 210, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 0.5);
  ctx.lineTo(VIEW_W, HUD_H - 0.5);
  ctx.stroke();

  font(ctx, 18, 800);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.fillText(`ROUND ${match.roundNumber}`, 28, 28);
  font(ctx, 13, 600);
  ctx.fillStyle = DIM;
  ctx.fillText(`FIRST TO ${match.roundsToWin}`, 28, 50);

  for (let i = 0; i < 4; i += 1) {
    const x = 250 + i * 200;
    const player = match.players[i];
    const alive = player && player.alive && player.participating;
    ctx.globalAlpha = player && player.participating ? (alive ? 1 : 0.4) : 0.3;
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillRect(x, 18, 8, 36);
    font(ctx, 18, 800);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(PLAYER_NAMES[i], x + 16, 28);
    font(ctx, 13, 700);
    ctx.fillStyle = DIM;
    const tag = !player || !player.participating ? "OFF" : player.kind === "bot" ? "BOT" : "YOU";
    ctx.fillText(tag, x + 52, 28);
    font(ctx, 20, 800);
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillText(String(match.scores[i]), x + 16, 50);
    drawPadIcon(ctx, x + 58, 40, view.pads[i]);
    ctx.globalAlpha = 1;
  }

  font(ctx, 14, 700);
  ctx.textAlign = "right";
  ctx.fillStyle = view.settings.muted || view.settings.volume === 0 ? "#ff8a8a" : DIM;
  ctx.fillText(view.settings.muted || view.settings.volume === 0 ? "MUTE" : "M MUTE", VIEW_W - 24, 36);
}

function drawArena(ctx, view) {
  const match = view.match;
  const rect = arenaRect();
  const shakeX = Math.sin(view.uiTime * 1.7) * (view.shake || 0);
  const shakeY = Math.cos(view.uiTime * 1.1) * (view.shake || 0);

  ctx.save();
  ctx.translate(shakeX, shakeY);
  fillRound(ctx, rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16, 10, "#071018");
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
  ctx.clip();
  ctx.fillStyle = "#05080d";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = "rgba(80, 190, 220, 0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= GRID_W; x += 1) {
    ctx.moveTo(rect.x + x * CELL + 0.5, rect.y);
    ctx.lineTo(rect.x + x * CELL + 0.5, rect.y + rect.h);
  }
  for (let y = 0; y <= GRID_H; y += 1) {
    ctx.moveTo(rect.x, rect.y + y * CELL + 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + y * CELL + 0.5);
  }
  ctx.stroke();

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const owner = getCell(match, x, y);
      if (!owner) continue;
      const color = PLAYER_COLORS[owner - 1] || "#fff";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(rect.x + x * CELL + 2, rect.y + y * CELL + 2, CELL - 4, CELL - 4);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rect.x + x * CELL + CELL / 2 - 1, rect.y + y * CELL + 3, 2, CELL - 6);
      ctx.globalAlpha = 1;
    }
  }

  for (const item of match.powerups) {
    drawPowerup(ctx, rect, item, view.uiTime);
  }

  for (const player of match.players) {
    if (!player.participating) continue;
    drawCycle(ctx, rect, player);
  }

  for (const bit of view.particles) {
    ctx.globalAlpha = Math.max(0, bit.life / bit.max);
    ctx.fillStyle = bit.color;
    ctx.fillRect(rect.x + bit.x - 2, rect.y + bit.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(140, 230, 255, 0.45)";
  ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
  ctx.stroke();
  ctx.restore();
}

function drawPowerup(ctx, rect, item, time) {
  const pulse = 0.75 + Math.sin(time / 8 + item.x) * 0.25;
  const cx = rect.x + item.x * CELL + CELL / 2;
  const cy = rect.y + item.y * CELL + CELL / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = pulse;
  if (item.type === "boost") {
    ctx.fillStyle = "#ffe14a";
    ctx.beginPath();
    ctx.moveTo(-3, -7);
    ctx.lineTo(2, -1);
    ctx.lineTo(-1, -1);
    ctx.lineTo(3, 7);
    ctx.lineTo(-2, 1);
    ctx.lineTo(1, 1);
    ctx.closePath();
    ctx.fill();
  } else if (item.type === "gap") {
    ctx.strokeStyle = "#f2f7ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#7af0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 3);
    ctx.lineTo(0, -4);
    ctx.lineTo(5, 3);
    ctx.moveTo(-5, 6);
    ctx.lineTo(0, -1);
    ctx.lineTo(5, 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCycle(ctx, rect, player) {
  const color = PLAYER_COLORS[player.id];
  const x = rect.x + player.x * CELL;
  const y = rect.y + player.y * CELL;
  ctx.save();
  if (!player.alive) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + CELL - 4, y + CELL - 4);
    ctx.moveTo(x + CELL - 4, y + 4);
    ctx.lineTo(x + 4, y + CELL - 4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = player.boostTimer > 0 ? 18 : 10;
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  const nose = { up: [5, 2, 8, 4], down: [5, CELL - 6, 8, 4], left: [2, 5, 4, 8], right: [CELL - 6, 5, 4, 8] }[player.dir];
  ctx.fillRect(x + nose[0], y + nose[1], nose[2], nose[3]);
  if (player.gapTimer > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  }
  if (player.jumpCharges > 0) {
    ctx.fillStyle = "#d8fbff";
    font(ctx, 10, 800);
    ctx.textAlign = "center";
    ctx.fillText(String(player.jumpCharges), x + CELL / 2, y - 6);
  }
  ctx.restore();
}

function drawCenterBanner(ctx, title, subtitle) {
  fillRound(ctx, VIEW_W / 2 - 280, VIEW_H / 2 - 70, 560, 140, 16, "rgba(6, 10, 16, 0.88)");
  ctx.textAlign = "center";
  font(ctx, 42, 800);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 16);
  if (subtitle) {
    font(ctx, 16, 600);
    ctx.fillStyle = DIM;
    ctx.fillText(subtitle, VIEW_W / 2, VIEW_H / 2 + 28);
  }
}

function drawPlay(ctx, view) {
  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawHud(ctx, view);
  drawArena(ctx, view);
  const match = view.match;

  if (match.phase === "countdown") {
    const n = Math.max(1, Math.ceil(match.timer / 60));
    drawCenterBanner(ctx, String(n), "Hold a turn before the lights drop");
  } else if (match.phase === "playing" && match.frame > 0 && match.frame < 40) {
    drawCenterBanner(ctx, "GO", "");
  } else if (match.phase === "roundEnd" && match.result) {
    const title = match.result.kind === "draw" ? "DRAW" : `${PLAYER_NAMES[match.result.player]} TAKES THE ROUND`;
    drawCenterBanner(ctx, title, "Enter to continue");
  }

  if (view.paused) drawPause(ctx, view);
  if (match.phase === "matchEnd") drawMatch(ctx, view);
}

function drawPause(ctx, view) {
  ctx.fillStyle = "rgba(4, 6, 10, 0.72)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  fillRound(ctx, 430, 200, 420, 320, 16, PANEL);
  ctx.textAlign = "center";
  font(ctx, 32, 800);
  ctx.fillStyle = INK;
  ctx.fillText("PAUSED", VIEW_W / 2, 246);
  PAUSE_ITEMS.forEach((item, index) => {
    const y = 290 + index * 60;
    const selected = index === view.pauseIndex;
    fillRound(ctx, 470, y, 340, 48, 8, selected ? "#163044" : "#0c1218");
    font(ctx, 20, 700);
    ctx.fillStyle = selected ? "#ffffff" : DIM;
    ctx.fillText(item.label, VIEW_W / 2, y + 24);
  });
}

function drawMatch(ctx, view) {
  ctx.fillStyle = "rgba(4, 6, 10, 0.78)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  fillRound(ctx, 360, 120, 560, 480, 18, PANEL);
  const rows = standings(view.match);
  const winner = view.match.winner;
  ctx.textAlign = "center";
  font(ctx, 18, 700);
  ctx.fillStyle = DIM;
  ctx.fillText("MATCH", VIEW_W / 2, 168);
  font(ctx, 40, 800);
  ctx.fillStyle = winner == null ? INK : PLAYER_COLORS[winner];
  ctx.fillText(winner == null ? "NO WINNER" : `${PLAYER_NAMES[winner]} WINS`, VIEW_W / 2, 216);

  rows.forEach((row, index) => {
    const y = 270 + index * 58;
    ctx.textAlign = "left";
    font(ctx, 22, 800);
    ctx.fillStyle = PLAYER_COLORS[row.player];
    ctx.fillText(`${index + 1}   ${PLAYER_NAMES[row.player]}`, 430, y);
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.fillText(`${row.score}`, 840, y);
    font(ctx, 14, 600);
    ctx.fillStyle = DIM;
    ctx.textAlign = "left";
    const kind = row.kind === "human" ? "player" : row.kind;
    ctx.fillText(kind, 560, y);
  });

  font(ctx, 16, 600);
  ctx.textAlign = "center";
  ctx.fillStyle = "#c5d7e6";
  ctx.fillText("Enter  rematch     Esc  title", VIEW_W / 2, 530);
  ctx.fillStyle = DIM;
  ctx.fillText(`Seed ${view.match.seed}`, VIEW_W / 2, 560);
}

export function render(ctx, view) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (view.screen === "title") drawTitle(ctx, view);
  else if (view.screen === "join") drawJoin(ctx, view);
  else if (view.screen === "settings") drawSettings(ctx, view);
  else if (view.screen === "controls") drawControls(ctx, view);
  else if (view.screen === "play" && view.match) drawPlay(ctx, view);
  else drawTitle(ctx, view);
}

export { SETTINGS_ITEMS, PAUSE_ITEMS, ACTION_ROWS };
