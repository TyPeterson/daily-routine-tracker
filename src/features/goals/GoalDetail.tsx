import { lazy, Suspense, useState } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { Screen } from '../../components/Screen'
import { Group, SectionLabel } from '../../components/forms'
import { db } from '../../db/schema'
import {
  addCheckpoint,
  deleteCheckIn,
  deleteCheckpoint,
  toggleCheckpointAchieved,
} from '../../db/repo'
import type { Task } from '../../db/models'
import { fromDateStr, todayStr } from '../../domain/dates'
import { describeRecurrence } from '../../domain/recurrence'
import { goalPercent, latestValuedCheckIn, weeklyCompletionCounts } from '../../domain/progress'
import { CheckInSheet } from './CheckInSheet'
import { GoalEditorSheet } from './GoalEditorSheet'

// recharts is the heaviest dependency — keep it out of the main chunk
const ProgressChart = lazy(() =>
  import('./ProgressChart').then((m) => ({ default: m.ProgressChart })),
)

const CONSISTENCY_WEEKS = 8

/** Trailing-weeks completion mini bars for one linked task. */
function TaskConsistency({ task, completionDates }: { task: Task; completionDates: string[] }) {
  const buckets = weeklyCompletionCounts(completionDates, CONSISTENCY_WEEKS, todayStr())
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{task.title}</p>
        <p className="text-[12px] text-ink-dim">{describeRecurrence(task.recurrence)}</p>
      </div>
      <div className="flex h-8 shrink-0 items-end gap-[3px]" title="Completions, last 8 weeks">
        {buckets.map((b) => (
          <div
            key={b.weekStart}
            className="w-2 rounded-sm bg-accent"
            style={{
              height: b.count === 0 ? 3 : Math.max(6, (b.count / max) * 32),
              opacity: b.count === 0 ? 0.2 : 0.45 + 0.55 * (b.count / max),
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function GoalDetail() {
  const { goalId = '' } = useParams()
  const navigate = useNavigate()

  // undefined = still loading, null = goal doesn't exist
  const goal = useLiveQuery(async () => (await db.goals.get(goalId)) ?? null, [goalId])
  const checkIns = useLiveQuery(() => db.checkIns.where('goalId').equals(goalId).sortBy('at'), [goalId])
  const checkpoints = useLiveQuery(
    async () =>
      (await db.checkpoints.where('goalId').equals(goalId).toArray()).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    [goalId],
  )
  const subGoals = useLiveQuery(() => db.goals.where('parentGoalId').equals(goalId).toArray(), [goalId])
  const tasks = useLiveQuery(() => db.tasks.where('goalIds').equals(goalId).toArray(), [goalId])
  const parent = useLiveQuery(
    async () => (goal?.parentGoalId ? db.goals.get(goal.parentGoalId) : undefined),
    [goal?.parentGoalId],
  )
  const taskIdsKey = (tasks ?? []).map((t) => t.id).sort().join(',')
  const completions = useLiveQuery(async () => {
    const ids = taskIdsKey ? taskIdsKey.split(',') : []
    if (ids.length === 0) return []
    return db.completions.where('taskId').anyOf(ids).toArray()
  }, [taskIdsKey])

  const subGoalData = useLiveQuery(async () => {
    const subs = await db.goals.where('parentGoalId').equals(goalId).toArray()
    const percents = new Map<string, number | null>()
    for (const sub of subs) {
      const [ci, cp] = await Promise.all([
        db.checkIns.where('goalId').equals(sub.id).toArray(),
        db.checkpoints.where('goalId').equals(sub.id).toArray(),
      ])
      percents.set(sub.id, goalPercent(sub, ci, cp))
    }
    return percents
  }, [goalId])

  const [editorOpen, setEditorOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [subGoalEditorOpen, setSubGoalEditorOpen] = useState(false)
  const [newCpTitle, setNewCpTitle] = useState('')
  const [newCpValue, setNewCpValue] = useState('')

  if (goal === undefined) return null
  if (goal === null) {
    return (
      <Screen title="Goal" onBack={() => navigate('/goals')} backLabel="Goals">
        <EmptyState icon="target" title="Goal not found" />
      </Screen>
    )
  }

  const percent = goalPercent(goal, checkIns ?? [], checkpoints ?? [])
  const latest = latestValuedCheckIn(checkIns ?? [])
  const valuedCheckIns = (checkIns ?? []).filter((c) => c.value != null)
  const checkpointById = new Map((checkpoints ?? []).map((c) => [c.id, c]))
  const unit = goal.metric?.unit ?? ''

  const addCp = async () => {
    const title = newCpTitle.trim()
    if (!title) return
    const value = newCpValue.trim() === '' ? undefined : Number(newCpValue)
    await addCheckpoint(goalId, title, Number.isNaN(value as number) ? undefined : value)
    setNewCpTitle('')
    setNewCpValue('')
  }

  return (
    <>
      <Screen
        title={goal.title}
        onBack={() => navigate(parent ? `/goals/${parent.id}` : '/goals')}
        backLabel={parent ? parent.title : 'Goals'}
        right={
          <button
            type="button"
            aria-label="Edit goal"
            onClick={() => setEditorOpen(true)}
            className="rounded-full bg-surface p-2 text-ink-dim"
          >
            <Icon name="pencil" size={17} />
          </button>
        }
      >
        <div className="space-y-5">
          {(goal.description || goal.targetDate || goal.completedAt != null) && (
            <div className="px-1">
              {goal.description && <p className="text-[14px] text-ink-dim">{goal.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {goal.completedAt != null && (
                  <span className="rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good">
                    Completed {format(goal.completedAt, 'MMM d, yyyy')}
                  </span>
                )}
                {goal.targetDate && (
                  <span className="rounded-full bg-surface2 px-2.5 py-1 text-[12px] font-medium text-ink-dim">
                    Target: {format(fromDateStr(goal.targetDate), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink-dim uppercase">Progress</span>
              {goal.metric && (
                <span className="text-[13px] text-ink-dim">
                  {latest?.value ?? goal.metric.startValue ?? '—'}
                  {goal.metric.targetValue != null && ` / ${goal.metric.targetValue}`} {unit}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <ProgressBar percent={percent} className="flex-1" />
              <span className="text-[15px] font-bold">
                {percent != null ? `${Math.round(percent)}%` : '—'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCheckInOpen(true)}
              className="mt-3.5 w-full rounded-xl bg-accent py-2.5 text-[15px] font-semibold text-white"
            >
              Check In
            </button>
          </div>

          {valuedCheckIns.length > 0 && (
            <section>
              <SectionLabel>Over time</SectionLabel>
              <div className="rounded-2xl bg-surface p-3 pt-4">
                <Suspense fallback={<div className="h-[210px]" />}>
                  <ProgressChart
                    checkIns={valuedCheckIns}
                    metric={goal.metric}
                    checkpoints={checkpoints ?? []}
                  />
                </Suspense>
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Checkpoints</SectionLabel>
            <Group>
              {(checkpoints ?? []).map((cp) => (
                <div key={cp.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    aria-label={cp.achievedAt ? 'Mark not reached' : 'Mark reached'}
                    onClick={() => void toggleCheckpointAchieved(cp.id)}
                    className={cp.achievedAt ? 'text-good' : 'text-ink-dim/40'}
                  >
                    <Icon name="flag" size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[15px] font-medium ${
                        cp.achievedAt ? 'text-ink-dim line-through' : ''
                      }`}
                    >
                      {cp.title}
                    </p>
                    <p className="text-[12px] text-ink-dim">
                      {cp.targetValue != null && `${cp.targetValue} ${unit}`}
                      {cp.targetValue != null && cp.achievedAt != null && ' · '}
                      {cp.achievedAt != null && `reached ${format(cp.achievedAt, 'MMM d')}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete checkpoint"
                    onClick={() => {
                      if (window.confirm(`Delete checkpoint “${cp.title}”?`))
                        void deleteCheckpoint(cp.id)
                    }}
                    className="p-1 text-ink-dim/50"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  value={newCpTitle}
                  onChange={(e) => setNewCpTitle(e.target.value)}
                  placeholder="Add a checkpoint…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-dim/60"
                />
                {goal.metric && (
                  <input
                    value={newCpValue}
                    onChange={(e) => setNewCpValue(e.target.value)}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder={unit}
                    className="w-20 rounded-lg bg-surface2 px-2 py-1 text-right text-[14px] outline-none placeholder:text-ink-dim/60"
                  />
                )}
                <button
                  type="button"
                  disabled={!newCpTitle.trim()}
                  onClick={() => void addCp()}
                  className="text-[15px] font-semibold text-accent disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </Group>
          </section>

          <section>
            <SectionLabel>Sub-goals</SectionLabel>
            <Group>
              {(subGoals ?? []).map((sub) => {
                const subPercent = subGoalData?.get(sub.id) ?? null
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => navigate(`/goals/${sub.id}`)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {sub.title}
                    </span>
                    <ProgressBar percent={subPercent} className="w-20" />
                    <span className="w-9 text-right text-[12px] font-medium text-ink-dim">
                      {subPercent != null ? `${Math.round(subPercent)}%` : '—'}
                    </span>
                    <Icon name="chevron-right" size={15} className="text-ink-dim/60" />
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setSubGoalEditorOpen(true)}
                className="w-full px-4 py-3 text-left text-[15px] font-semibold text-accent"
              >
                + Add sub-goal
              </button>
            </Group>
          </section>

          {(tasks ?? []).filter((t) => !t.archivedAt).length > 0 && (
            <section>
              <SectionLabel>Linked tasks</SectionLabel>
              <Group>
                {(tasks ?? [])
                  .filter((t) => !t.archivedAt)
                  .map((task) => (
                    <TaskConsistency
                      key={task.id}
                      task={task}
                      completionDates={(completions ?? [])
                        .filter((c) => c.taskId === task.id)
                        .map((c) => c.date)}
                    />
                  ))}
              </Group>
              <p className="mt-1.5 px-2 text-[12px] text-ink-dim">
                Bars show completions per week over the last {CONSISTENCY_WEEKS} weeks.
              </p>
            </section>
          )}

          {(checkIns ?? []).length > 0 && (
            <section>
              <SectionLabel>Check-in history</SectionLabel>
              <Group>
                {[...(checkIns ?? [])].reverse().map((ci) => {
                  const cp = ci.checkpointId ? checkpointById.get(ci.checkpointId) : undefined
                  return (
                    <div key={ci.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium">
                          {ci.value != null ? `${ci.value} ${unit}` : ci.notes || 'Check-in'}
                        </p>
                        {ci.value != null && ci.notes && (
                          <p className="mt-0.5 text-[13px] text-ink-dim">{ci.notes}</p>
                        )}
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-dim">
                          {format(ci.at, 'MMM d, yyyy')}
                          {cp && (
                            <span className="flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good">
                              <Icon name="flag" size={10} strokeWidth={2.5} />
                              {cp.title}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete check-in"
                        onClick={() => {
                          if (window.confirm('Delete this check-in?')) void deleteCheckIn(ci.id)
                        }}
                        className="p-1 text-ink-dim/50"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )
                })}
              </Group>
            </section>
          )}
        </div>
      </Screen>

      {editorOpen && <GoalEditorSheet goal={goal} onClose={() => setEditorOpen(false)} />}
      {checkInOpen && (
        <CheckInSheet
          goal={goal}
          checkpoints={checkpoints ?? []}
          onClose={() => setCheckInOpen(false)}
        />
      )}
      {subGoalEditorOpen && (
        <GoalEditorSheet defaultParentId={goalId} onClose={() => setSubGoalEditorOpen(false)} />
      )}
    </>
  )
}
