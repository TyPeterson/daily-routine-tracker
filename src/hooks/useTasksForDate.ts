import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { Task } from '../db/models'
import type { DateStr } from '../domain/dates'
import { occursOn } from '../domain/recurrence'

export interface DayTask {
  task: Task
  completed: boolean
}

function byTimeThenTitle(a: DayTask, b: DayTask): number {
  const ta = a.task.timeOfDay
  const tb = b.task.timeOfDay
  if (ta && tb && ta !== tb) return ta < tb ? -1 : 1
  if (ta && !tb) return -1
  if (!ta && tb) return 1
  return a.task.title.localeCompare(b.task.title)
}

/** Live list of the tasks occurring on a date, with their done state. */
export function useTasksForDate(date: DateStr): DayTask[] | undefined {
  return useLiveQuery(async () => {
    const [tasks, completions] = await Promise.all([
      db.tasks.toArray(),
      db.completions.where('date').equals(date).toArray(),
    ])
    const done = new Set(completions.map((c) => c.taskId))
    return tasks
      .filter((t) => !t.archivedAt && occursOn(t, date))
      .map((task) => ({ task, completed: done.has(task.id) }))
      .sort(byTimeThenTitle)
  }, [date])
}
