import assert from "node:assert/strict";
import test from "node:test";
import { createRng } from "../src/core/rng.js";
import { createMatch, tick } from "../src/core/game.js";

function frames(match, count) {
  for (let i = 0; i < count; i += 1) tick(match);
}

function snapshot(seed) {
  const match = createMatch({
    seed,
    countdownFrames: 0,
    roundEndFrames: 5000,
    roundsToWin: 20,
    slots: ["human", "human", "human", "human"],
    starts: [
      { x: 4, y: 6, dir: "right" },
      { x: 4, y: 12, dir: "right" },
      { x: 4, y: 18, dir: "right" },
      { x: 4, y: 24, dir: "right" },
    ],
  });
  frames(match, 250);
  return {
    powerups: match.powerups.map((item) => ({ ...item })),
    players: match.players.map((player) => [player.x, player.y, player.dir, player.alive]),
    grid: Array.from(match.grid),
  };
}

test("the same seed replays the same stream", () => {
  const a = createRng(42);
  const b = createRng(42);
  const fromA = Array.from({ length: 8 }, () => a.next());
  const fromB = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(fromA, fromB);
  assert.ok(fromA.every((n) => n >= 0 && n < 1));
  assert.notDeepEqual(fromA, Array.from({ length: 8 }, () => createRng(43).next()));
});

test("int stays inside the requested range", () => {
  const rng = createRng(7);
  for (let i = 0; i < 40; i += 1) {
    const n = rng.int(5);
    assert.ok(Number.isInteger(n));
    assert.ok(n >= 0 && n < 5);
  }
  assert.equal(createRng(1).int(1), 0);
});

test("a match with the same seed is deterministic, a different seed is not", () => {
  const first = snapshot(11);
  const second = snapshot(11);
  assert.deepEqual(first, second);
  assert.ok(first.powerups.length > 0);
  assert.notDeepEqual(first.powerups, snapshot(12).powerups);
});
