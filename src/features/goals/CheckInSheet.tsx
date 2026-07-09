import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { confirmDialog } from '../../components/Dialog'
import { Sheet } from '../../components/Sheet'
import { Group, Row, Segmented } from '../../components/forms'
import { db } from '../../db/schema'
import { addCheckIn, updateGoal } from '../../db/repo'
import { fromDateStr, todayStr, type DateStr } from '../../domain/dates'
import { goalTargetReached, latestValuedCheckIn } from '../../domain/progress'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Record progress toward a goal — either an absolute value or a ± adjustment
 * of the latest one. Milestones the value crosses are handled automatically;
 * hitting the final target offers to complete the goal.
 */
export function CheckInSheet({
  goalId,
  fixedDate,
  onClose,
}: {
  goalId: string
  /** when checking in from a task, the occurrence date — hides the date row */
  fixedDate?: DateStr
  onClose: () => void
}) {
  const goal = useLiveQuery(() => db.goals.get(goalId), [goalId])
  const checkIns = useLiveQuery(() => db.checkIns.where('goalId').equals(goalId).sortBy('at'), [goalId])

  const [mode, setMode] = useState<'set' | 'adjust'>('set')
  const [value, setValue] = useState('')
  const [delta, setDelta] = useState('')
  const [sign, setSign] = useState<'+' | '-'>('+')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(fixedDate ?? todayStr())

  if (!goal) return null

  const latest = latestValuedCheckIn(checkIns ?? [])
  const base = latest?.value ?? goal.metric?.startValue ?? 0

  const parsedValue = value.trim() === '' ? undefined : Number(value)
  const parsedDelta = delta.trim() === '' ? undefined : Number(delta)
  const adjusted =
    parsedDelta != null && !Number.isNaN(parsedDelta)
      ? round2(base + (sign === '+' ? parsedDelta : -parsedDelta))
      : undefined

  const numValue = mode === 'set' ? parsedValue : adjusted
  const valueInvalid =
    (mode === 'set' && parsedValue != null && Number.isNaN(parsedValue)) ||
    (mode === 'adjust' && parsedDelta != null && Number.isNaN(parsedDelta))
  const canSave = !valueInvalid && (numValue != null || (mode === 'set' && notes.trim() !== ''))

  const save = async () => {
    // backdated check-ins land at noon so they sort sensibly among same-day entries
    const at = date === todayStr() ? Date.now() : fromDateStr(date).getTime() + 12 * 3600 * 1000
    await addCheckIn({
      goalId: goal.id,
      at,
      value: numValue,
      notes: notes.trim(),
    })
    if (
      numValue != null &&
      goal.metric &&
      goal.completedAt == null &&
      goalTargetReached(goal.metric, numValue)
    ) {
      const ok = await confirmDialog({
        title: 'target reached!',
        message: `you hit ${goal.metric.targetValue} ${goal.metric.unit}. mark “${goal.title}” as completed?`,
        confirmLabel: 'mark completed',
      })
      if (ok) await updateGoal(goal.id, { completedAt: Date.now() })
    }
    onClose()
  }

  const unit = goal.metric?.unit ?? ''

  return (
    <Sheet title={`check in — ${goal.title}`} tall onClose={onClose}>
      <div className="space-y-5">
        {goal.metric && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'set', label: 'set value' },
              { value: 'adjust', label: '± adjust' },
            ]}
          />
        )}
        <Group>
          {goal.metric && mode === 'set' && (
            <Row label={`value (${unit})`}>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="w-28 rounded-[7px] border border-edge/50 bg-surface2 px-2 py-1.5 text-right font-semibold outline-none"
              />
            </Row>
          )}
          {goal.metric && mode === 'adjust' && (
            <>
              <Row label={`current: ${base} ${unit}`}>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={sign === '+' ? 'Switch to decrease' : 'Switch to increase'}
                    onClick={() => setSign((s) => (s === '+' ? '-' : '+'))}
                    className="key flex h-9 w-9 items-center justify-center text-[17px] font-bold text-accent"
                  >
                    {sign}
                  </button>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    autoFocus
                    className="w-24 rounded-[7px] border border-edge/50 bg-surface2 px-2 py-1.5 text-right font-semibold outline-none"
                  />
                </span>
              </Row>
              <Row label="new value">
                <span className="text-[15px] font-bold text-accent">
                  {adjusted != null ? `${adjusted} ${unit}` : '—'}
                </span>
              </Row>
            </>
          )}
          {!fixedDate && (
            <Row label="date">
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="text-right font-semibold text-accent outline-none"
              />
            </Row>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="notes"
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-[14px] outline-none placeholder:text-ink-dim/70"
          />
        </Group>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="key key-primary w-full py-3.5 text-[15px] font-bold"
        >
          save check-in
        </button>
      </div>
    </Sheet>
  )
}
