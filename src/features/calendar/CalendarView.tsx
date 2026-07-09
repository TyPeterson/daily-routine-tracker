import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { db } from '../../db/schema'
import type { Task } from '../../db/models'
import { toDateStr, todayStr, type DateStr } from '../../domain/dates'
import { occurrencesInRange } from '../../domain/recurrence'
import { useSwipeNav } from '../../hooks/useSwipe'
import { DaySheet } from './DaySheet'

interface DayEntry {
  task: Task
  completed: boolean
}

const MAX_PREVIEWS = 3

/** Occurrences (with done state) for every day in the visible grid. */
function useMonthOccurrences(rangeStart: DateStr, rangeEnd: DateStr) {
  return useLiveQuery(async () => {
    const [tasks, completions] = await Promise.all([
      db.tasks.toArray(),
      db.completions.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
    ])
    const done = new Set(completions.map((c) => `${c.taskId}|${c.date}`))
    const map = new Map<DateStr, DayEntry[]>()
    for (const task of tasks) {
      if (task.archivedAt) continue
      for (const d of occurrencesInRange(task, rangeStart, rangeEnd)) {
        const list = map.get(d) ?? []
        list.push({ task, completed: done.has(`${task.id}|${d}`) })
        map.set(d, list)
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = a.task.timeOfDay ?? '99'
        const tb = b.task.timeOfDay ?? '99'
        return ta === tb ? a.task.title.localeCompare(b.task.title) : ta < tb ? -1 : 1
      })
    }
    return map
  }, [rangeStart, rangeEnd])
}

function DayCell({
  day,
  inMonth,
  isToday,
  entries,
  onSelect,
}: {
  day: Date
  inMonth: boolean
  isToday: boolean
  entries: DayEntry[]
  onSelect: () => void
}) {
  const overflow = entries.length - MAX_PREVIEWS
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-0 flex-col items-stretch gap-1 overflow-hidden rounded-lg p-0.5 pt-1 text-left ${
        inMonth ? '' : 'opacity-35'
      }`}
    >
      <span
        className={`mx-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] ${
          isToday ? 'bg-accent font-bold text-white' : 'font-medium'
        }`}
      >
        {day.getDate()}
      </span>
      <span className="flex min-h-0 flex-col gap-[3px] overflow-hidden">
        {entries.slice(0, MAX_PREVIEWS).map(({ task, completed }) => {
          const color = task.color ?? 'var(--accent)'
          return (
            <span
              key={task.id}
              className={`flex shrink-0 items-center gap-[2px] truncate rounded-[4px] px-[3px] py-[1.5px] text-[9px] leading-[1.25] font-semibold ${
                completed ? 'line-through opacity-40' : ''
              }`}
              style={{
                background: task.color ? `${task.color}26` : 'var(--accent-soft)',
                color,
              }}
            >
              {task.icon && <span className="shrink-0 text-[9px]">{task.icon}</span>}
              <span className="truncate">{task.title}</span>
            </span>
          )
        })}
        {overflow > 0 && (
          <span className="px-[3px] text-[9px] font-medium text-ink-dim">+{overflow} more</span>
        )}
      </span>
    </button>
  )
}

const WEEKDAY_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarView() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<DateStr | null>(null)

  const gridStart = startOfWeek(month, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks = days.length / 7
  const occurrences = useMonthOccurrences(toDateStr(gridStart), toDateStr(gridEnd))

  const swipe = useSwipeNav(
    () => setMonth((m) => addMonths(m, -1)),
    () => setMonth((m) => addMonths(m, 1)),
  )
  const today = todayStr()
  const isCurrentMonth = isSameMonth(month, new Date())

  return (
    <div className="flex h-full flex-col" {...swipe}>
      <header className="pt-safe px-5 pb-2">
        <div className="flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-dim">{format(month, 'yyyy')}</p>
            <h1 className="truncate text-[28px] leading-tight font-bold">
              {format(month, 'MMMM')}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pb-1">
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonth(startOfMonth(new Date()))}
                className="mr-1 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent"
              >
                Today
              </button>
            )}
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="rounded-full bg-surface p-2 text-ink-dim"
            >
              <Icon name="chevron-left" size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="rounded-full bg-surface p-2 text-ink-dim"
            >
              <Icon name="chevron-right" size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="grid shrink-0 grid-cols-7 text-center text-[11px] font-semibold text-ink-dim">
          {WEEKDAY_HEADER.map((d, i) => (
            <span key={i} className="py-1.5">
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid min-h-0 flex-1 grid-cols-7 gap-[3px] rounded-2xl bg-surface p-1.5"
          style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {days.map((d) => {
            const ds = toDateStr(d)
            return (
              <DayCell
                key={ds}
                day={d}
                inMonth={isSameMonth(d, month)}
                isToday={ds === today}
                entries={occurrences?.get(ds) ?? []}
                onSelect={() => setSelected(ds)}
              />
            )
          })}
        </div>
      </div>

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
