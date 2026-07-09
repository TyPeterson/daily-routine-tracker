import { useState } from 'react'
import { format } from 'date-fns'
import { EmptyState } from '../../components/EmptyState'
import { Fab } from '../../components/Fab'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { toggleCompletion } from '../../db/repo'
import type { Task } from '../../db/models'
import { addDaysStr, fromDateStr, todayStr } from '../../domain/dates'
import { useGoalsMap } from '../../hooks/useGoals'
import { useSwipeNav } from '../../hooks/useSwipe'
import { useTasksForDate } from '../../hooks/useTasksForDate'
import { TaskCheckInFlow } from '../goals/TaskCheckInFlow'
import { TaskEditorSheet } from '../tasks/TaskEditorSheet'
import { TaskRow } from './TaskRow'

export default function TodayView() {
  const [date, setDate] = useState(todayStr())
  const dayTasks = useTasksForDate(date)
  const goals = useGoalsMap()
  const [editor, setEditor] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [checkInTask, setCheckInTask] = useState<Task | null>(null)
  const swipe = useSwipeNav(
    () => setDate((d) => addDaysStr(d, -1)),
    () => setDate((d) => addDaysStr(d, 1)),
  )

  const isToday = date === todayStr()
  const day = fromDateStr(date)
  const remaining = dayTasks?.filter((t) => !t.completed).length ?? 0

  return (
    <div className="h-full" {...swipe}>
      <Screen
        title={isToday ? 'today' : format(day, 'EEEE').toLowerCase()}
        subtitle={format(day, 'MMM d yyyy')}
        right={
          <>
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(todayStr())}
                className="key mr-1 px-3 py-1.5 text-[12px] font-bold text-accent"
              >
                today
              </button>
            )}
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setDate((d) => addDaysStr(d, -1))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-left" size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setDate((d) => addDaysStr(d, 1))}
              className="key flex h-9 w-9 items-center justify-center text-ink"
            >
              <Icon name="chevron-right" size={16} strokeWidth={2.5} />
            </button>
          </>
        }
      >
        {dayTasks && dayTasks.length > 0 && (
          <>
            <p className="mb-2 px-1 text-[11px] font-bold tracking-[0.1em] text-ink-dim">
              <span className="text-accent">{String(remaining).padStart(2, '0')}</span>{' '}
              {remaining === 0 ? 'remaining — all done' : 'remaining'}
            </p>
            <div className="module divide-y divide-line overflow-hidden">
              {dayTasks.map(({ task, completed }) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  completed={completed}
                  goals={goals}
                  onToggle={() => void toggleCompletion(task.id, date)}
                  onOpen={() => setEditor({ open: true, task })}
                  onCheckIn={() => setCheckInTask(task)}
                />
              ))}
            </div>
          </>
        )}
        {dayTasks && dayTasks.length === 0 && (
          <EmptyState
            icon="sun"
            title="nothing scheduled"
            hint="tap + to add a task for this day"
          />
        )}
      </Screen>
      <Fab label="Add task" onClick={() => setEditor({ open: true })} />
      {editor.open && (
        <TaskEditorSheet
          task={editor.task}
          defaultDate={date}
          onClose={() => setEditor({ open: false })}
        />
      )}
      {checkInTask && (
        <TaskCheckInFlow task={checkInTask} onClose={() => setCheckInTask(null)} />
      )}
    </div>
  )
}
