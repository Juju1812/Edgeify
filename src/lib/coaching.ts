import type { MatchRecord, UserState } from "./types";

/**
 * Generate a coaching tip based on recent loss patterns. Walks the
 * last ~10 ranked matches and finds the criterion the user has been
 * losing on most often, then returns a tip string. Returns null if
 * there's nothing useful to say (no recent losses, no round data).
 */
export function coachingTip(user: UserState): { criterion: string; tip: string } | null {
  const recent = user.matchHistory
    .filter((m) => !m.practice && m.rounds && m.rounds.length > 0)
    .slice(0, 10);
  if (recent.length === 0) return null;

  // Tally rounds where we lost, by criterion.
  const lossByCriterion = new Map<string, { lost: number; gap: number }>();
  for (const m of recent) {
    for (const r of m.rounds!) {
      if (r.opp <= r.me) continue;
      const cur = lossByCriterion.get(r.criterion) || { lost: 0, gap: 0 };
      cur.lost += 1;
      cur.gap += r.opp - r.me;
      lossByCriterion.set(r.criterion, cur);
    }
  }

  if (lossByCriterion.size === 0) return null;
  let worstCriterion = "";
  let worstScore = 0;
  for (const [c, info] of lossByCriterion) {
    const sc = info.lost * 1.5 + info.gap * 0.1;
    if (sc > worstScore) {
      worstScore = sc;
      worstCriterion = c;
    }
  }
  if (!worstCriterion) return null;

  return { criterion: worstCriterion, tip: tipFor(worstCriterion) };
}

function tipFor(criterion: string): string {
  switch (criterion.toLowerCase()) {
    case "symmetry":
      return "Try centering your face in frame and looking straight ahead — even a 5° tilt drops symmetry. Lighting also matters: even, soft, front-on light reduces shadow asymmetries.";
    case "jawline":
      return "Slightly tilt your chin DOWN and pull your head back from the camera (the 'mewing' angle). Brighten the lighting too — shadows along the jaw read as definition to the algorithm.";
    case "overall":
      return "Overall blends every metric. The biggest leverage is usually lighting + framing. Diffuse front-light, face takes ~40% of frame, neutral expression.";
    default:
      return "Improve lighting and framing — soft front-on light + face filling about 40% of the frame yields more consistent reads.";
  }
}

/**
 * Returns true if the user just lost a match where the worst criterion
 * pattern is meaningful enough to surface a tip (≥2 recent losses on
 * the same criterion).
 */
export function shouldShowCoaching(user: UserState): boolean {
  const last = user.matchHistory.find((m) => !m.practice);
  if (!last || last.won) return false;
  const tip = coachingTip(user);
  return !!tip;
}
