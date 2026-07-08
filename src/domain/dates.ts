import { addDays, format } from 'date-fns'

/**
 * Local calendar date as 'YYYY-MM-DD'. All scheduling and completion keys use
 * these instead of Date/ISO timestamps so a "day" always means the user's
 * local day (no UTC off-by-one issues).
 */
export type DateStr = string

export function toDateStr(d: Date): DateStr {
  return format(d, 'yyyy-MM-dd')
}

/** Parse to a Date at local midnight. */
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): DateStr {
  return toDateStr(new Date())
}

export function addDaysStr(s: DateStr, n: number): DateStr {
  return toDateStr(addDays(fromDateStr(s), n))
}

/** '07:30' → '7:30 AM' */
export function formatTimeOfDay(t: string): string {
  const [h = 0, m = 0] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
