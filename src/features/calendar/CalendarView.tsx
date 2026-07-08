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
import { Screen } from '../../components/Screen'
import { db } from '../../db/schema'
import { toDateStr, todayStr, type DateStr } from '../../domain/dates'
import { occurrencesInRange } from '../../domain/recurrence'
import { useSwipeNav } from '../../hooks/useSwipe'
import { DaySheet } from './DaySheet'

interface DayStats {
  total: number
  done: number
}

/** Per-day occurrence/completion counts for the visible grid. */
function useDayStats(rangeStart: DateStr, rangeEnd: DateStr) {
  return useLiveQuery(async () => {
    const [tasks, completions] = await Promise.all([
      db.tasks.toArray(),
      db.completions.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
    ])
    const done = new Set(completions.map((c) => `${c.taskId}|${c.date}`))
    const map = new Map<DateStr, DayStats>()
    for (const task of tasks) {
      if (task.archivedAt) continue
      for (const d of occurrencesInRange(task, rangeStart, rangeEnd)) {
        const entry = map.get(d) ?? { total: 0, done: 0 }
        entry.total++
        if (done.has(`${task.id}|${d}`)) entry.done++
        map.set(d, entry)
      }
    }
    return map
  }, [rangeStart, rangeEnd])
}

const WEEKDAY_HEADER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarView() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<DateStr | null>(null)

  const gridStart = startOfWeek(month, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const stats = useDayStats(toDateStr(gridStart), toDateStr(gridEnd))

  const swipe = useSwipeNav(
    () => setMonth((m) => addMonths(m, -1)),
    () => setMonth((m) => addMonths(m, 1)),
  )
  const today = todayStr()
  const isCurrentMonth = isSameMonth(month, new Date())

  return (
    <div className="h-full" {...swipe}>
      <Screen
        title={format(month, 'MMMM')}
        subtitle={format(month, 'yyyy')}
        right={
          <>
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
          </>
        }
      >
        <div className="rounded-2xl bg-surface p-2 pb-3">
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-ink-dim">
            {WEEKDAY_HEADER.map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((d) => {
              const ds = toDateStr(d)
              const s = stats?.get(ds)
              const inMonth = isSameMonth(d, month)
              const isToday = ds === today
              const dots = s ? Math.min(4, s.total) : 0
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setSelected(ds)}
                  className="flex flex-col items-center gap-1 py-1"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] ${
                      isToday
                        ? 'bg-accent font-bold text-white'
                        : inMonth
                          ? ''
                          : 'text-ink-dim/40'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex h-1.5 items-center gap-[3px]">
                    {Array.from({ length: dots }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${
                          s && i < s.done ? 'bg-good' : 'bg-ink-dim/30'
                        }`}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-3 px-2 text-center text-[12px] text-ink-dim">
          Swipe to change months · tap a day to see its tasks
        </p>
      </Screen>
      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
