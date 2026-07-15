import { choiceDialog, confirmDialog } from '../../components/Dialog'
import { db } from '../../db/schema'
import { deleteOccurrence, deleteTask, endSeriesBefore } from '../../db/repo'
import type { Task } from '../../db/models'
import type { DateStr } from '../../domain/dates'

/**
 * Delete with a themed prompt, mirroring the editor's delete flow: one-offs
 * confirm, series ask for scope against the day the row was swiped on.
 * Resolves true when something was deleted.
 */
export async function requestDeleteTask(task: Task, date: DateStr): Promise<boolean> {
  if (task.recurrence.type === 'none') {
    const ok = await confirmDialog({
      title: `delete “${task.title}”?`,
      confirmLabel: 'delete',
      danger: true,
    })
    if (ok) await deleteTask(task.id)
    return ok
  }
  const completionCount = await db.completions.where('taskId').equals(task.id).count()
  const choice = await choiceDialog({
    title: `delete “${task.title}”…`,
    choices: [
      { id: 'one', label: 'only this day' },
      {
        id: 'future',
        label: 'this and future events',
        detail: 'past days and completion history are kept',
      },
      {
        id: 'all',
        label: completionCount > 0 ? 'entire series + history' : 'entire series',
        kind: 'danger',
      },
    ],
  })
  if (choice === 'one') await deleteOccurrence(task.id, date)
  else if (choice === 'future') await endSeriesBefore(task.id, date)
  else if (choice === 'all') await deleteTask(task.id)
  return choice != null
}
