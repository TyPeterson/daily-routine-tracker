import { Icon } from '../../components/Icon'
import type { Goal, Task } from '../../db/models'
import { formatTimeOfDay } from '../../domain/dates'
import { describeRecurrence } from '../../domain/recurrence'

/** One checklist row: tap the circle to toggle done, tap the rest to edit. */
export function TaskRow({
  task,
  completed,
  goals,
  onToggle,
  onOpen,
}: {
  task: Task
  completed: boolean
  goals: Map<string, Goal>
  onToggle: () => void
  onOpen: () => void
}) {
  const linkedGoals = task.goalIds
    .map((id) => goals.get(id))
    .filter((g): g is Goal => g != null)

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        aria-label={completed ? 'Mark not done' : 'Mark done'}
        onClick={onToggle}
        className="flex items-center py-3 pr-3 pl-4"
      >
        <span
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-colors ${
            completed ? 'border-good bg-good text-white' : 'border-ink-dim/50 text-transparent'
          }`}
        >
          <Icon name="check" size={15} strokeWidth={3.5} />
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-4 text-left"
      >
        <span className="min-w-0">
          <span
            className={`block truncate text-[16px] font-medium ${
              completed ? 'text-ink-dim line-through' : ''
            }`}
          >
            {task.title}
          </span>
          <span className="mt-0.5 flex items-center gap-x-2 text-[12px] text-ink-dim">
            {task.timeOfDay && (
              <span className="font-semibold text-accent">{formatTimeOfDay(task.timeOfDay)}</span>
            )}
            <span className="shrink-0">{describeRecurrence(task.recurrence)}</span>
            {task.notes && <span className="truncate">{task.notes}</span>}
          </span>
          {linkedGoals.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {linkedGoals.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
                >
                  {g.title}
                </span>
              ))}
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={17} className="shrink-0 text-ink-dim/60" />
      </button>
    </div>
  )
}
