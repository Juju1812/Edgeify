/**
 * Standard Elo with K=32 for ranked play, K=48 during placement matches
 * (5 unranked games where ratings move faster).
 */
export function expectedScore(myElo: number, oppElo: number): number {
  return 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
}

export function eloDelta(
  myElo: number,
  oppElo: number,
  outcome: 0 | 0.5 | 1,
  isPlacement = false
): number {
  const k = isPlacement ? 48 : 32;
  const expected = expectedScore(myElo, oppElo);
  return Math.round(k * (outcome - expected));
}
