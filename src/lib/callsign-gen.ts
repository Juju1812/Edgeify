/**
 * Quick callsign generator for the sign-up flow. Returns punchy 2-syllable
 * combos with a 3-digit suffix. Pure function — same input never repeats
 * twice in a row across calls thanks to the seen-set caller passes in.
 */

const ROOTS = [
  "EDGE", "MOG", "JAW", "ZYZZ", "RYU", "KAI", "VEX", "ONYX", "FROST", "BLAZE",
  "RAVEN", "HEX", "REX", "AXEL", "VOID", "RIFT", "PRISM", "QUARK", "FANG", "VYPR",
  "GHOST", "FLARE", "EMBER", "CRUX", "NOX", "JINX", "ZEN", "RIO", "DEX", "SOLO",
  "TANK", "FLINT", "RAGE", "SHADE", "JET", "ORBIT", "COBRA", "ECHO", "IRON", "LYNX"
];
const SUFFIXES = [
  "X", "Z", "BOY", "GOD", "KING", "PRIME", "ZERO", "ACE", "SHARP", "EDGE",
  "TIDE", "WAVE", "STORM", "BLADE", "OPS", "CORE"
];

export function suggestCallsigns(count = 5, seen = new Set<string>()): string[] {
  const out: string[] = [];
  let attempts = 0;
  while (out.length < count && attempts < 60) {
    attempts++;
    const root = ROOTS[Math.floor(Math.random() * ROOTS.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    const candidate = `${root}${suffix}${num}`.slice(0, 16);
    if (seen.has(candidate) || out.includes(candidate)) continue;
    out.push(candidate);
  }
  return out;
}
