import { useState } from 'react'
import { format } from 'date-fns'
import { EmptyState } from '../../components/EmptyState'
import { Sheet } from '../../components/Sheet'
import { toggleCompletion } from '../../db/repo'
import type { Task } from '../../db/models'
import { fromDateStr, type DateStr } from '../../domain/dates'
import { useGoalsMap } from '../../hooks/useGoals'
import { useTasksForDate } from '../../hooks/useTasksForDate'
import { TaskEditorSheet } from '../tasks/TaskEditorSheet'
import { TaskRow } from '../today/TaskRow'

/** Tapping a calendar day opens this: the day's checklist + quick add. */
export function DaySheet({ date, onClose }: { date: DateStr; onClose: () => void }) {
  const dayTasks = useTasksForDate(date)
  const goals = useGoalsMap()
  const [editor, setEditor] = useState<{ open: boolean; task?: Task }>({ open: false })

  return (
    <>
      <Sheet title={format(fromDateStr(date), 'EEEE, MMMM d')} onClose={onClose}>
        {dayTasks && dayTasks.length > 0 ? (
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
        ) : (
          <EmptyState icon="calendar" title="Nothing scheduled" />
        )}
        <button
          type="button"
          onClick={() => setEditor({ open: true })}
          className="mt-4 w-full rounded-2xl bg-accent-soft py-3 text-[15px] font-semibold text-accent"
        >
          + Add task on this day
        </button>
      </Sheet>
      {editor.open && (
        <TaskEditorSheet
          task={editor.task}
          defaultDate={date}
          onClose={() => setEditor({ open: false })}
        />
      )}
    </>
  )
}
