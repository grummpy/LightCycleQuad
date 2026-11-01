import assert from "node:assert/strict";
import test from "node:test";
import { BASE_MOVE_INTERVAL } from "../src/core/constants.js";
import { createMatch, getCell, queueDirection, tick } from "../src/core/game.js";

function frames(match, count) {
  for (let i = 0; i < count; i += 1) tick(match);
}

function setup(extra = {}) {
  return createMatch({
    seed: 1,
    countdownFrames: 0,
    roundEndFrames: 800,
    roundsToWin: 8,
    slots: ["human", "human", "off", "off"],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 10, y: 22, dir: "right" },
      { x: 0, y: 0, dir: "right" },
      { x: 0, y: 1, dir: "right" },
    ],
    ...extra,
  });
}

test("cycles step one cell on the base interval and leave a trail", () => {
  const match = setup();
  frames(match, BASE_MOVE_INTERVAL - 1);
  assert.equal(match.players[0].x, 10);
  frames(match, 1);
  assert.equal(match.players[0].x, 11);
  assert.equal(match.players[0].y, 10);
  assert.equal(getCell(match, 10, 10), 1);
  assert.equal(getCell(match, 11, 10), 0);
});

test("a 90-degree turn is taken on the next step and a reverse is ignored", () => {
  const turned = setup();
  queueDirection(turned, 0, "up");
  frames(turned, BASE_MOVE_INTERVAL);
  assert.equal(turned.players[0].dir, "up");
  assert.equal(turned.players[0].x, 10);
  assert.equal(turned.players[0].y, 9);
  assert.equal(getCell(turned, 10, 10), 1);

  const reversed = setup();
  queueDirection(reversed, 0, "left");
  frames(reversed, BASE_MOVE_INTERVAL);
  assert.equal(reversed.players[0].dir, "right");
  assert.equal(reversed.players[0].x, 11);
  assert.equal(reversed.players[0].y, 10);
});

test("nothing moves during the countdown", () => {
  const match = setup({ countdownFrames: 12 });
  queueDirection(match, 0, "up");
  frames(match, 12);
  assert.equal(match.phase, "playing");
  assert.equal(match.players[0].x, 10);
  assert.equal(match.players[0].y, 10);
  assert.equal(getCell(match, 10, 10), 0);
});

test("turning back into your own trail eliminates you", () => {
  const match = setup({
    slots: ["human", "human", "human", "off"],
    starts: [
      { x: 10, y: 10, dir: "right" },
      { x: 10, y: 22, dir: "right" },
      { x: 4, y: 4, dir: "right" },
      { x: 0, y: 0, dir: "right" },
    ],
  });
  const step = BASE_MOVE_INTERVAL;
  frames(match, step);
  queueDirection(match, 0, "down");
  frames(match, step);
  queueDirection(match, 0, "left");
  frames(match, step);
  queueDirection(match, 0, "up");
  frames(match, step);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[0].x, 10);
  assert.equal(match.players[0].y, 11);
  assert.equal(match.phase, "playing");
  assert.equal(match.players[1].alive, true);
  assert.equal(match.players[2].alive, true);
  assert.deepEqual(match.scores, [0, 0, 0, 0]);
});
