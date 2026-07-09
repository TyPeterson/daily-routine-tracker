import { describe, expect, it } from 'vitest'
import { chartScale } from './chartScale'

describe('chartScale', () => {
  it('a 0→25 chapters goal counts by 5s, no negatives', () => {
    const { domain, ticks } = chartScale([0, 25, 1])
    expect(domain).toEqual([0, 25])
    expect(ticks).toEqual([0, 5, 10, 15, 20, 25])
  })

  it('weight 200→180 steps by 5 between the entered bounds', () => {
    const { domain, ticks } = chartScale([200, 180, 195, 189])
    expect(domain).toEqual([180, 200])
    expect(ticks).toEqual([180, 185, 190, 195, 200])
  })

  it('expands only the crossed bound and keeps it after recovery', () => {
    // 204 crossed the top; later 199 does not shrink it back
    const { domain } = chartScale([200, 180, 204, 199])
    expect(domain).toEqual([180, 204])
  })

  it('small ranges use ≤2 decimal ticks', () => {
    const { ticks } = chartScale([0, 1, 0.65])
    expect(ticks[0]).toBe(0)
    expect(ticks.at(-1)).toBe(1)
    for (const t of ticks) {
      expect(t).toBeCloseTo(Math.round(t * 100) / 100, 10)
    }
  })

  it('handles a single flat value without collapsing', () => {
    const { domain } = chartScale([5])
    expect(domain[0]).toBe(5)
    expect(domain[1]).toBeGreaterThan(5)
  })
})
