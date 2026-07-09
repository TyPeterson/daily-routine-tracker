import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  getDate,
  getDay,
  getDaysInMonth,
} from 'date-fns'
import { addDaysStr, fromDateStr, type DateStr } from './dates'

/**
 * How a task repeats. Extend this union to support new patterns
 * (e.g. "last weekday of month") — occursOn is the only place that
 * interprets it.
 */
export type Recurrence =
  | { type: 'none' }
  | { type: 'daily'; interval: number }
  | { type: 'weekly'; interval: number; weekdays: number[] } // 0=Sun..6=Sat
  | { type: 'monthly'; interval: number; dayOfMonth: number } // clamped to month length

export interface Schedulable {
  recurrence: Recurrence
  startDate: DateStr
  endDate?: DateStr
  /** dates explicitly removed from the series (deleted/split occurrences) */
  skipDates?: DateStr[]
}

/** Does this item have an occurrence on the given local date? */
export function occursOn(item: Schedulable, date: DateStr): boolean {
  // DateStr sorts lexicographically in chronological order
  if (date < item.startDate) return false
  if (item.endDate && date > item.endDate) return false
  if (item.skipDates?.includes(date)) return false

  const rec = item.recurrence
  const start = fromDateStr(item.startDate)
  const day = fromDateStr(date)

  switch (rec.type) {
    case 'none':
      return date === item.startDate
    case 'daily':
      return differenceInCalendarDays(day, start) % Math.max(1, rec.interval) === 0
    case 'weekly': {
      if (!rec.weekdays.includes(getDay(day))) return false
      // anchor the "every N weeks" cycle to the week containing startDate
      const weeks = differenceInCalendarWeeks(day, start, { weekStartsOn: 0 })
      return weeks % Math.max(1, rec.interval) === 0
    }
    case 'monthly': {
      const months = differenceInCalendarMonths(day, start)
      if (months % Math.max(1, rec.interval) !== 0) return false
      // day 31 in a 30-day month falls on the 30th, etc.
      const target = Math.min(rec.dayOfMonth, getDaysInMonth(day))
      return getDate(day) === target
    }
  }
}

/** All occurrence dates within [rangeStart, rangeEnd], inclusive. */
export function occurrencesInRange(
  item: Schedulable,
  rangeStart: DateStr,
  rangeEnd: DateStr,
): DateStr[] {
  const out: DateStr[] = []
  let cur = rangeStart < item.startDate ? item.startDate : rangeStart
  const last = item.endDate && item.endDate < rangeEnd ? item.endDate : rangeEnd
  while (cur <= last) {
    if (occursOn(item, cur)) out.push(cur)
    cur = addDaysStr(cur, 1)
  }
  return out
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short human label, e.g. "Every day", "Weekly on Mon, Wed, Fri". */
export function describeRecurrence(rec: Recurrence): string {
  switch (rec.type) {
    case 'none':
      return 'Once'
    case 'daily':
      return rec.interval === 1 ? 'Every day' : `Every ${rec.interval} days`
    case 'weekly': {
      const days = [...rec.weekdays]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d])
        .join(', ')
      const prefix = rec.interval === 1 ? 'Weekly' : `Every ${rec.interval} weeks`
      return days ? `${prefix} on ${days}` : prefix
    }
    case 'monthly': {
      const prefix = rec.interval === 1 ? 'Monthly' : `Every ${rec.interval} months`
      return `${prefix} on day ${rec.dayOfMonth}`
    }
  }
}
