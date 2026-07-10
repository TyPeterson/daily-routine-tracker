import { lazy, Suspense, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { confirmDialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { Screen } from '../../components/Screen'
import { Group, SectionLabel } from '../../components/forms'
import { db } from '../../db/schema'
import { addCheckpoint, deleteCheckIn, deleteCheckpoint } from '../../db/repo'
import type { Checkpoint, Task } from '../../db/models'
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

export function checkpointLabel(cp: Checkpoint, unit: string): string {
  if (cp.title) return cp.title
  return cp.targetValue != null ? `${cp.targetValue} ${unit}`.trim() : 'Checkpoint'
}

/** Trailing-weeks completion mini bars for one linked task. */
function TaskConsistency({
  task,
  completionDates,
  fallbackColor,
}: {
  task: Task
  completionDates: string[]
  /** the goal's own color, used when the task has none of its own */
  fallbackColor?: string
}) {
  const buckets = weeklyCompletionCounts(completionDates, CONSISTENCY_WEEKS, todayStr())
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          {task.icon && <span className="mr-1">{task.icon}</span>}
          {task.title}
        </p>
        <p className="text-[12px] text-ink-dim">{describeRecurrence(task.recurrence)}</p>
      </div>
      <div className="flex h-8 shrink-0 items-end gap-[3px]" title="Completions, last 8 weeks">
        {buckets.map((b) => (
          <div
            key={b.weekStart}
            className="w-2 rounded-sm"
            style={{
              background: task.color ?? fallbackColor ?? 'var(--accent)',
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
  const location = useLocation()
  const backLabel = (location.state as { backLabel?: string } | null)?.backLabel

  // undefined = still loading, null = goal doesn't exist
  const goal = useLiveQuery(async () => (await db.goals.get(goalId)) ?? null, [goalId])
  const checkIns = useLiveQuery(() => db.checkIns.where('goalId').equals(goalId).sortBy('at'), [goalId])
  const checkpoints = useLiveQuery(
    () => db.checkpoints.where('goalId').equals(goalId).toArray(),
    [goalId],
  )
  const subGoals = useLiveQuery(() => db.goals.where('parentGoalId').equals(goalId).toArray(), [goalId])
  const tasks = useLiveQuery(() => db.tasks.where('goalIds').equals(goalId).toArray(), [goalId])
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
  const [newCpValue, setNewCpValue] = useState('')
  const [cpError, setCpError] = useState<string | null>(null)

  // deleted (or never existed) → land back on the goals list
  useEffect(() => {
    if (goal === null) navigate('/goals', { replace: true })
  }, [goal, navigate])

  if (goal == null) return null

  const percent = goalPercent(goal, checkIns ?? [], checkpoints ?? [])
  const latest = latestValuedCheckIn(checkIns ?? [])
  const valuedCheckIns = (checkIns ?? []).filter((c) => c.value != null)
  const unit = goal.metric?.unit ?? ''
  const direction = goal.metric?.direction ?? 'increase'

  // milestones in the order you'll hit them (descending for weight-loss style)
  const sortedCheckpoints = [...(checkpoints ?? [])].sort((a, b) => {
    if (a.targetValue == null || b.targetValue == null) return a.sortOrder - b.sortOrder
    return direction === 'increase' ? a.targetValue - b.targetValue : b.targetValue - a.targetValue
  })
  const showCheckpoints = goal.metric != null || sortedCheckpoints.length > 0

  const goBack = () => {
    // real history back when possible so back mirrors how you got here
    if (window.history.length > 1 && location.key !== 'default') navigate(-1)
    else navigate('/goals')
  }

  // silkscreen indexes follow whichever sections actually render
  let sectionCounter = 0
  const nextIndex = () => String(++sectionCounter).padStart(2, '0')

  const addCp = async () => {
    const value = Number(newCpValue)
    if (newCpValue.trim() === '' || Number.isNaN(value)) return
    const metric = goal?.metric
    const target = metric?.targetValue
    const start = metric?.startValue
    const dir = metric?.direction ?? 'increase'
    let error: string | null = null
    if ((checkpoints ?? []).some((c) => c.targetValue === value)) {
      error = 'that milestone already exists'
    } else if (target != null && (dir === 'increase' ? value > target : value < target)) {
      error = `beyond the target (${target} ${unit})`
    } else if (start != null && (dir === 'increase' ? value <= start : value >= start)) {
      error = `behind the starting value (${start} ${unit})`
    }
    if (error) {
      setCpError(error)
      return
    }
    setCpError(null)
    await addCheckpoint(goalId, value)
    setNewCpValue('')
  }

  const cpValue = Number(newCpValue)
  const canAddCp = newCpValue.trim() !== '' && !Number.isNaN(cpValue)

  return (
    <>
      <Screen
        title={goal.title}
        onBack={goBack}
        backLabel={backLabel ?? 'back'}
        right={
          <button
            type="button"
            aria-label="Edit goal"
            onClick={() => setEditorOpen(true)}
            className="key flex h-9 w-9 items-center justify-center text-ink"
          >
            <Icon name="pencil" size={15} />
          </button>
        }
      >
        <div className="space-y-5">
          {(goal.description ||
            goal.targetDate ||
            goal.completedAt != null ||
            goal.archivedAt != null) && (
            <div className="px-1">
              {goal.description && <p className="text-[14px] text-ink-dim">{goal.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {goal.archivedAt != null && (
                  <span className="rounded-[5px] bg-surface2 px-2 py-1 text-[11px] font-bold text-ink-dim">
                    archived
                  </span>
                )}
                {goal.completedAt != null && (
                  <span className="flex items-center gap-1.5 rounded-[5px] bg-good-soft px-2 py-1 text-[11px] font-bold text-good">
                    <span className="led led-good" />
                    completed {format(goal.completedAt, 'MMM d yyyy').toLowerCase()}
                  </span>
                )}
                {goal.targetDate && (
                  <span className="rounded-[5px] bg-surface2 px-2 py-1 text-[11px] font-bold text-ink-dim">
                    target: {format(fromDateStr(goal.targetDate), 'MMM d yyyy').toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="module p-4">
            {goal.metric != null && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">
                    progress
                  </span>
                  <span className="text-[12px] font-semibold text-ink-dim">
                    {latest?.value ?? goal.metric.startValue ?? '—'}
                    {goal.metric.targetValue != null && ` / ${goal.metric.targetValue}`} {unit}
                  </span>
                </div>
                <div className="mt-2.5 mb-3.5 flex items-center gap-3">
                  <ProgressBar percent={percent} color={goal.color} className="flex-1" />
                  <span className="text-[15px] font-bold">
                    {percent != null ? `${Math.round(percent)}%` : '—'}
                  </span>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setCheckInOpen(true)}
              className="key key-primary w-full py-2.5 text-[14px] font-bold"
            >
              check in
            </button>
          </div>

          {valuedCheckIns.length > 0 && (
            <section>
              <SectionLabel index={nextIndex()}>over time</SectionLabel>
              <div className="module p-3 pt-4">
                <Suspense fallback={<div className="h-[210px]" />}>
                  <ProgressChart
                    checkIns={valuedCheckIns}
                    metric={goal.metric}
                    checkpoints={checkpoints ?? []}
                    color={goal.color}
                  />
                </Suspense>
              </div>
            </section>
          )}

          {showCheckpoints && (
            <section>
              <SectionLabel index={nextIndex()}>milestones</SectionLabel>
              <Group>
                {sortedCheckpoints.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon
                      name="flag"
                      size={20}
                      className={cp.achievedAt != null ? 'text-good' : 'text-ink-dim/40'}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[15px] font-medium ${
                          cp.achievedAt != null ? 'text-ink-dim line-through' : ''
                        }`}
                      >
                        {checkpointLabel(cp, unit)}
                      </p>
                      {cp.achievedAt != null && (
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-good">
                          <span className="led led-good" />
                          reached {format(cp.achievedAt, 'MMM d yyyy').toLowerCase()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Delete milestone"
                      onClick={() =>
                        void confirmDialog({
                          title: `delete milestone “${checkpointLabel(cp, unit)}”?`,
                          confirmLabel: 'delete',
                          danger: true,
                        }).then((ok) => {
                          if (ok) void deleteCheckpoint(cp.id)
                        })
                      }
                      className="p-1 text-ink-dim/50"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                {goal.metric && (
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <input
                      value={newCpValue}
                      onChange={(e) => {
                        setNewCpValue(e.target.value)
                        setCpError(null)
                      }}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="milestone value"
                      className={`min-w-0 flex-1 rounded-[7px] border bg-transparent px-2 py-1 text-[14px] outline-none placeholder:text-ink-dim/60 ${
                        cpError ? 'border-danger ring-1 ring-danger/60' : 'border-transparent'
                      }`}
                    />
                    <span className="shrink-0 text-[13px] text-ink-dim/70">{unit}</span>
                    <button
                      type="button"
                      aria-label="Add milestone"
                      disabled={!canAddCp}
                      onClick={() => void addCp()}
                      className="key key-primary flex h-8 w-8 items-center justify-center !rounded-full"
                    >
                      <Icon name="plus" size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </Group>
              {cpError && (
                <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-danger">
                  <span className="led led-danger shrink-0" />
                  {cpError}
                </p>
              )}
              {goal.metric && !cpError && (
                <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
                  milestones are reached — and un-reached — automatically as check-ins cross them
                </p>
              )}
            </section>
          )}

          {goal.parentGoalId == null && (
          <section>
            <SectionLabel index={nextIndex()}>sub-goals</SectionLabel>
            <Group>
              {(subGoals ?? []).map((sub) => {
                const subPercent = subGoalData?.get(sub.id) ?? null
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() =>
                      navigate(`/goals/${sub.id}`, { state: { backLabel: goal.title } })
                    }
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    {sub.color && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border border-edge/60"
                        style={{ background: sub.color }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {sub.title}
                    </span>
                    <ProgressBar percent={subPercent} color={sub.color} className="w-20" />
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
                className="w-full px-4 py-3 text-left text-[14px] font-bold text-accent"
              >
                + add sub-goal
              </button>
            </Group>
          </section>
          )}

          {(tasks ?? []).filter((t) => !t.archivedAt).length > 0 && (
            <section>
              <SectionLabel index={nextIndex()}>linked tasks</SectionLabel>
              <Group>
                {(tasks ?? [])
                  .filter((t) => !t.archivedAt)
                  .map((task) => (
                    <TaskConsistency
                      key={task.id}
                      task={task}
                      fallbackColor={goal.color}
                      completionDates={(completions ?? [])
                        .filter((c) => c.taskId === task.id)
                        .map((c) => c.date)}
                    />
                  ))}
              </Group>
              <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
                bars show completions per week over the last {CONSISTENCY_WEEKS} weeks
              </p>
            </section>
          )}

          {(checkIns ?? []).length > 0 && (
            <section>
              <SectionLabel index={nextIndex()}>check-in history</SectionLabel>
              <Group>
                {[...(checkIns ?? [])].reverse().map((ci) => {
                  const hitCheckpoints = (checkpoints ?? []).filter(
                    (cp) => cp.achievedAt === ci.at,
                  )
                  return (
                    <div key={ci.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold">
                          {ci.value != null ? `${ci.value} ${unit}` : ci.notes || 'check-in'}
                        </p>
                        {ci.value != null && ci.notes && (
                          <p className="mt-0.5 text-[13px] text-ink-dim">{ci.notes}</p>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-dim">
                          {format(ci.at, 'MMM d, yyyy')}
                          {hitCheckpoints.map((cp) => (
                            <span
                              key={cp.id}
                              className="flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good"
                            >
                              <Icon name="flag" size={10} strokeWidth={2.5} />
                              {checkpointLabel(cp, unit)}
                            </span>
                          ))}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete check-in"
                        onClick={() =>
                          void confirmDialog({
                            title: 'delete this check-in?',
                            message: 'milestone flags recompute from the remaining history.',
                            confirmLabel: 'delete',
                            danger: true,
                          }).then((ok) => {
                            if (ok) void deleteCheckIn(ci.id)
                          })
                        }
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
      {checkInOpen && <CheckInSheet goalId={goal.id} onClose={() => setCheckInOpen(false)} />}
      {subGoalEditorOpen && (
        <GoalEditorSheet defaultParentId={goalId} onClose={() => setSubGoalEditorOpen(false)} />
      )}
    </>
  )
}
