import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { Group, Row, SectionLabel, Segmented, Toggle } from '../../components/forms'
import { ColorPicker } from '../../components/pickers'
import { db } from '../../db/schema'
import { archiveGoal, createGoal, deleteGoal, unarchiveGoal, updateGoal } from '../../db/repo'
import type { Goal, MetricDirection } from '../../db/models'
import { addDaysStr, todayStr } from '../../domain/dates'
import { useActiveGoals } from '../../hooks/useGoals'

const parseNum = (s: string): number | undefined => {
  const trimmed = s.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  return Number.isNaN(n) ? undefined : n
}

/** All goals that would create a cycle if chosen as this goal's parent. */
function descendantIds(goalId: string, goals: Goal[]): Set<string> {
  const out = new Set([goalId])
  let grew = true
  while (grew) {
    grew = false
    for (const g of goals) {
      if (g.parentGoalId && out.has(g.parentGoalId) && !out.has(g.id)) {
        out.add(g.id)
        grew = true
      }
    }
  }
  return out
}

export function GoalEditorSheet({
  goal,
  defaultParentId,
  onClose,
}: {
  goal?: Goal
  defaultParentId?: string
  onClose: () => void
}) {
  const allGoals = useActiveGoals() ?? []
  const subGoalCount =
    useLiveQuery(
      async () => (goal ? db.goals.where('parentGoalId').equals(goal.id).count() : 0),
      [goal?.id],
    ) ?? 0

  const [title, setTitle] = useState(goal?.title ?? '')
  const [hasTargetDate, setHasTargetDate] = useState(goal?.targetDate != null)
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? addDaysStr(todayStr(), 90))
  const [hasMetric, setHasMetric] = useState(goal?.metric != null)
  const [unit, setUnit] = useState(goal?.metric?.unit ?? '')
  const [direction, setDirection] = useState<MetricDirection>(
    goal?.metric?.direction ?? 'increase',
  )
  const [startValue, setStartValue] = useState(goal?.metric?.startValue?.toString() ?? '')
  const [targetValue, setTargetValue] = useState(goal?.metric?.targetValue?.toString() ?? '')
  const [parentId, setParentId] = useState(goal?.parentGoalId ?? defaultParentId ?? '')
  const [completed, setCompleted] = useState(goal?.completedAt != null)
  const [color, setColor] = useState<string | undefined>(goal?.color)

  const forbiddenParents = goal ? descendantIds(goal.id, allGoals) : new Set<string>()
  // one level of nesting only: sub-goals can't be parents, and a goal that
  // already has sub-goals can't become someone's child
  const parentOptions = allGoals.filter(
    (g) => !forbiddenParents.has(g.id) && !g.parentGoalId,
  )
  const canHaveParent = subGoalCount === 0

  const canSave = title.trim().length > 0 && (!hasMetric || unit.trim().length > 0)

  const save = async () => {
    const payload = {
      title: title.trim(),
      color,
      parentGoalId: parentId || undefined,
      targetDate: hasTargetDate ? targetDate : undefined,
      metric: hasMetric
        ? {
            unit: unit.trim(),
            direction,
            startValue: parseNum(startValue),
            targetValue: parseNum(targetValue),
          }
        : undefined,
      completedAt: completed ? (goal?.completedAt ?? Date.now()) : undefined,
    }
    if (goal) await updateGoal(goal.id, payload)
    else await createGoal({ ...payload, description: '' })
    onClose()
  }

  const toggleArchive = async () => {
    if (!goal) return
    if (goal.archivedAt != null) {
      await unarchiveGoal(goal.id)
    } else {
      const warning =
        subGoalCount > 0
          ? `“${goal.title}” has ${subGoalCount} sub-goal${subGoalCount === 1 ? '' : 's'} that will stay active. Archive it anyway?`
          : `Archive “${goal.title}”? You can find it under Archived on the Goals tab.`
      if (!window.confirm(warning)) return
      await archiveGoal(goal.id)
    }
    onClose()
  }

  const remove = async () => {
    if (!goal) return
    const ok = window.confirm(
      `Delete “${goal.title}”? Its check-ins and checkpoints are deleted too. Sub-goals and linked tasks are kept.`,
    )
    if (!ok) return
    await deleteGoal(goal.id)
    onClose()
  }

  return (
    <Sheet title={goal ? 'edit goal' : 'new goal'} tall onClose={onClose}>
      <div className="space-y-5">
        <Group>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="goal name"
            autoFocus={!goal}
            className="w-full bg-transparent px-4 py-3 text-[16px] font-semibold outline-none placeholder:text-ink-dim/70"
          />
          <ColorPicker value={color} onChange={setColor} />
        </Group>

        <section>
          <SectionLabel index="01">measure</SectionLabel>
          <Group>
            <Row label="track a number">
              <Toggle on={hasMetric} onChange={setHasMetric} />
            </Row>
            {hasMetric && (
              <>
                <Row label="unit">
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="miles, lbs, minutes…"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-44 bg-transparent text-right outline-none placeholder:text-ink-dim/60"
                  />
                </Row>
                <div className="px-4 py-3">
                  <Segmented
                    value={direction}
                    onChange={setDirection}
                    options={[
                      { value: 'increase', label: 'increase ↑' },
                      { value: 'decrease', label: 'decrease ↓' },
                    ]}
                  />
                </div>
                <Row label="starting at">
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={startValue}
                    onChange={(e) => setStartValue(e.target.value)}
                    placeholder="optional"
                    className="w-28 rounded-[7px] border border-edge/50 bg-surface2 px-2 py-1.5 text-right outline-none placeholder:text-ink-dim/60"
                  />
                </Row>
                <Row label="target">
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="optional"
                    className="w-28 rounded-[7px] border border-edge/50 bg-surface2 px-2 py-1.5 text-right outline-none placeholder:text-ink-dim/60"
                  />
                </Row>
              </>
            )}
          </Group>
        </section>

        <section>
          <SectionLabel index="02">details</SectionLabel>
          <Group>
            <Row label="target date">
              <span className="flex items-center gap-3">
                {hasTargetDate && (
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => e.target.value && setTargetDate(e.target.value)}
                    className="text-right font-semibold text-accent outline-none"
                  />
                )}
                <Toggle on={hasTargetDate} onChange={setHasTargetDate} />
              </span>
            </Row>
            {canHaveParent && (
              <Row label="parent goal">
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="max-w-44 bg-transparent text-right font-semibold text-accent outline-none"
                >
                  <option value="">none</option>
                  {parentOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </Row>
            )}
            <Row label="completed">
              <Toggle on={completed} onChange={setCompleted} />
            </Row>
          </Group>
        </section>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="key key-primary w-full py-3.5 text-[15px] font-bold"
          >
            {goal ? 'save changes' : 'add goal'}
          </button>
          {goal && (
            <button
              type="button"
              onClick={() => void toggleArchive()}
              className="key w-full py-3 text-[14px] font-bold text-ink-dim"
            >
              {goal.archivedAt != null ? 'unarchive goal' : 'archive goal'}
            </button>
          )}
          {goal && (
            <button
              type="button"
              onClick={() => void remove()}
              className="w-full py-3 text-[14px] font-bold text-danger"
            >
              delete goal
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
