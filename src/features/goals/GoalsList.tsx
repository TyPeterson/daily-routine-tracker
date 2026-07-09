import { useState } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { Fab } from '../../components/Fab'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { Screen } from '../../components/Screen'
import { SwipeActions } from '../../components/SwipeActions'
import { Group } from '../../components/forms'
import { db } from '../../db/schema'
import { archiveGoal, deleteGoal, unarchiveGoal } from '../../db/repo'
import type { Goal } from '../../db/models'
import { fromDateStr } from '../../domain/dates'
import { goalPercent } from '../../domain/progress'
import { GoalEditorSheet } from './GoalEditorSheet'

export default function GoalsList() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const checkIns = useLiveQuery(() => db.checkIns.toArray(), [])
  const checkpoints = useLiveQuery(() => db.checkpoints.toArray(), [])

  const active = (goals ?? []).filter((g) => !g.archivedAt)
  const archived = (goals ?? [])
    .filter((g) => g.archivedAt != null)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
  const activeIds = new Set(active.map((g) => g.id))
  const topLevel = active
    .filter((g) => !g.parentGoalId || !activeIds.has(g.parentGoalId))
    .sort((a, b) => a.createdAt - b.createdAt)
  const childrenOf = (id: string) =>
    active.filter((g) => g.parentGoalId === id).sort((a, b) => a.createdAt - b.createdAt)

  const percentOf = (g: Goal) =>
    goalPercent(
      g,
      (checkIns ?? []).filter((c) => c.goalId === g.id),
      (checkpoints ?? []).filter((c) => c.goalId === g.id),
    )

  const openGoal = (id: string) => navigate(`/goals/${id}`, { state: { backLabel: 'Goals' } })

  const doArchive = async (goal: Goal) => {
    const subCount = childrenOf(goal.id).length
    const message =
      subCount > 0
        ? `“${goal.title}” has ${subCount} sub-goal${subCount === 1 ? '' : 's'} that will stay active. Archive it anyway?`
        : `Archive “${goal.title}”? You can restore it from the Archived section.`
    if (window.confirm(message)) await archiveGoal(goal.id)
  }

  const doDelete = async (goal: Goal) => {
    const ok = window.confirm(
      `Delete “${goal.title}”? Its check-ins and checkpoints are deleted too. Sub-goals and linked tasks are kept.`,
    )
    if (ok) await deleteGoal(goal.id)
  }

  return (
    <>
      <Screen title="Goals">
        {goals && topLevel.length === 0 && archived.length === 0 && (
          <EmptyState
            icon="target"
            title="No goals yet"
            hint="Tap + to create your first goal, then link daily tasks to it."
          />
        )}
        <div className="space-y-3">
          {topLevel.map((goal) => {
            const percent = percentOf(goal)
            const subGoals = childrenOf(goal.id)
            return (
              <SwipeActions
                key={goal.id}
                open={openSwipeId === goal.id}
                onOpenChange={(open) =>
                  setOpenSwipeId((cur) => (open ? goal.id : cur === goal.id ? null : cur))
                }
                actions={[
                  {
                    icon: 'pencil',
                    label: 'Edit',
                    bg: 'bg-[#3b82f6]',
                    onAct: () => setEditing(goal),
                  },
                  {
                    icon: 'archive',
                    label: 'Archive',
                    bg: 'bg-[#f59e0b]',
                    onAct: () => void doArchive(goal),
                  },
                  {
                    icon: 'trash',
                    label: 'Delete',
                    bg: 'bg-danger',
                    onAct: () => void doDelete(goal),
                  },
                ]}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openGoal(goal.id)}
                  onKeyDown={(e) => e.key === 'Enter' && openGoal(goal.id)}
                  className="rounded-2xl bg-surface p-4 active:opacity-80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold">
                      {goal.color && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: goal.color }}
                        />
                      )}
                      <span className="truncate">{goal.title}</span>
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {goal.completedAt != null && (
                        <span className="rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
                          Done
                        </span>
                      )}
                      {goal.targetDate && goal.completedAt == null && (
                        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-medium text-ink-dim">
                          by {format(fromDateStr(goal.targetDate), 'MMM d, yyyy')}
                        </span>
                      )}
                      <Icon name="chevron-right" size={16} className="text-ink-dim/60" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar percent={percent} color={goal.color} className="flex-1" />
                    <span className="w-10 text-right text-[13px] font-semibold text-ink-dim">
                      {percent != null ? `${Math.round(percent)}%` : '—'}
                    </span>
                  </div>
                  {subGoals.length > 0 && (
                    <div className="mt-3 space-y-2.5 border-t border-line pt-3">
                      {subGoals.map((sub) => {
                        const subPercent = percentOf(sub)
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openGoal(sub.id)
                            }}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <span className="min-w-0 flex-1 truncate text-[14px]">
                              {sub.title}
                            </span>
                            <ProgressBar percent={subPercent} color={sub.color} className="w-20" />
                            <span className="w-9 text-right text-[12px] font-medium text-ink-dim">
                              {subPercent != null ? `${Math.round(subPercent)}%` : '—'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </SwipeActions>
            )
          })}
        </div>

        {archived.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowArchived((s) => !s)}
              className="flex w-full items-center justify-center gap-1 py-1 text-[14px] font-semibold text-ink-dim"
            >
              Archived ({archived.length})
              <Icon
                name="chevron-right"
                size={15}
                className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
              />
            </button>
            {showArchived && (
              <Group className="mt-2">
                {archived.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openGoal(goal.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[15px] font-medium text-ink-dim">
                        {goal.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void unarchiveGoal(goal.id)}
                      className="rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${goal.title}`}
                      onClick={() => void doDelete(goal)}
                      className="p-1.5 text-ink-dim/50"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </Group>
            )}
          </div>
        )}
      </Screen>
      <Fab label="Add goal" onClick={() => setCreating(true)} />
      {creating && <GoalEditorSheet onClose={() => setCreating(false)} />}
      {editing && <GoalEditorSheet goal={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
