// Tiny deterministic RNG (mulberry32). Pure functions over an integer state so
// combat simulation is fully reproducible and unit-testable.

export function nextRng(state: number): { value: number; state: number } {
  // mulberry32
  let t = (state + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/** Returns an integer in [min, max] inclusive plus the advanced state. */
export function rngInt(
  state: number,
  min: number,
  max: number,
): { value: number; state: number } {
  const r = nextRng(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state };
}
