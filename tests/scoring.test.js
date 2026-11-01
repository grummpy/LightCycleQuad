import assert from "node:assert/strict";
import test from "node:test";
import { BASE_MOVE_INTERVAL } from "../src/core/constants.js";
import { createMatch, tick } from "../src/core/game.js";

function frames(match, count) {
  for (let i = 0; i < count; i += 1) tick(match);
}

const crashStarts = [
  { x: 10, y: 16, dir: "right" },
  { x: 47, y: 6, dir: "right" },
  { x: 8, y: 0, dir: "up" },
  { x: 0, y: 20, dir: "left" },
];

test("last cycle standing scores the round", () => {
  const match = createMatch({
    countdownFrames: 0,
    roundEndFrames: 50,
    roundsToWin: 5,
    slots: ["human", "human", "human", "human"],
    starts: crashStarts,
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.phase, "roundEnd");
  assert.deepEqual(match.result, { kind: "win", player: 0 });
  assert.deepEqual(match.scores, [1, 0, 0, 0]);
  assert.equal(match.roundNumber, 1);
});

test("simultaneous crashes are a draw and score nobody", () => {
  const match = createMatch({
    countdownFrames: 0,
    roundEndFrames: 40,
    roundsToWin: 5,
    slots: ["human", "human", "human", "human"],
    starts: [
      { x: 0, y: 10, dir: "left" },
      { x: 47, y: 12, dir: "right" },
      { x: 14, y: 0, dir: "up" },
      { x: 20, y: 31, dir: "down" },
    ],
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.phase, "roundEnd");
  assert.equal(match.result.kind, "draw");
  assert.deepEqual(match.scores, [0, 0, 0, 0]);
});

test("first to the round target ends the match", () => {
  const match = createMatch({
    countdownFrames: 0,
    roundEndFrames: 40,
    roundsToWin: 1,
    slots: ["human", "human", "human", "human"],
    starts: crashStarts,
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.phase, "matchEnd");
  assert.equal(match.winner, 0);
  assert.deepEqual(match.scores, [1, 0, 0, 0]);
});

test("a lone participant wins without anyone else crashing", () => {
  const match = createMatch({
    countdownFrames: 0,
    roundEndFrames: 20,
    roundsToWin: 4,
    slots: ["human", "off", "off", "off"],
  });
  tick(match);
  assert.equal(match.result.kind, "win");
  assert.equal(match.result.player, 0);
  assert.equal(match.scores[0], 1);
  assert.equal(match.players[0].x, match.starts[0].x);
});

test("the next round resets the grid and keeps the score", () => {
  const match = createMatch({
    countdownFrames: 0,
    roundEndFrames: 2,
    roundsToWin: 5,
    slots: ["human", "human", "human", "human"],
    starts: crashStarts,
  });
  frames(match, BASE_MOVE_INTERVAL);
  assert.equal(match.phase, "roundEnd");
  frames(match, 2);
  assert.equal(match.roundNumber, 2);
  assert.equal(match.phase, "playing");
  assert.deepEqual(match.scores, [1, 0, 0, 0]);
  assert.equal(match.players[1].alive, true);
  assert.equal(match.players[1].x, 47);
  assert.equal(match.players[0].alive, true);
});
