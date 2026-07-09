import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { Group } from '../../components/forms'
import type { Goal, Task } from '../../db/models'
import { useActiveGoals } from '../../hooks/useGoals'
import { CheckInSheet } from './CheckInSheet'

/**
 * "Add a check-in" from a completed task: goes straight to the check-in sheet
 * when the task has one goal, otherwise asks which goal first.
 */
export function TaskCheckInFlow({ task, onClose }: { task: Task; onClose: () => void }) {
  const goals = useActiveGoals() // undefined while the live query loads
  const [pickedId, setPickedId] = useState<string | null>(null)

  const linked =
    goals === undefined
      ? undefined
      : task.goalIds
          .map((id) => goals.find((g) => g.id === id))
          .filter((g): g is Goal => g != null)

  // all linked goals were deleted/archived — nothing to check in for
  useEffect(() => {
    if (linked && linked.length === 0) onClose()
  }, [linked, onClose])

  if (linked === undefined) return null

  // derived, not captured in state: a single linked goal skips the chooser
  const goalId = pickedId ?? (linked.length === 1 ? linked[0]!.id : null)
  if (goalId) return <CheckInSheet goalId={goalId} onClose={onClose} />
  if (linked.length === 0) return null

  return (
    <Sheet title="Check in for which goal?" onClose={onClose}>
      <Group>
        {linked.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setPickedId(g.id)}
            className="flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: g.color ?? 'var(--accent)' }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-medium">{g.title}</span>
              {g.metric && (
                <span className="text-[12px] text-ink-dim">Record {g.metric.unit}</span>
              )}
            </span>
            <Icon name="chevron-right" size={16} className="text-ink-dim/60" />
          </button>
        ))}
      </Group>
    </Sheet>
  )
}
