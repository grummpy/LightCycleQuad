import { DIR_DELTA, GRID_H, GRID_W, cellIndex, inBounds, turnLeft, turnRight } from "./constants.js";

/** Open cells ahead before a wall, trail, or another cycle. */
export function clearDistance(grid, players, x, y, dir, selfId) {
  const delta = DIR_DELTA[dir];
  let dist = 0;
  let cx = x;
  let cy = y;
  const limit = GRID_W + GRID_H;
  while (dist < limit) {
    cx += delta.x;
    cy += delta.y;
    if (!inBounds(cx, cy)) return dist;
    if (grid[cellIndex(cx, cy)]) return dist;
    for (const other of players) {
      if (!other.participating || !other.alive || other.id === selfId) continue;
      if (other.x === cx && other.y === cy) return dist;
    }
    dist += 1;
  }
  return dist;
}

/**
 * Simple wall-avoidance. Returns a 90-degree turn, or null to hold course.
 * Tie between the two sides consumes one RNG draw so tests stay deterministic.
 */
export function chooseBotDirection(match, player) {
  const forward = clearDistance(match.grid, match.players, player.x, player.y, player.dir, player.id);
  if (forward > 4) return null;
  const left = turnLeft(player.dir);
  const right = turnRight(player.dir);
  const leftDist = clearDistance(match.grid, match.players, player.x, player.y, left, player.id);
  const rightDist = clearDistance(match.grid, match.players, player.x, player.y, right, player.id);
  if (leftDist > rightDist) return left;
  if (rightDist > leftDist) return right;
  return match.rng.next() < 0.5 ? left : right;
}
