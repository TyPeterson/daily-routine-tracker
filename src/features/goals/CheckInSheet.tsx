import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { Group, Row, SectionLabel } from '../../components/forms'
import { addCheckIn } from '../../db/repo'
import type { Checkpoint, Goal } from '../../db/models'
import { fromDateStr, todayStr } from '../../domain/dates'

/** Record progress toward a goal: a value, a note, optionally a checkpoint hit. */
export function CheckInSheet({
  goal,
  checkpoints,
  onClose,
}: {
  goal: Goal
  checkpoints: Checkpoint[]
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayStr())
  const [checkpointId, setCheckpointId] = useState('')

  const openCheckpoints = checkpoints.filter((c) => c.achievedAt == null)
  const numValue = value.trim() === '' ? undefined : Number(value)
  const valueInvalid = numValue != null && Number.isNaN(numValue)
  const canSave =
    !valueInvalid && (numValue != null || notes.trim() !== '' || checkpointId !== '')

  const save = async () => {
    // backdated check-ins land at noon so they sort sensibly among same-day entries
    const at = date === todayStr() ? Date.now() : fromDateStr(date).getTime() + 12 * 3600 * 1000
    await addCheckIn({
      goalId: goal.id,
      at,
      value: numValue,
      notes: notes.trim(),
      checkpointId: checkpointId || undefined,
    })
    onClose()
  }

  return (
    <Sheet title="Check In" onClose={onClose}>
      <div className="space-y-5">
        <Group>
          {goal.metric && (
            <Row label={`Value (${goal.metric.unit})`}>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="w-28 rounded-lg bg-surface2 px-2 py-1.5 text-right outline-none"
              />
            </Row>
          )}
          <Row label="Date">
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="text-right font-medium text-accent outline-none"
            />
          </Row>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go?"
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-ink-dim/70"
          />
        </Group>

        {openCheckpoints.length > 0 && (
          <section>
            <SectionLabel>Reached a checkpoint?</SectionLabel>
            <Group>
              {openCheckpoints.map((cp) => {
                const selected = checkpointId === cp.id
                return (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => setCheckpointId(selected ? '' : cp.id)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        name="flag"
                        size={17}
                        className={selected ? 'text-accent' : 'text-ink-dim/50'}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]">{cp.title}</span>
                        {cp.targetValue != null && goal.metric && (
                          <span className="text-[12px] text-ink-dim">
                            {cp.targetValue} {goal.metric.unit}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        selected ? 'bg-accent text-white' : 'bg-surface2 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                  </button>
                )
              })}
            </Group>
          </section>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="w-full rounded-2xl bg-accent py-3.5 text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          Save Check-In
        </button>
      </div>
    </Sheet>
  )
}
