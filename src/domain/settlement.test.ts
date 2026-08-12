import { describe, expect, it } from 'vitest'
import { addDaysStr, startOfWeekStr } from './dates'
import {
  aggregateMissesByFriend,
  aggregateMissesByTask,
  buildPayouts,
  computeWeekSettlement,
  formatMoney,
  isOverdue,
  weeksToSettle,
  type FriendLike,
  type MissLine,
  type WagerTaskLike,
} from './settlement'

// week under test: Sun 2026-01-04 .. Sat 2026-01-10
const WEEK_START = '2026-01-04'
const WEEK_END = '2026-01-10'

const task = (partial: Partial<WagerTaskLike>): WagerTaskLike => ({
  id: 't1',
  title: 'Exercise',
  recurrence: { type: 'daily', interval: 1 },
  startDate: '2026-01-01',
  wagerCents: 300,
  wagerFriendId: 'f1',
  ...partial,
})

const miss = (partial: Partial<MissLine>): MissLine => ({
  taskId: 't1',
  title: 'Exercise',
  icon: '🏃',
  date: '2026-01-05',
  amountCents: 300,
  friendId: 'f1',
  ...partial,
})

const keys = (taskId: string, dates: string[]) => new Set(dates.map((d) => `${taskId}|${d}`))

describe('weeksToSettle', () => {
  it('emits nothing mid-week when last week is already settled', () => {
    expect(weeksToSettle('2026-01-03', '2026-01-07')).toEqual([])
  })

  it('on Sunday, settles exactly the week that just ended', () => {
    // 2026-01-11 is a Sunday
    expect(weeksToSettle('2026-01-03', '2026-01-11')).toEqual([
      { weekStart: '2026-01-04', weekEnd: '2026-01-10' },
    ])
  })

  it('a multi-week gap emits every complete week, never the current one', () => {
    // 2026-01-26 is a Monday in the week of Jan 25–31
    expect(weeksToSettle('2026-01-03', '2026-01-26')).toEqual([
      { weekStart: '2026-01-04', weekEnd: '2026-01-10' },
      { weekStart: '2026-01-11', weekEnd: '2026-01-17' },
      { weekStart: '2026-01-18', weekEnd: '2026-01-24' },
    ])
  })

  it('emits nothing when settledThrough is in the future (clock skew)', () => {
    expect(weeksToSettle('2026-02-28', '2026-01-11')).toEqual([])
  })

  it('every span is a Sunday-to-Saturday week even from a mid-week anchor', () => {
    const weeks = weeksToSettle('2026-01-06', '2026-01-26')
    expect(weeks.length).toBeGreaterThan(0)
    for (const w of weeks) {
      expect(startOfWeekStr(w.weekStart)).toBe(w.weekStart)
      expect(w.weekEnd).toBe(addDaysStr(w.weekStart, 6))
    }
  })
})

describe('computeWeekSettlement', () => {
  it('bills every uncompleted occurrence and wagers all of them', () => {
    const t = task({})
    const done = keys('t1', ['2026-01-04', '2026-01-06', '2026-01-08'])
    const { wageredCents, misses } = computeWeekSettlement([t], done, WEEK_START, WEEK_END)
    expect(wageredCents).toBe(7 * 300)
    expect(misses.map((m) => m.date)).toEqual([
      '2026-01-05',
      '2026-01-07',
      '2026-01-09',
      '2026-01-10',
    ])
    expect(misses[0]).toMatchObject({ taskId: 't1', title: 'Exercise', amountCents: 300, friendId: 'f1' })
  })

  it('a deleted (skipped) day is neither wagered nor billed', () => {
    const t = task({ skipDates: ['2026-01-05'] })
    const { wageredCents, misses } = computeWeekSettlement([t], new Set(), WEEK_START, WEEK_END)
    expect(wageredCents).toBe(6 * 300)
    expect(misses.some((m) => m.date === '2026-01-05')).toBe(false)
  })

  it('an extra occurrence outside the rule is wagered and billable', () => {
    // Mondays only, plus an extra Friday
    const t = task({
      recurrence: { type: 'weekly', interval: 1, weekdays: [1] },
      extraDates: ['2026-01-09'],
    })
    const { wageredCents, misses } = computeWeekSettlement([t], new Set(), WEEK_START, WEEK_END)
    expect(wageredCents).toBe(2 * 300) // Mon Jan 5 + extra Fri Jan 9
    expect(misses.map((m) => m.date)).toEqual(['2026-01-05', '2026-01-09'])
  })

  it('skip beats extra on the same date', () => {
    const t = task({
      recurrence: { type: 'weekly', interval: 1, weekdays: [1] },
      extraDates: ['2026-01-09'],
      skipDates: ['2026-01-09'],
    })
    const { wageredCents, misses } = computeWeekSettlement([t], new Set(), WEEK_START, WEEK_END)
    expect(wageredCents).toBe(300)
    expect(misses.map((m) => m.date)).toEqual(['2026-01-05'])
  })

  it('one-time tasks: billed when missed, clean when completed, ignored outside the week', () => {
    const laundry = task({ id: 'laundry', recurrence: { type: 'none' }, startDate: '2026-01-06', wagerCents: 500 })
    const missed = computeWeekSettlement([laundry], new Set(), WEEK_START, WEEK_END)
    expect(missed.misses).toHaveLength(1)
    expect(missed.wageredCents).toBe(500)

    const done = computeWeekSettlement([laundry], keys('laundry', ['2026-01-06']), WEEK_START, WEEK_END)
    expect(done.misses).toHaveLength(0)
    expect(done.wageredCents).toBe(500) // still counted as at stake

    const nextWeek = task({ id: 'laundry2', recurrence: { type: 'none' }, startDate: '2026-01-12' })
    expect(computeWeekSettlement([nextWeek], new Set(), WEEK_START, WEEK_END).wageredCents).toBe(0)
  })

  it('ignores tasks without a fully configured wager, and archived tasks', () => {
    const noWager = task({ id: 'a', wagerCents: undefined, wagerFriendId: undefined })
    const noFriend = task({ id: 'b', wagerFriendId: undefined })
    const zero = task({ id: 'c', wagerCents: 0 })
    const archived = task({ id: 'd', archivedAt: 123 })
    const { wageredCents, misses } = computeWeekSettlement(
      [noWager, noFriend, zero, archived],
      new Set(),
      WEEK_START,
      WEEK_END,
    )
    expect(wageredCents).toBe(0)
    expect(misses).toHaveLength(0)
  })

  it('respects the task window at week edges', () => {
    const startsMidWeek = task({ startDate: '2026-01-08' })
    const endedEarlier = task({ id: 't2', endDate: '2026-01-06' })
    const r1 = computeWeekSettlement([startsMidWeek], new Set(), WEEK_START, WEEK_END)
    expect(r1.misses.map((m) => m.date)).toEqual(['2026-01-08', '2026-01-09', '2026-01-10'])
    const r2 = computeWeekSettlement([endedEarlier], new Set(), WEEK_START, WEEK_END)
    expect(r2.misses.map((m) => m.date)).toEqual(['2026-01-04', '2026-01-05', '2026-01-06'])
  })

  it('sums wagers across multiple tasks and friends', () => {
    const exercise = task({}) // 7 × $3 to f1
    const teeth = task({ id: 't2', title: 'Brush Teeth', wagerCents: 200, wagerFriendId: 'f1' })
    const calories = task({ id: 't3', title: 'Calories', wagerCents: 200, wagerFriendId: 'f2' })
    const done = new Set([...keys('t3', ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])])
    const { wageredCents, misses } = computeWeekSettlement([exercise, teeth, calories], done, WEEK_START, WEEK_END)
    expect(wageredCents).toBe(7 * 300 + 7 * 200 + 7 * 200)
    expect(misses.filter((m) => m.taskId === 't3')).toHaveLength(0)
    expect(misses).toHaveLength(14)
  })
})

describe('buildPayouts', () => {
  const friends: FriendLike[] = [
    { id: 'f1', firstName: 'Hunter', lastName: 'Garret', handle: 'huntgar123' },
    { id: 'f2', firstName: 'Ally', handle: 'allygpete' },
  ]

  it('groups misses across tasks into one payout per friend', () => {
    const misses = [
      miss({ amountCents: 300 }),
      miss({ taskId: 't2', title: 'Brush Teeth', date: '2026-01-06', amountCents: 200 }),
      miss({ taskId: 't3', title: 'Laundry', friendId: 'f2', amountCents: 500 }),
    ]
    const payouts = buildPayouts(misses, friends)
    expect(payouts).toEqual([
      { friendId: 'f1', name: 'Hunter Garret', handle: 'huntgar123', amountCents: 500 },
      { friendId: 'f2', name: 'Ally', handle: 'allygpete', amountCents: 500 },
    ])
  })

  it('skips misses pointing at an unknown friend', () => {
    expect(buildPayouts([miss({ friendId: 'ghost' })], friends)).toEqual([])
  })
})

describe('aggregate helpers', () => {
  it('counts per task, ordered by first miss date then title', () => {
    const misses = [
      miss({ taskId: 'b', title: 'Brush Teeth', icon: undefined, date: '2026-01-06', amountCents: 200 }),
      miss({ date: '2026-01-05' }),
      miss({ date: '2026-01-07' }),
    ]
    expect(aggregateMissesByTask(misses)).toEqual([
      { taskId: 't1', title: 'Exercise', icon: '🏃', count: 2, amountCents: 600 },
      { taskId: 'b', title: 'Brush Teeth', icon: undefined, count: 1, amountCents: 200 },
    ])
  })

  it('totals per friend', () => {
    const totals = aggregateMissesByFriend([
      miss({}),
      miss({ date: '2026-01-06' }),
      miss({ friendId: 'f2', amountCents: 500 }),
    ])
    expect(totals.get('f1')).toBe(600)
    expect(totals.get('f2')).toBe(500)
  })
})

describe('isOverdue', () => {
  it('counts an untimed task all day', () => {
    expect(isOverdue(undefined, '00:00')).toBe(true)
    expect(isOverdue(undefined, '23:59')).toBe(true)
  })

  it('counts a timed task only once its time arrives', () => {
    expect(isOverdue('08:00', '07:59')).toBe(false)
    expect(isOverdue('08:00', '08:00')).toBe(true)
    expect(isOverdue('08:00', '09:30')).toBe(true)
  })

  it('compares padded hours correctly across the morning boundary', () => {
    expect(isOverdue('09:30', '10:00')).toBe(true)
    expect(isOverdue('21:00', '09:00')).toBe(false)
  })
})

describe('formatMoney', () => {
  it('drops cents when whole, keeps two places otherwise', () => {
    expect(formatMoney(600)).toBe('$6')
    expect(formatMoney(650)).toBe('$6.50')
    expect(formatMoney(5)).toBe('$0.05')
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(12345)).toBe('$123.45')
  })
})
