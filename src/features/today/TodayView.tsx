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
import { TaskEditorSheet } from '../tasks/TaskEditorSheet'
import { TaskRow } from './TaskRow'

export default function TodayView() {
  const [date, setDate] = useState(todayStr())
  const dayTasks = useTasksForDate(date)
  const goals = useGoalsMap()
  const [editor, setEditor] = useState<{ open: boolean; task?: Task }>({ open: false })
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
        title={isToday ? 'Today' : format(day, 'EEEE')}
        subtitle={format(day, 'MMMM d, yyyy')}
        right={
          <>
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(todayStr())}
                className="mr-1 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent"
              >
                Today
              </button>
            )}
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setDate((d) => addDaysStr(d, -1))}
              className="rounded-full bg-surface p-2 text-ink-dim"
            >
              <Icon name="chevron-left" size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setDate((d) => addDaysStr(d, 1))}
              className="rounded-full bg-surface p-2 text-ink-dim"
            >
              <Icon name="chevron-right" size={18} strokeWidth={2.5} />
            </button>
          </>
        }
      >
        {dayTasks && dayTasks.length > 0 && (
          <>
            <p className="mb-2 px-2 text-[13px] font-medium text-ink-dim">
              {remaining === 0 ? 'All done — nice work!' : `${remaining} remaining`}
            </p>
            <div className="divide-y divide-line rounded-2xl bg-surface">
              {dayTasks.map(({ task, completed }) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  completed={completed}
                  goals={goals}
                  onToggle={() => void toggleCompletion(task.id, date)}
                  onOpen={() => setEditor({ open: true, task })}
                />
              ))}
            </div>
          </>
        )}
        {dayTasks && dayTasks.length === 0 && (
          <EmptyState
            icon="sun"
            title="Nothing scheduled"
            hint="Tap + to add a task for this day."
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
    </div>
  )
}
