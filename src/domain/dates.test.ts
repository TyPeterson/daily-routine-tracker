import { describe, expect, it } from 'vitest'
import { endOfWeekStr, startOfWeekStr } from './dates'

describe('week helpers', () => {
  it('finds the Sunday that starts a mid-week date', () => {
    // 2026-01-07 is a Wednesday
    expect(startOfWeekStr('2026-01-07')).toBe('2026-01-04')
    expect(endOfWeekStr('2026-01-07')).toBe('2026-01-10')
  })

  it('a Sunday is its own week start; a Saturday its own week end', () => {
    expect(startOfWeekStr('2026-01-04')).toBe('2026-01-04')
    expect(endOfWeekStr('2026-01-10')).toBe('2026-01-10')
    expect(startOfWeekStr('2026-01-10')).toBe('2026-01-04')
  })

  it('spans the US spring-forward DST week without drifting', () => {
    // 2026-03-08 is the US spring-forward Sunday
    expect(startOfWeekStr('2026-03-11')).toBe('2026-03-08')
    expect(endOfWeekStr('2026-03-08')).toBe('2026-03-14')
  })
})
