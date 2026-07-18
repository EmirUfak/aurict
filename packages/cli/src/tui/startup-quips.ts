/** Original chaotic-sci-fi banter for developer startup screens. */
export const STARTUP_QUIPS = [
  "Reality compiled. Warnings remain.",
  "One branch away from a better timeline.",
  "The build is innocent until the tests finish.",
  "Cache warm. Expectations cautiously optimistic.",
  "The bug has been promoted to architecture.",
  "Opening a portal to the dependency graph.",
  "No prophecy, just logs and reproducible steps.",
  "Today is a great day to delete accidental complexity.",
  "The stack is stable in at least one universe.",
  "Ship carefully. The timeline has enough hotfixes.",
  "Your future self requested smaller diffs.",
  "Entropy detected. Formatting files.",
  "The tests remember what production tries to forget.",
  "Summoning context without waking the legacy code.",
  "A clean abstraction is just a bug with good posture.",
  "Measure twice. Rewrite the parser once.",
] as const;

export function selectStartupQuip(random: () => number = Math.random): string {
  const index = Math.min(STARTUP_QUIPS.length - 1, Math.max(0, Math.floor(random() * STARTUP_QUIPS.length)));
  return STARTUP_QUIPS[index]!;
}
