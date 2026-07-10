import type { Goal, Task } from '../db/models'

/**
 * The color a task should display with. An explicit task color always wins;
 * otherwise the task inherits the linked goals' color when it's unambiguous
 * (one linked colored goal, or several all sharing the same color). Multiple
 * distinct goal colors → no color.
 */
export function effectiveTaskColor(
  task: Pick<Task, 'color' | 'goalIds'>,
  goals: Map<string, Goal>,
): string | undefined {
  if (task.color) return task.color
  const colors = new Set(
    task.goalIds
      .map((id) => goals.get(id)?.color)
      .filter((c): c is string => c != null),
  )
  return colors.size === 1 ? [...colors][0] : undefined
}
