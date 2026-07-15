import { useState } from 'react'
import { celebrate } from '../../components/Celebrate'
import { Icon } from '../../components/Icon'
import type { Goal, Task } from '../../db/models'
import { formatTimeOfDay } from '../../domain/dates'
import { describeRecurrence } from '../../domain/recurrence'
import { effectiveTaskColor } from '../../domain/taskColor'

const tint = (hex: string) => `${hex}26` // ~15% alpha for #rrggbb

/** One checklist row: tap the key to toggle done, tap the rest to edit. */
export function TaskRow({
  task,
  completed,
  goals,
  onToggle,
  onOpen,
  onCheckIn,
}: {
  task: Task
  completed: boolean
  goals: Map<string, Goal>
  onToggle: () => void
  onOpen: () => void
  /** shown on completed rows with linked goals */
  onCheckIn?: () => void
}) {
  const linkedGoals = task.goalIds
    .map((id) => goals.get(id))
    .filter((g): g is Goal => g != null)

  // pop only on a fresh completion, not for rows that mount already done
  const [justCompleted, setJustCompleted] = useState(false)
  const handleToggle = () => {
    if (!completed) {
      setJustCompleted(true)
      window.setTimeout(() => setJustCompleted(false), 350)
      celebrate()
    }
    onToggle()
  }

  return (
    <div className="flex items-stretch bg-surface">
      <button
        type="button"
        aria-label={completed ? 'Mark not done' : 'Mark done'}
        onClick={handleToggle}
        className="flex items-center py-3 pr-3 pl-4"
      >
        <span
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-colors ${
            completed ? 'border-edge bg-accent text-on-accent' : 'text-transparent'
          } ${justCompleted && completed ? 'animate-check-pop' : ''}`}
          style={
            !completed
              ? { borderColor: effectiveTaskColor(task, goals) ?? 'var(--ink-dim)' }
              : undefined
          }
        >
          <Icon name="check" size={14} strokeWidth={3.5} />
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-3 text-left transition-colors duration-150 active:bg-surface2/60"
      >
        <span className="min-w-0">
          <span
            className={`block truncate text-[15px] font-semibold transition-colors duration-300 ${
              completed ? 'text-ink-dim line-through' : ''
            }`}
          >
            {task.icon && <span className="mr-1.5">{task.icon}</span>}
            {task.title}
          </span>
          <span className="mt-0.5 flex items-center gap-x-2 text-[11px] text-ink-dim">
            {task.timeOfDay && (
              <span className="font-bold text-accent">{formatTimeOfDay(task.timeOfDay)}</span>
            )}
            <span className="shrink-0">{describeRecurrence(task.recurrence)}</span>
            {task.notes && <span className="truncate">{task.notes}</span>}
          </span>
          {linkedGoals.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {linkedGoals.map((g) => (
                <span
                  key={g.id}
                  className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold"
                  style={
                    g.color
                      ? { background: tint(g.color), color: g.color }
                      : { background: 'var(--accent-soft)', color: 'var(--accent)' }
                  }
                >
                  {g.title}
                </span>
              ))}
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={15} className="shrink-0 text-ink-dim/60" />
      </button>
      {completed && linkedGoals.length > 0 && onCheckIn && (
        <button
          type="button"
          aria-label="Add a check-in"
          onClick={onCheckIn}
          className="key mr-3 flex h-9 w-9 items-center justify-center self-center !rounded-full text-accent"
        >
          <Icon name="flag" size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
