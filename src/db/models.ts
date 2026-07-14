import type { DateStr } from '../domain/dates'
import type { Recurrence } from '../domain/recurrence'

/** A (possibly repeating) to-do that shows up on calendar days. */
export interface Task {
  id: string
  title: string
  notes: string
  recurrence: Recurrence
  /** first occurrence / recurrence anchor */
  startDate: DateStr
  /** optional last day the task repeats */
  endDate?: DateStr
  /** occurrence dates removed or split out of the series */
  skipDates?: DateStr[]
  /** occurrence dates added outside the recurrence rule */
  extraDates?: DateStr[]
  /** optional 'HH:mm' used for ordering and display */
  timeOfDay?: string
  /** goals this task contributes to (many-to-many) */
  goalIds: string[]
  /** display color (hex) used on calendar chips and rows */
  color?: string
  /** single emoji shown next to the title */
  icon?: string
  createdAt: number
  archivedAt?: number
}

/** One checked-off occurrence of a task on a specific local date. */
export interface Completion {
  id: string
  taskId: string
  date: DateStr
  completedAt: number
}

export type MetricDirection = 'increase' | 'decrease'

/** Optional numeric measure of a goal (miles run, body weight, ...). */
export interface GoalMetric {
  unit: string
  /** baseline; falls back to the first check-in's value */
  startValue?: number
  targetValue?: number
  /** which way progress points, e.g. weight loss = 'decrease' */
  direction: MetricDirection
}

export interface Goal {
  id: string
  title: string
  description: string
  /** set when this goal is a sub-goal of another */
  parentGoalId?: string
  targetDate?: DateStr
  metric?: GoalMetric
  /** display color (hex) used on progress bars and chips */
  color?: string
  createdAt: number
  completedAt?: number
  archivedAt?: number
}

/**
 * Milestone value on the way to a metric goal (½ mi → 1 mi → 5 mi).
 * Achievement is derived: any check-in value crossing targetValue marks it
 * reached (repo.recomputeCheckpointAchievements keeps this consistent).
 */
export interface Checkpoint {
  id: string
  goalId: string
  /** legacy label; new checkpoints are identified by their value alone */
  title?: string
  /** value in the goal's metric unit that this milestone represents */
  targetValue?: number
  sortOrder: number
  achievedAt?: number
}

/** A recorded moment of progress toward a goal. */
export interface CheckIn {
  id: string
  goalId: string
  at: number
  /** measurement in the goal's metric unit, if any */
  value?: number
  notes: string
  /** legacy (pre-auto-detection); no longer written */
  checkpointId?: string
}
