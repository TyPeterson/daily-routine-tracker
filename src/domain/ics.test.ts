import { describe, expect, it } from 'vitest'
import { buildCalendar } from './ics'
import type { Task } from '../db/models'
import type { Recurrence } from './recurrence'

const task = (partial: Partial<Task> & { recurrence: Recurrence }): Task => ({
  id: 'abc123',
  title: 'Go for a run',
  notes: '',
  startDate: '2026-07-01',
  goalIds: [],
  createdAt: Date.UTC(2026, 6, 1, 12, 0, 0),
  ...partial,
})

describe('buildCalendar', () => {
  it('emits a valid calendar wrapper with CRLF endings', () => {
    const ics = buildCalendar([])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('X-WR-CALNAME:routine')
  })

  it('daily task becomes an all-day event with FREQ=DAILY', () => {
    const ics = buildCalendar([task({ recurrence: { type: 'daily', interval: 1 } })])
    expect(ics).toContain('UID:abc123@routine')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260701')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).not.toContain('RRULE:FREQ=DAILY;INTERVAL')
  })

  it('timed tasks use floating local times with a duration', () => {
    const ics = buildCalendar([
      task({ recurrence: { type: 'daily', interval: 2 }, timeOfDay: '07:30' }),
    ])
    expect(ics).toContain('DTSTART:20260701T073000')
    expect(ics).toContain('DURATION:PT30M')
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=2')
  })

  it('weekly rules map weekdays to BYDAY and start on a real occurrence', () => {
    // 2026-07-01 is a Wednesday; weekdays Mon only → first occurrence Jul 6
    const ics = buildCalendar([
      task({ recurrence: { type: 'weekly', interval: 1, weekdays: [1] } }),
    ])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260706')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;WKST=SU;BYDAY=MO')
  })

  it('monthly day 31 mirrors the clamping via BYSETPOS', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'monthly', interval: 1, dayOfMonth: 31 },
        startDate: '2026-07-31',
      }),
    ])
    expect(ics).toContain('BYMONTHDAY=28,29,30,31;BYSETPOS=-1')
  })

  it('monthly day 15 uses a plain BYMONTHDAY', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'monthly', interval: 1, dayOfMonth: 15 },
        startDate: '2026-07-15',
      }),
    ])
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=15')
  })

  it('endDate becomes UNTIL, date-only for all-day events', () => {
    const ics = buildCalendar([
      task({ recurrence: { type: 'daily', interval: 1 }, endDate: '2026-08-01' }),
    ])
    expect(ics).toContain('UNTIL=20260801')
  })

  it('skipped days become EXDATEs and shift DTSTART off a skipped start', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'daily', interval: 1 },
        skipDates: ['2026-07-01', '2026-07-03'],
      }),
    ])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260702')
    expect(ics).toContain('EXDATE;VALUE=DATE:20260701,20260703')
  })

  it('extra days become RDATEs without shifting DTSTART', () => {
    // Mondays; 2026-07-01 is a Wednesday → first rule day Jul 6, extras earlier
    const ics = buildCalendar([
      task({
        recurrence: { type: 'weekly', interval: 1, weekdays: [1] },
        extraDates: ['2026-07-02', '2026-07-04'],
      }),
    ])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260706')
    expect(ics).toContain('RDATE;VALUE=DATE:20260702,20260704')
  })

  it('timed extras carry the time of day', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'daily', interval: 1 },
        timeOfDay: '07:30',
        extraDates: ['2026-06-28'],
      }),
    ])
    expect(ics).toContain('RDATE:20260628T073000')
  })

  it('extras the rule already produces emit no RDATE', () => {
    const ics = buildCalendar([
      task({ recurrence: { type: 'daily', interval: 1 }, extraDates: ['2026-07-03'] }),
    ])
    expect(ics).not.toContain('RDATE')
  })

  it('a task with only extra occurrences anchors on the first extra, no RRULE', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'none' },
        skipDates: ['2026-07-01'],
        extraDates: ['2026-07-10'],
      }),
    ])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260710')
    expect(ics).not.toContain('RRULE')
  })

  it('escapes commas and prefixes the emoji in summaries', () => {
    const ics = buildCalendar([
      task({
        recurrence: { type: 'none' },
        title: 'stretch, then run',
        icon: '🏃',
        notes: 'line one\nline two',
      }),
    ])
    expect(ics).toContain('SUMMARY:🏃 stretch\\, then run')
    expect(ics).toContain('DESCRIPTION:line one\\nline two')
  })

  it('archived tasks are left out', () => {
    const ics = buildCalendar([
      task({ recurrence: { type: 'daily', interval: 1 }, archivedAt: 1 }),
    ])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
