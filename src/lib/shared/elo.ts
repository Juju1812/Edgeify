/** Standard ELO. `result` is 1 for a win, 0.5 draw, 0 loss (from A's side). */
export function eloDelta(eloA: number, eloB: number, result: 0 | 0.5 | 1, placement: boolean) {
  const k = placement ? 48 : 32;
  const expected = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  return Math.round(k * (result - expected));
}
