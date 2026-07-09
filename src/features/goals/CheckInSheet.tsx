import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { Group, Row } from '../../components/forms'
import { db } from '../../db/schema'
import { addCheckIn, updateGoal } from '../../db/repo'
import { fromDateStr, todayStr } from '../../domain/dates'
import { goalTargetReached } from '../../domain/progress'

/**
 * Record progress toward a goal. Checkpoints the value crosses are marked
 * reached automatically; hitting the final target offers to complete the goal.
 */
export function CheckInSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const goal = useLiveQuery(() => db.goals.get(goalId), [goalId])

  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayStr())

  if (!goal) return null

  const numValue = value.trim() === '' ? undefined : Number(value)
  const valueInvalid = numValue != null && Number.isNaN(numValue)
  const canSave = !valueInvalid && (numValue != null || notes.trim() !== '')

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
      const ok = window.confirm(
        `You reached your target of ${goal.metric.targetValue} ${goal.metric.unit}! Mark “${goal.title}” as completed?`,
      )
      if (ok) await updateGoal(goal.id, { completedAt: Date.now() })
    }
    onClose()
  }

  return (
    <Sheet title={`check in — ${goal.title}`} onClose={onClose}>
      <div className="space-y-5">
        <Group>
          {goal.metric && (
            <Row label={`value (${goal.metric.unit})`}>
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
          <Row label="date">
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="text-right font-semibold text-accent outline-none"
            />
          </Row>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="how did it go?"
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
