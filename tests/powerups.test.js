import assert from "node:assert/strict";
import test from "node:test";
import { BASE_MOVE_INTERVAL, BOOST_MOVE_INTERVAL } from "../src/core/constants.js";
import { createMatch, getCell, tick } from "../src/core/game.js";

function frames(match, count) {
  for (let i = 0; i < count; i += 1) tick(match);
}

function duo(extra = {}) {
  return createMatch({
    seed: 2,
    countdownFrames: 0,
    roundEndFrames: 800,
    roundsToWin: 8,
    slots: ["human", "human", "off", "off"],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 12, y: 16, dir: "up" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
    ...extra,
  });
}

test("speed boost shortens the step interval", () => {
  const safe = {
    starts: [
      { x: 10, y: 8, dir: "right" },
      { x: 10, y: 24, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
  };
  const boosted = duo({ ...safe, effects: { 0: { boostTimer: 400 } } });
  const normal = duo(safe);
  assert.equal(boosted.players[0].moveTimer, BOOST_MOVE_INTERVAL);
  frames(boosted, 36);
  frames(normal, 36);
  assert.equal(normal.players[0].x, 16);
  assert.equal(boosted.players[0].x, 22);
  assert.equal(boosted.phase, "playing");
});

test("a trail gap leaves cells another cycle can cross", () => {
  const open = duo({ effects: { 0: { gapTimer: 300 } } });
  const closed = duo();
  frames(open, BASE_MOVE_INTERVAL * 6);
  frames(closed, BASE_MOVE_INTERVAL * 6);
  assert.equal(getCell(open, 12, 10), 0);
  assert.equal(open.players[1].alive, true);
  assert.equal(open.players[1].x, 12);
  assert.equal(open.players[1].y, 10);
  assert.equal(getCell(closed, 12, 10), 1);
  assert.equal(closed.players[1].alive, false);
});

test("jump hops one trail cell and lands beyond it", () => {
  const match = duo({
    effects: { 0: { jumpCharges: 1 } },
    trails: [{ x: 11, y: 10, owner: 2 }],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 4, y: 24, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, true);
  assert.equal(match.players[0].x, 12);
  assert.equal(match.players[0].y, 10);
  assert.equal(match.players[0].jumpCharges, 0);
  assert.equal(getCell(match, 11, 10), 2);
  assert.equal(getCell(match, 10, 10), 1);

  const crashed = duo({
    trails: [{ x: 11, y: 10, owner: 2 }],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 4, y: 24, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
  });
  frames(crashed, BASE_MOVE_INTERVAL);
  assert.equal(crashed.players[0].alive, false);
});

test("picking up a boost, gap, or jump applies it and clears the cell", () => {
  const match = duo({
    powerups: [{ x: 11, y: 10, type: "jump" }],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 4, y: 24, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].jumpCharges, 1);
  assert.equal(match.players[0].x, 11);
  assert.equal(match.powerups.length, 0);
  assert.ok(match.events.some((event) => event.type === "pickup" && event.power === "jump"));

  const gap = duo({
    powerups: [{ x: 5, y: 24, type: "gap" }],
    starts: [
      { x: 4, y: 8, dir: "right" },
      { x: 4, y: 24, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
  });
  frames(gap, BASE_MOVE_INTERVAL * 2);
  assert.ok(gap.players[1].gapTimer > 0);
  assert.equal(gap.players[1].x, 6);
  assert.equal(getCell(gap, 4, 24), 2);
  assert.equal(getCell(gap, 5, 24), 0);
});
