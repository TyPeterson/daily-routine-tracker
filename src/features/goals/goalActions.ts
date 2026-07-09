import { choiceDialog, confirmDialog } from '../../components/Dialog'
import { archiveGoal, deleteGoal } from '../../db/repo'
import type { Goal } from '../../db/models'

/**
 * Archive with a themed prompt; parents ask whether sub-goals come along.
 * Resolves true when something was archived.
 */
export async function requestArchiveGoal(goal: Goal, subGoalCount: number): Promise<boolean> {
  if (subGoalCount > 0) {
    const plural = subGoalCount === 1 ? 'sub-goal' : 'sub-goals'
    const choice = await choiceDialog({
      title: `archive “${goal.title}”?`,
      message: `it has ${subGoalCount} ${plural}. archived goals can be restored from the goals tab.`,
      choices: [
        { id: 'solo', label: 'archive only this goal', detail: `${plural} stay active` },
        { id: 'cascade', label: `archive goal + ${plural}` },
      ],
    })
    if (!choice) return false
    await archiveGoal(goal.id, { includeSubGoals: choice === 'cascade' })
    return true
  }
  const ok = await confirmDialog({
    title: `archive “${goal.title}”?`,
    message: 'you can restore it from the archived section on the goals tab.',
    confirmLabel: 'archive',
  })
  if (ok) await archiveGoal(goal.id)
  return ok
}

/**
 * Delete with a themed prompt; parents ask whether sub-goals go too.
 * Check-ins and milestones are deleted with their goal; tasks are unlinked.
 * Resolves true when something was deleted.
 */
export async function requestDeleteGoal(goal: Goal, subGoalCount: number): Promise<boolean> {
  if (subGoalCount > 0) {
    const plural = subGoalCount === 1 ? 'sub-goal' : 'sub-goals'
    const choice = await choiceDialog({
      title: `delete “${goal.title}”?`,
      message: `its check-ins and milestones are deleted too. linked tasks are kept. it has ${subGoalCount} ${plural}.`,
      choices: [
        { id: 'solo', label: 'delete goal, keep sub-goals', kind: 'danger' },
        { id: 'cascade', label: `delete goal + ${plural}`, kind: 'danger' },
      ],
    })
    if (!choice) return false
    await deleteGoal(goal.id, { includeSubGoals: choice === 'cascade' })
    return true
  }
  const ok = await confirmDialog({
    title: `delete “${goal.title}”?`,
    message: 'its check-ins and milestones are deleted too. linked tasks are kept.',
    confirmLabel: 'delete',
    danger: true,
  })
  if (ok) await deleteGoal(goal.id)
  return ok
}
