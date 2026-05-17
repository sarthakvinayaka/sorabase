/** Tiny collision-resistant ID — no external dependency. */
export function nanoid(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, "0");
}
