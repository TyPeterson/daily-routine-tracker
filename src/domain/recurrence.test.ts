import { describe, expect, it } from 'vitest'
import { describeRecurrence, occurrencesInRange, occursOn, type Schedulable } from './recurrence'

const item = (partial: Partial<Schedulable> & { recurrence: Schedulable['recurrence'] }): Schedulable => ({
  startDate: '2026-01-01',
  ...partial,
})

describe('occursOn', () => {
  it('one-off tasks occur only on their start date', () => {
    const t = item({ recurrence: { type: 'none' }, startDate: '2026-03-05' })
    expect(occursOn(t, '2026-03-05')).toBe(true)
    expect(occursOn(t, '2026-03-04')).toBe(false)
    expect(occursOn(t, '2026-03-06')).toBe(false)
  })

  it('never occurs before startDate or after endDate', () => {
    const t = item({
      recurrence: { type: 'daily', interval: 1 },
      startDate: '2026-02-10',
      endDate: '2026-02-12',
    })
    expect(occursOn(t, '2026-02-09')).toBe(false)
    expect(occursOn(t, '2026-02-10')).toBe(true)
    expect(occursOn(t, '2026-02-12')).toBe(true)
    expect(occursOn(t, '2026-02-13')).toBe(false)
  })

  it('daily interval anchors to startDate', () => {
    const t = item({ recurrence: { type: 'daily', interval: 3 } })
    expect(occursOn(t, '2026-01-01')).toBe(true)
    expect(occursOn(t, '2026-01-02')).toBe(false)
    expect(occursOn(t, '2026-01-03')).toBe(false)
    expect(occursOn(t, '2026-01-04')).toBe(true)
    expect(occursOn(t, '2026-02-03')).toBe(true) // 33 days later
  })

  it('weekly matches only the chosen weekdays', () => {
    // 2026-01-05 is a Monday
    const t = item({
      recurrence: { type: 'weekly', interval: 1, weekdays: [1, 3, 5] },
      startDate: '2026-01-05',
    })
    expect(occursOn(t, '2026-01-05')).toBe(true) // Mon
    expect(occursOn(t, '2026-01-06')).toBe(false) // Tue
    expect(occursOn(t, '2026-01-07')).toBe(true) // Wed
    expect(occursOn(t, '2026-01-09')).toBe(true) // Fri
    expect(occursOn(t, '2026-01-10')).toBe(false) // Sat
    expect(occursOn(t, '2026-01-12')).toBe(true) // next Mon
  })

  it('every-2-weeks anchors to the week containing startDate', () => {
    // 2026-01-07 is a Wednesday
    const t = item({
      recurrence: { type: 'weekly', interval: 2, weekdays: [3] },
      startDate: '2026-01-07',
    })
    expect(occursOn(t, '2026-01-07')).toBe(true)
    expect(occursOn(t, '2026-01-14')).toBe(false) // skipped week
    expect(occursOn(t, '2026-01-21')).toBe(true)
    expect(occursOn(t, '2026-01-28')).toBe(false)
  })

  it('monthly hits the same day each month', () => {
    const t = item({
      recurrence: { type: 'monthly', interval: 1, dayOfMonth: 15 },
      startDate: '2026-01-15',
    })
    expect(occursOn(t, '2026-01-15')).toBe(true)
    expect(occursOn(t, '2026-02-15')).toBe(true)
    expect(occursOn(t, '2026-02-14')).toBe(false)
  })

  it('monthly day 31 clamps to shorter months', () => {
    const t = item({
      recurrence: { type: 'monthly', interval: 1, dayOfMonth: 31 },
      startDate: '2026-01-31',
    })
    expect(occursOn(t, '2026-02-28')).toBe(true) // 2026 is not a leap year
    expect(occursOn(t, '2026-02-27')).toBe(false)
    expect(occursOn(t, '2026-04-30')).toBe(true)
    expect(occursOn(t, '2026-05-31')).toBe(true)
  })

  it('skipDates remove single occurrences from a series', () => {
    const t = item({
      recurrence: { type: 'daily', interval: 1 },
      skipDates: ['2026-01-03'],
    })
    expect(occursOn(t, '2026-01-02')).toBe(true)
    expect(occursOn(t, '2026-01-03')).toBe(false)
    expect(occursOn(t, '2026-01-04')).toBe(true)
  })

  it('monthly interval skips months from the anchor', () => {
    const t = item({
      recurrence: { type: 'monthly', interval: 3, dayOfMonth: 10 },
      startDate: '2026-01-10',
    })
    expect(occursOn(t, '2026-01-10')).toBe(true)
    expect(occursOn(t, '2026-02-10')).toBe(false)
    expect(occursOn(t, '2026-04-10')).toBe(true)
    expect(occursOn(t, '2026-07-10')).toBe(true)
  })
})

describe('occurrencesInRange', () => {
  it('collects daily occurrences within the window', () => {
    const t = item({ recurrence: { type: 'daily', interval: 2 }, startDate: '2026-01-01' })
    expect(occurrencesInRange(t, '2026-01-01', '2026-01-08')).toEqual([
      '2026-01-01',
      '2026-01-03',
      '2026-01-05',
      '2026-01-07',
    ])
  })

  it('clips to startDate and endDate', () => {
    const t = item({
      recurrence: { type: 'daily', interval: 1 },
      startDate: '2026-01-05',
      endDate: '2026-01-06',
    })
    expect(occurrencesInRange(t, '2026-01-01', '2026-01-31')).toEqual(['2026-01-05', '2026-01-06'])
  })

  it('returns nothing when the range misses entirely', () => {
    const t = item({ recurrence: { type: 'none' }, startDate: '2026-06-15' })
    expect(occurrencesInRange(t, '2026-01-01', '2026-01-31')).toEqual([])
  })
})

describe('describeRecurrence', () => {
  it('labels the common patterns', () => {
    expect(describeRecurrence({ type: 'none' })).toBe('Once')
    expect(describeRecurrence({ type: 'daily', interval: 1 })).toBe('Every day')
    expect(describeRecurrence({ type: 'daily', interval: 3 })).toBe('Every 3 days')
    expect(describeRecurrence({ type: 'weekly', interval: 1, weekdays: [1, 3, 5] })).toBe(
      'Weekly on Mon, Wed, Fri',
    )
    expect(describeRecurrence({ type: 'monthly', interval: 2, dayOfMonth: 1 })).toBe(
      'Every 2 months on day 1',
    )
  })
})
