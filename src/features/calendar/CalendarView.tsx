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
import type { Goal, Task } from '../../db/models'
import { toDateStr, todayStr, type DateStr } from '../../domain/dates'
import { occurrencesInRange } from '../../domain/recurrence'
import { effectiveTaskColor } from '../../domain/taskColor'
import { useGoalsMap } from '../../hooks/useGoals'
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
  goals,
  onSelect,
}: {
  day: Date
  inMonth: boolean
  isToday: boolean
  entries: DayEntry[]
  goals: Map<string, Goal>
  onSelect: () => void
}) {
  const overflow = entries.length - MAX_PREVIEWS
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-0 flex-col items-stretch gap-1 overflow-hidden rounded-lg p-0.5 pt-1 text-left transition-colors duration-150 active:bg-surface2/70 ${
        inMonth ? '' : 'opacity-35'
      }`}
    >
      <span
        className={`mx-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
          isToday ? 'border border-edge bg-accent font-bold text-on-accent' : 'font-semibold'
        }`}
      >
        {day.getDate()}
      </span>
      <span className="flex min-h-0 flex-col gap-[3px] overflow-hidden">
        {entries.slice(0, MAX_PREVIEWS).map(({ task, completed }) => {
          const inherited = effectiveTaskColor(task, goals)
          return (
            <span
              key={task.id}
              className={`flex shrink-0 items-center gap-[2px] truncate rounded-[3px] px-[3px] py-[1.5px] text-[9px] leading-[1.25] font-bold ${
                completed ? 'line-through opacity-40' : ''
              }`}
              style={{
                background: inherited ? `${inherited}26` : 'var(--accent-soft)',
                color: inherited ?? 'var(--accent)',
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
  const goals = useGoalsMap()

  const today = todayStr()
  const isCurrentMonth = isSameMonth(month, new Date())

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe px-5 pb-2">
        <div className="flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.14em] text-ink-dim uppercase">
              {format(month, 'yyyy')}
            </p>
            <h1 className="truncate text-[27px] leading-tight font-bold tracking-tight">
              {format(month, 'MMMM').toLowerCase()}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonth(startOfMonth(new Date()))}
                className="key mr-1 px-3 py-1.5 text-[12px] font-bold text-accent"
              >
                today
              </button>
            )}
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-left" size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-right" size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="grid shrink-0 grid-cols-7 text-center text-[10px] font-bold tracking-[0.1em] text-ink-dim">
          {WEEKDAY_HEADER.map((d, i) => (
            <span key={i} className="py-1.5">
              {d}
            </span>
          ))}
        </div>
        <div
          className="module grid max-h-[66dvh] min-h-0 flex-1 grid-cols-7 gap-[3px] p-1.5"
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
                goals={goals}
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
