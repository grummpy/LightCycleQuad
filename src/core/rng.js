/**
 * Mulberry32. Same seed always yields the same stream, which keeps
 * power-up spawns and bot tie-breaks replayable in tests.
 */
export function createRng(seed) {
  let a = Number(seed) >>> 0;

  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    /** Integer in [0, n). */
    int(n) {
      if (n <= 1) return 0;
      return Math.floor(this.next() * n);
    },
  };
}
