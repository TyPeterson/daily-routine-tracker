import { useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { Fab } from '../../components/Fab'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { toggleCompletion } from '../../db/repo'
import type { Goal, Task } from '../../db/models'
import { addDaysStr, fromDateStr, toDateStr, todayStr, type DateStr } from '../../domain/dates'
import { useGoalsMap } from '../../hooks/useGoals'
import { useTasksForDate } from '../../hooks/useTasksForDate'
import { TaskCheckInFlow } from '../goals/TaskCheckInFlow'
import { TaskEditorSheet } from '../tasks/TaskEditorSheet'
import { TaskRow } from './TaskRow'

/** One day's checklist inside the week view. */
function DaySection({
  date,
  isToday,
  goals,
  onOpen,
  onCheckIn,
}: {
  date: DateStr
  isToday: boolean
  goals: Map<string, Goal>
  onOpen: (task: Task) => void
  onCheckIn: (task: Task) => void
}) {
  const dayTasks = useTasksForDate(date)
  if (!dayTasks) return null
  const done = dayTasks.filter((t) => t.completed).length

  return (
    <section className="mb-5">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <p className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">
          {isToday && <span className="mr-1.5 text-accent">today</span>}
          {format(fromDateStr(date), 'EEE MMM d').toLowerCase()}
        </p>
        {dayTasks.length > 0 && (
          <span className="text-[11px] font-bold text-ink-dim">
            {String(done).padStart(2, '0')}/{String(dayTasks.length).padStart(2, '0')}
          </span>
        )}
      </div>
      {dayTasks.length > 0 ? (
        <div className="module divide-y divide-line overflow-hidden">
          {dayTasks.map(({ task, completed }) => (
            <TaskRow
              key={task.id}
              task={task}
              completed={completed}
              goals={goals}
              onToggle={() => void toggleCompletion(task.id, date)}
              onOpen={() => onOpen(task)}
              onCheckIn={() => onCheckIn(task)}
            />
          ))}
        </div>
      ) : (
        <p className="px-1 text-[12px] text-ink-dim/70">nothing scheduled</p>
      )}
    </section>
  )
}

export default function TodayView() {
  const today = todayStr()
  const currentWeekStart = toDateStr(startOfWeek(fromDateStr(today), { weekStartsOn: 0 }))
  const [weekStart, setWeekStart] = useState(currentWeekStart)
  const goals = useGoalsMap()
  const [editor, setEditor] = useState<{ open: boolean; task?: Task; date: DateStr }>({
    open: false,
    date: today,
  })
  const [checkIn, setCheckIn] = useState<{ task: Task; date: DateStr } | null>(null)

  const isCurrentWeek = weekStart === currentWeekStart
  // newest day on top; the current week runs week-to-date (no future days)
  const lastShown = isCurrentWeek ? today : addDaysStr(weekStart, 6)
  const days: DateStr[] = []
  for (let d = lastShown; d >= weekStart; d = addDaysStr(d, -1)) days.push(d)

  const weekEnd = addDaysStr(weekStart, 6)
  const range = `${format(fromDateStr(weekStart), 'MMM d')} – ${format(fromDateStr(weekEnd), 'MMM d')}`

  return (
    <div className="h-full">
      <Screen
        title={isCurrentWeek ? 'this week' : `week of ${format(fromDateStr(weekStart), 'MMM d').toLowerCase()}`}
        subtitle={range}
        right={
          <>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setWeekStart(currentWeekStart)}
                className="key mr-1 px-3 py-1.5 text-[12px] font-bold text-accent"
              >
                today
              </button>
            )}
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekStart((w) => addDaysStr(w, -7))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-left" size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekStart((w) => addDaysStr(w, 7))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-right" size={16} strokeWidth={2.5} />
            </button>
          </>
        }
      >
        {days.map((d) => (
          <DaySection
            key={d}
            date={d}
            isToday={d === today}
            goals={goals}
            onOpen={(task) => setEditor({ open: true, task, date: d })}
            onCheckIn={(task) => setCheckIn({ task, date: d })}
          />
        ))}
      </Screen>
      <Fab
        label="Add task"
        onClick={() => setEditor({ open: true, date: isCurrentWeek ? today : weekStart })}
      />
      {editor.open && (
        <TaskEditorSheet
          task={editor.task}
          defaultDate={editor.date}
          onClose={() => setEditor((e) => ({ ...e, open: false, task: undefined }))}
        />
      )}
      {checkIn && (
        <TaskCheckInFlow
          task={checkIn.task}
          date={checkIn.date}
          onClose={() => setCheckIn(null)}
        />
      )}
    </div>
  )
}
