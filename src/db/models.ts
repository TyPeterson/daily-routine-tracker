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
  /** optional 'HH:mm' used for ordering and display */
  timeOfDay?: string
  /** goals this task contributes to (many-to-many) */
  goalIds: string[]
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
  createdAt: number
  completedAt?: number
  archivedAt?: number
}

/** Ordered milestone inside a goal (run 1 mi → 5 mi → marathon). */
export interface Checkpoint {
  id: string
  goalId: string
  title: string
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
  /** set when this check-in marked a checkpoint as reached */
  checkpointId?: string
}
