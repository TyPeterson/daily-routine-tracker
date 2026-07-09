import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { Group, Row, SectionLabel, Segmented, Toggle } from '../../components/forms'
import { ColorPicker } from '../../components/pickers'
import { db } from '../../db/schema'
import { createGoal, unarchiveGoal, updateGoal } from '../../db/repo'
import type { Goal, MetricDirection } from '../../db/models'
import { addDaysStr, todayStr } from '../../domain/dates'
import { useActiveGoals } from '../../hooks/useGoals'
import { requestArchiveGoal, requestDeleteGoal } from './goalActions'

const parseNum = (s: string): number | undefined => {
  const trimmed = s.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  return Number.isNaN(n) ? undefined : n
}

function ErrorHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-danger">
      <span className="led led-danger shrink-0" />
      {children}
    </p>
  )
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
  const [color, setColor] = useState<string | undefined>(goal?.color)
  // tracking is the default for new goals; editing derives from the metric
  const [trackProgress, setTrackProgress] = useState(goal ? goal.metric != null : true)
  const [unit, setUnit] = useState(goal?.metric?.unit ?? '')
  const [direction, setDirection] = useState<MetricDirection>(
    goal?.metric?.direction ?? 'increase',
  )
  const [startValue, setStartValue] = useState(goal?.metric?.startValue?.toString() ?? '')
  const [targetValue, setTargetValue] = useState(goal?.metric?.targetValue?.toString() ?? '')
  const [hasTargetDate, setHasTargetDate] = useState(goal?.targetDate != null)
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? addDaysStr(todayStr(), 90))
  const [parentId, setParentId] = useState(goal?.parentGoalId ?? defaultParentId ?? '')
  const [completed, setCompleted] = useState(goal?.completedAt != null)

  // gentle validation: cues appear only after a field was visited (or a save
  // was attempted), and never while the cursor is still in the field
  const [attempted, setAttempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const fieldProps = (name: string) => ({
    onFocus: () => setEditing(name),
    onBlur: () => {
      setEditing(null)
      setTouched((t) => ({ ...t, [name]: true }))
    },
  })

  // one level of nesting only
  const parentOptions = allGoals.filter((g) => !g.parentGoalId && g.id !== goal?.id)
  const canHaveParent = subGoalCount === 0

  const startNum = parseNum(startValue)
  const targetNum = parseNum(targetValue)

  const titleMissing = title.trim() === ''
  const unitMissing = trackProgress && unit.trim() === ''
  const targetMissing = trackProgress && targetNum == null
  const directionConflict =
    trackProgress &&
    startNum != null &&
    targetNum != null &&
    (direction === 'increase' ? targetNum <= startNum : targetNum >= startNum)

  const canSave = !titleMissing && !unitMissing && !targetMissing && !directionConflict

  const showError = (name: string, invalid: boolean) =>
    invalid && editing !== name && (attempted || touched[name])
  const showTitleError = showError('title', titleMissing)
  const showUnitError = showError('unit', unitMissing)
  const showTargetError = showError('target', targetMissing)
  // consistency error shows once both numbers are entered and left alone
  const showDirectionError =
    directionConflict && editing !== 'start' && editing !== 'target'

  const measureError = showUnitError
    ? 'enter a unit — miles, lbs, chapters…'
    : showTargetError
      ? 'enter a target number to track'
      : showDirectionError
        ? direction === 'increase'
          ? 'target must be greater than the starting value for an increasing goal'
          : 'target must be less than the starting value for a decreasing goal'
        : null

  const inputCls = (bad: boolean) =>
    `w-28 rounded-[7px] border bg-surface2 px-2 py-1.5 text-right font-semibold outline-none placeholder:text-ink-dim/60 ${
      bad ? 'border-danger ring-1 ring-danger/60' : 'border-edge/50'
    }`

  const save = async () => {
    const payload = {
      title: title.trim(),
      color,
      parentGoalId: parentId || undefined,
      targetDate: trackProgress && hasTargetDate ? targetDate : undefined,
      metric: trackProgress
        ? {
            unit: unit.trim(),
            direction,
            startValue: startNum,
            targetValue: targetNum,
          }
        : undefined,
      completedAt:
        goal?.completedAt != null ? (completed ? goal.completedAt : undefined) : undefined,
    }
    if (goal) await updateGoal(goal.id, payload)
    else await createGoal({ ...payload, description: '' })
    onClose()
  }

  const onSaveTap = () => {
    if (!canSave) {
      setAttempted(true)
      return
    }
    void save()
  }

  const toggleArchive = async () => {
    if (!goal) return
    if (goal.archivedAt != null) {
      await unarchiveGoal(goal.id)
      onClose()
      return
    }
    if (await requestArchiveGoal(goal, subGoalCount)) onClose()
  }

  const remove = async () => {
    if (!goal) return
    if (await requestDeleteGoal(goal, subGoalCount)) onClose()
  }

  return (
    <Sheet title={goal ? 'edit goal' : 'new goal'} tall onClose={onClose}>
      <div className="space-y-5">
        <div>
          <Group>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="goal name"
              autoFocus={!goal}
              {...fieldProps('title')}
              className={`w-full bg-transparent px-4 py-3 text-[16px] font-semibold outline-none placeholder:text-ink-dim/70 ${
                showTitleError ? 'rounded-t-[9px] ring-1 ring-danger/60 ring-inset' : ''
              }`}
            />
            <ColorPicker value={color} onChange={setColor} />
          </Group>
          {showTitleError && <ErrorHint>name the goal</ErrorHint>}
        </div>

        <section>
          <SectionLabel index="01">progress</SectionLabel>
          <Group>
            <Row label="track progress">
              <Toggle on={trackProgress} onChange={setTrackProgress} />
            </Row>
          </Group>
          {trackProgress && (
            <>
              <Group className="mt-3">
                <Row label="unit">
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="miles, lbs, minutes…"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    {...fieldProps('unit')}
                    className={`w-44 rounded-[7px] border bg-transparent px-2 py-1 text-right outline-none placeholder:text-ink-dim/60 ${
                      showUnitError ? 'border-danger ring-1 ring-danger/60' : 'border-transparent'
                    }`}
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
                    {...fieldProps('start')}
                    className={inputCls(showDirectionError)}
                  />
                </Row>
                <Row label="target">
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="required"
                    {...fieldProps('target')}
                    className={inputCls(showTargetError || showDirectionError)}
                  />
                </Row>
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
              </Group>
              {measureError && <ErrorHint>{measureError}</ErrorHint>}
            </>
          )}
        </section>

        {(canHaveParent || (goal && goal.completedAt != null)) && (
          <section>
            <SectionLabel index="02">details</SectionLabel>
            <Group>
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
              {goal && goal.completedAt != null && (
                <Row label="completed">
                  <Toggle on={completed} onChange={setCompleted} />
                </Row>
              )}
            </Group>
          </section>
        )}

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onSaveTap}
            className={`key key-primary w-full py-3.5 text-[15px] font-bold ${
              canSave ? '' : 'opacity-40'
            }`}
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
