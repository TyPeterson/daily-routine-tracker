import { describe, expect, it } from 'vitest'
import {
  goalPercent,
  goalTargetReached,
  metricPercent,
  milestoneAchievedAt,
  valueCrosses,
  weeklyCompletionCounts,
} from './progress'
import type { CheckIn, Checkpoint, Goal } from '../db/models'

const checkIn = (value: number | undefined, at: number): CheckIn => ({
  id: `ci-${at}`,
  goalId: 'g1',
  at,
  value,
  notes: '',
})

const goal = (partial: Partial<Goal>): Goal => ({
  id: 'g1',
  title: 'Goal',
  description: '',
  createdAt: 0,
  ...partial,
})

describe('metricPercent', () => {
  it('handles decreasing targets (weight loss)', () => {
    const metric = { unit: 'lbs', startValue: 200, targetValue: 180, direction: 'decrease' as const }
    expect(metricPercent(metric, [checkIn(190, 1)])).toBe(50)
  })

  it('handles increasing targets (run distance)', () => {
    const metric = { unit: 'mi', startValue: 0, targetValue: 1, direction: 'increase' as const }
    expect(metricPercent(metric, [checkIn(0.65, 1)])).toBeCloseTo(65)
  })

  it('uses the latest check-in, not the max', () => {
    const metric = { unit: 'mi', startValue: 0, targetValue: 1, direction: 'increase' as const }
    expect(metricPercent(metric, [checkIn(0.9, 2), checkIn(0.5, 5)])).toBe(50)
  })

  it('falls back to the first check-in as baseline', () => {
    const metric = { unit: 'lbs', targetValue: 180, direction: 'decrease' as const }
    expect(metricPercent(metric, [checkIn(200, 1), checkIn(190, 2)])).toBe(50)
  })

  it('clamps to 0-100', () => {
    const metric = { unit: 'lbs', startValue: 200, targetValue: 180, direction: 'decrease' as const }
    expect(metricPercent(metric, [checkIn(175, 1)])).toBe(100)
    expect(metricPercent(metric, [checkIn(210, 1)])).toBe(0)
  })

  it('is 0 with no check-ins but a known baseline, null otherwise', () => {
    expect(
      metricPercent({ unit: 'lbs', startValue: 200, targetValue: 180, direction: 'decrease' }, []),
    ).toBe(0)
    expect(metricPercent({ unit: 'lbs', targetValue: 180, direction: 'decrease' }, [])).toBeNull()
    expect(metricPercent({ unit: 'lbs', direction: 'decrease' }, [checkIn(190, 1)])).toBeNull()
  })
})

describe('goalPercent', () => {
  const cp = (id: string, achieved: boolean): Checkpoint => ({
    id,
    goalId: 'g1',
    title: id,
    sortOrder: 1,
    achievedAt: achieved ? 1 : undefined,
  })

  it('completed goals are always 100', () => {
    expect(goalPercent(goal({ completedAt: 5 }), [], [])).toBe(100)
  })

  it('prefers the metric when present', () => {
    const g = goal({ metric: { unit: 'mi', startValue: 0, targetValue: 2, direction: 'increase' } })
    expect(goalPercent(g, [checkIn(1, 1)], [cp('a', false)])).toBe(50)
  })

  it('falls back to checkpoint fraction', () => {
    expect(goalPercent(goal({}), [], [cp('a', true), cp('b', true), cp('c', false), cp('d', false)])).toBe(50)
  })

  it('is null when there is nothing to measure', () => {
    expect(goalPercent(goal({}), [], [])).toBeNull()
  })
})

describe('valueCrosses / goalTargetReached', () => {
  it('increase direction: reached at or above the target', () => {
    expect(valueCrosses('increase', 0.5, 0.5)).toBe(true)
    expect(valueCrosses('increase', 0.65, 0.5)).toBe(true)
    expect(valueCrosses('increase', 0.4, 0.5)).toBe(false)
  })

  it('decrease direction: reached at or below the target', () => {
    expect(valueCrosses('decrease', 190, 190)).toBe(true)
    expect(valueCrosses('decrease', 185, 190)).toBe(true)
    expect(valueCrosses('decrease', 191, 190)).toBe(false)
  })

  it('goalTargetReached checks the final target', () => {
    const metric = { unit: 'lbs', startValue: 200, targetValue: 180, direction: 'decrease' as const }
    expect(goalTargetReached(metric, 179)).toBe(true)
    expect(goalTargetReached(metric, 180)).toBe(true)
    expect(goalTargetReached(metric, 181)).toBe(false)
    expect(goalTargetReached({ unit: 'x', direction: 'increase' }, 100)).toBe(false) // no target
  })
})

describe('milestoneAchievedAt', () => {
  const v = (at: number, value: number) => ({ at, value })

  it('reached when the latest values cross it', () => {
    expect(milestoneAchievedAt('decrease', 190, [v(1, 195), v(2, 189)])).toBe(2)
  })

  it('backwards progress un-reaches it (189 then 191)', () => {
    expect(milestoneAchievedAt('decrease', 190, [v(1, 189), v(2, 191)])).toBeUndefined()
  })

  it('re-crossing later reaches again from the new streak start', () => {
    expect(milestoneAchievedAt('decrease', 190, [v(1, 189), v(2, 191), v(3, 188)])).toBe(3)
  })

  it('reach time is the start of the final crossing streak', () => {
    expect(milestoneAchievedAt('increase', 1, [v(1, 1.2), v(2, 1.5)])).toBe(1)
  })

  it('never reached without a crossing', () => {
    expect(milestoneAchievedAt('increase', 5, [v(1, 2), v(2, 4.9)])).toBeUndefined()
  })
})

describe('weeklyCompletionCounts', () => {
  it('buckets dates into trailing weeks ending with the current one', () => {
    // 2026-01-21 is a Wednesday; its week starts Sunday 2026-01-18
    const buckets = weeklyCompletionCounts(
      ['2026-01-19', '2026-01-20', '2026-01-13', '2026-01-01'],
      3,
      '2026-01-21',
    )
    expect(buckets.map((b) => b.weekStart)).toEqual(['2026-01-04', '2026-01-11', '2026-01-18'])
    expect(buckets.map((b) => b.count)).toEqual([0, 1, 2])
  })

  it('ignores dates outside the window', () => {
    const buckets = weeklyCompletionCounts(['2025-12-01'], 2, '2026-01-21')
    expect(buckets.every((b) => b.count === 0)).toBe(true)
  })
})
