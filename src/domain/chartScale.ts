const round2 = (n: number) => Math.round(n * 100) / 100

/** Snap a raw interval to a human step (1 / 2 / 2.5 / 5 / 10 × 10^k). */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

/**
 * Y-axis for the progress chart. The axis starts at the metric's start value
 * and ends at its target, expanding a bound only when data crosses it — never
 * padded into nonsense values. Ticks step evenly from the start (≤2 decimals),
 * always ending exactly on the top bound.
 */
export function chartScale(
  bounds: number[],
): { domain: [number, number]; ticks: number[] } {
  let lo = Math.min(...bounds)
  let hi = Math.max(...bounds)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0
    hi = 1
  }
  if (hi - lo < 1e-9) hi = lo + 1

  const step = niceStep((hi - lo) / 5)
  const ticks: number[] = []
  for (let t = lo; t < hi - step * 0.05; t += step) ticks.push(round2(t))
  ticks.push(round2(hi))

  return { domain: [round2(lo), round2(hi)], ticks }
}
