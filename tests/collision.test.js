import assert from "node:assert/strict";
import test from "node:test";
import { BASE_MOVE_INTERVAL } from "../src/core/constants.js";
import { createMatch, getCell, tick } from "../src/core/game.js";

function frames(match, count) {
  for (let i = 0; i < count; i += 1) tick(match);
}

function race(starts, extra = {}) {
  return createMatch({
    seed: 1,
    countdownFrames: 0,
    roundEndFrames: 800,
    roundsToWin: 8,
    slots: ["human", "human", "human", "human"],
    starts,
    ...extra,
  });
}

test("a wall eliminates that cycle and leaves the others riding", () => {
  const match = race([
    { x: 47, y: 8, dir: "right" },
    { x: 6, y: 16, dir: "right" },
    { x: 6, y: 20, dir: "right" },
    { x: 6, y: 24, dir: "right" },
  ]);
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[0].x, 47);
  assert.equal(match.phase, "playing");
  const frozen = match.players[0].x;
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[0].x, frozen);
  assert.equal(match.players[1].x, 8);
  assert.equal(match.players[1].alive, true);
});

test("an existing trail eliminates the cycle that enters it", () => {
  const match = race(
    [
      { x: 10, y: 10, dir: "right" },
      { x: 4, y: 18, dir: "right" },
      { x: 4, y: 22, dir: "right" },
      { x: 4, y: 26, dir: "right" },
    ],
    { trails: [{ x: 11, y: 10, owner: 2 }] },
  );
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, false);
  assert.equal(getCell(match, 11, 10), 2);
  assert.equal(match.phase, "playing");
});

test("two cycles entering one cell are both eliminated", () => {
  const match = race([
    { x: 10, y: 10, dir: "right" },
    { x: 12, y: 10, dir: "left" },
    { x: 4, y: 20, dir: "right" },
    { x: 4, y: 24, dir: "right" },
  ]);
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[1].alive, false);
  assert.equal(match.players[2].alive, true);
  assert.equal(match.players[3].alive, true);
  assert.equal(match.phase, "playing");
  assert.deepEqual(match.scores, [0, 0, 0, 0]);
});

test("a head-on swap crashes both riders", () => {
  const match = race(
    [
      { x: 10, y: 10, dir: "right" },
      { x: 11, y: 10, dir: "left" },
      { x: 4, y: 22, dir: "right" },
      { x: 0, y: 0, dir: "right" },
    ],
    { slots: ["human", "human", "human", "off"] },
  );
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[1].alive, false);
  assert.equal(match.result.kind, "win");
  assert.equal(match.result.player, 2);
  assert.equal(match.scores[2], 1);
});
