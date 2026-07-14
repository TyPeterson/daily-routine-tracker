import type { Task } from '../db/models'
import { addDaysStr, type DateStr } from './dates'
import { occursOn } from './recurrence'

/**
 * iCalendar (RFC 5545) feed of the task schedule, for subscription in Apple
 * Calendar etc. Recurrence maps onto native RRULEs so the calendar app
 * expands occurrences itself — the feed stays tiny and repeats forever.
 */

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const dateStamp = (d: DateStr) => d.replaceAll('-', '')
const timeStamp = (t: string) => `${t.replace(':', '')}00`

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545 line folding — conservative width to stay under 75 octets with emoji. */
function fold(line: string): string {
  if (line.length <= 60) return line
  const parts: string[] = []
  for (let i = 0; i < line.length; i += 60) parts.push(line.slice(i, i + 60))
  return parts.join('\r\n ')
}

/**
 * DTSTART must be an actual occurrence, which the anchor date isn't always
 * (weekly rules whose start date's weekday isn't selected, skipped days).
 */
function firstOccurrence(task: Task): DateStr | null {
  let d = task.startDate
  for (let i = 0; i < 740; i++) {
    if (occursOn(task, d)) return d
    d = addDaysStr(d, 1)
  }
  return null
}

function rrule(task: Task): string | null {
  const rec = task.recurrence
  if (rec.type === 'none') return null

  const parts: string[] = []
  if (rec.type === 'daily') {
    parts.push('FREQ=DAILY')
    if (rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`)
  } else if (rec.type === 'weekly') {
    parts.push('FREQ=WEEKLY', 'WKST=SU')
    if (rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`)
    const days = [...rec.weekdays].sort((a, b) => a - b).map((d) => BYDAY[d])
    if (days.length > 0) parts.push(`BYDAY=${days.join(',')}`)
  } else {
    parts.push('FREQ=MONTHLY')
    if (rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`)
    if (rec.dayOfMonth <= 28) {
      parts.push(`BYMONTHDAY=${rec.dayOfMonth}`)
    } else {
      // mirror the engine's clamping (31st → last day of short months):
      // the latest existing day among 28..dayOfMonth
      const candidates = []
      for (let d = 28; d <= rec.dayOfMonth; d++) candidates.push(d)
      parts.push(`BYMONTHDAY=${candidates.join(',')}`, 'BYSETPOS=-1')
    }
  }
  if (task.endDate) {
    parts.push(
      task.timeOfDay
        ? `UNTIL=${dateStamp(task.endDate)}T235959`
        : `UNTIL=${dateStamp(task.endDate)}`,
    )
  }
  return parts.join(';')
}

/** DTSTAMP derived from creation time so repeated builds are byte-identical. */
function dtStamp(createdAt: number): string {
  return `${new Date(createdAt).toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

export function buildCalendar(tasks: Task[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//routine//daily routine tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:routine',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]

  const active = [...tasks]
    .filter((t) => !t.archivedAt)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const task of active) {
    // anchor DTSTART on the rule alone — an off-rule extra day must not shift
    // it, or the exported RRULE would expand from the wrong date
    const ruleTask = { ...task, extraDates: undefined }
    const ruleStart = firstOccurrence(ruleTask)
    const extras = (task.extraDates ?? [])
      .filter((d) => occursOn(task, d) && !occursOn(ruleTask, d))
      .sort()
    const start = ruleStart ?? extras[0]
    if (!start) continue

    lines.push('BEGIN:VEVENT', `UID:${task.id}@routine`, `DTSTAMP:${dtStamp(task.createdAt)}`)
    lines.push(`SUMMARY:${escapeText((task.icon ? `${task.icon} ` : '') + task.title)}`)

    if (task.timeOfDay) {
      // floating local time: 7 am is 7 am wherever the phone is
      lines.push(`DTSTART:${dateStamp(start)}T${timeStamp(task.timeOfDay)}`, 'DURATION:PT30M')
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`)
    }

    // a task whose only occurrences are extras has no valid rule anchor
    const rule = ruleStart ? rrule(task) : null
    if (rule) lines.push(`RRULE:${rule}`)

    const skips = (task.skipDates ?? []).filter((d) => d !== start || !occursOn(task, d))
    if (skips.length > 0) {
      const stamps = [...skips].sort()
      lines.push(
        task.timeOfDay
          ? `EXDATE:${stamps.map((d) => `${dateStamp(d)}T${timeStamp(task.timeOfDay!)}`).join(',')}`
          : `EXDATE;VALUE=DATE:${stamps.map(dateStamp).join(',')}`,
      )
    }

    const rdates = extras.filter((d) => d !== start)
    if (rdates.length > 0) {
      lines.push(
        task.timeOfDay
          ? `RDATE:${rdates.map((d) => `${dateStamp(d)}T${timeStamp(task.timeOfDay!)}`).join(',')}`
          : `RDATE;VALUE=DATE:${rdates.map(dateStamp).join(',')}`,
      )
    }

    if (task.notes) lines.push(`DESCRIPTION:${escapeText(task.notes)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
