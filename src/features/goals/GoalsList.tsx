import { useState } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { Fab } from '../../components/Fab'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { Screen } from '../../components/Screen'
import { db } from '../../db/schema'
import type { Goal } from '../../db/models'
import { fromDateStr } from '../../domain/dates'
import { goalPercent } from '../../domain/progress'
import { GoalEditorSheet } from './GoalEditorSheet'

export default function GoalsList() {
  const navigate = useNavigate()
  const [editorOpen, setEditorOpen] = useState(false)

  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const checkIns = useLiveQuery(() => db.checkIns.toArray(), [])
  const checkpoints = useLiveQuery(() => db.checkpoints.toArray(), [])

  const active = (goals ?? []).filter((g) => !g.archivedAt)
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

  return (
    <>
      <Screen title="Goals">
        {goals && topLevel.length === 0 && (
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
              <div
                key={goal.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/goals/${goal.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/goals/${goal.id}`)}
                className="rounded-2xl bg-surface p-4 active:opacity-80"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="min-w-0 truncate text-[17px] font-semibold">{goal.title}</h3>
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
                {goal.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-dim">{goal.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar percent={percent} className="flex-1" />
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
                            navigate(`/goals/${sub.id}`)
                          }}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-[14px]">{sub.title}</span>
                          <ProgressBar percent={subPercent} className="w-20" />
                          <span className="w-9 text-right text-[12px] font-medium text-ink-dim">
                            {subPercent != null ? `${Math.round(subPercent)}%` : '—'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Screen>
      <Fab label="Add goal" onClick={() => setEditorOpen(true)} />
      {editorOpen && <GoalEditorSheet onClose={() => setEditorOpen(false)} />}
    </>
  )
}
