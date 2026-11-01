import assert from "node:assert/strict";
import test from "node:test";
import { BASE_MOVE_INTERVAL } from "../src/core/constants.js";
import { createMatch, tick } from "../src/core/game.js";

test("a bot turns before a wall instead of crashing into it", () => {
  const match = createMatch({
    seed: 3,
    countdownFrames: 0,
    roundEndFrames: 500,
    roundsToWin: 5,
    slots: ["human", "human", "bot", "off"],
    starts: [
      { x: 4, y: 4, dir: "right" },
      { x: 4, y: 8, dir: "right" },
      { x: 47, y: 16, dir: "right" },
      { x: 0, y: 0, dir: "up" },
    ],
  });
  for (let i = 0; i < BASE_MOVE_INTERVAL; i += 1) tick(match);
  const bot = match.players[2];
  assert.equal(bot.alive, true);
  assert.equal(bot.dir, "up");
  assert.equal(bot.x, 47);
  assert.equal(bot.y, 15);
  assert.equal(match.phase, "playing");
});
