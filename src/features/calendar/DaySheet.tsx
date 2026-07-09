import { useState } from 'react'
import { format } from 'date-fns'
import { EmptyState } from '../../components/EmptyState'
import { Sheet } from '../../components/Sheet'
import { toggleCompletion } from '../../db/repo'
import type { Task } from '../../db/models'
import { fromDateStr, type DateStr } from '../../domain/dates'
import { useGoalsMap } from '../../hooks/useGoals'
import { useTasksForDate } from '../../hooks/useTasksForDate'
import { TaskCheckInFlow } from '../goals/TaskCheckInFlow'
import { TaskEditorSheet } from '../tasks/TaskEditorSheet'
import { TaskRow } from '../today/TaskRow'

/** Tapping a calendar day opens this: the day's checklist + quick add. */
export function DaySheet({ date, onClose }: { date: DateStr; onClose: () => void }) {
  const dayTasks = useTasksForDate(date)
  const goals = useGoalsMap()
  const [editor, setEditor] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [checkInTask, setCheckInTask] = useState<Task | null>(null)

  return (
    <>
      <Sheet title={format(fromDateStr(date), 'EEEE, MMM d').toLowerCase()} onClose={onClose}>
        {dayTasks && dayTasks.length > 0 ? (
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
        ) : (
          <EmptyState icon="calendar" title="nothing scheduled" />
        )}
        <button
          type="button"
          onClick={() => setEditor({ open: true })}
          className="key mt-4 w-full py-3 text-[14px] font-bold text-accent"
        >
          + add task on this day
        </button>
      </Sheet>
      {editor.open && (
        <TaskEditorSheet
          task={editor.task}
          defaultDate={date}
          onClose={() => setEditor({ open: false })}
        />
      )}
      {checkInTask && (
        <TaskCheckInFlow task={checkInTask} date={date} onClose={() => setCheckInTask(null)} />
      )}
    </>
  )
}
