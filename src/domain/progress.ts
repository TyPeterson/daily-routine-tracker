import { startOfWeek, subWeeks } from 'date-fns'
import { fromDateStr, toDateStr, type DateStr } from './dates'
import type { CheckIn, Checkpoint, Goal, GoalMetric, MetricDirection } from '../db/models'

/** Has `value` crossed `target` in the direction progress points? */
export function valueCrosses(direction: MetricDirection, value: number, target: number): boolean {
  return direction === 'increase' ? value >= target : value <= target
}

/** Does this check-in value reach the goal's final target? */
export function goalTargetReached(metric: GoalMetric, value: number): boolean {
  return metric.targetValue != null && valueCrosses(metric.direction, value, metric.targetValue)
}

/**
 * When (if at all) a milestone counts as reached, given check-in values in
 * time order. Backwards progress un-reaches it: only the streak of crossing
 * values that runs through to the latest check-in counts, and the reach time
 * is when that streak began.
 */
export function milestoneAchievedAt(
  direction: MetricDirection,
  target: number,
  valuedCheckIns: { at: number; value: number }[],
): number | undefined {
  let streakStart: number | undefined
  for (const ci of valuedCheckIns) {
    if (valueCrosses(direction, ci.value, target)) streakStart ??= ci.at
    else streakStart = undefined
  }
  return streakStart
}

export function latestValuedCheckIn(checkIns: CheckIn[]): CheckIn | undefined {
  return checkIns
    .filter((c) => c.value != null)
    .sort((a, b) => a.at - b.at)
    .at(-1)
}

/**
 * Percent progress (0-100) from baseline toward the metric target, based on
 * the most recent check-in with a value. Works for both directions because
 * (latest - baseline) and (target - baseline) share sign when moving the
 * right way. Returns null when there isn't enough data to say.
 */
export function metricPercent(metric: GoalMetric, checkIns: CheckIn[]): number | null {
  if (metric.targetValue == null) return null
  const valued = checkIns.filter((c) => c.value != null).sort((a, b) => a.at - b.at)
  const latest = valued.at(-1)?.value
  if (latest == null) {
    // no measurements yet: 0% if we at least know the baseline
    return metric.startValue != null ? 0 : null
  }
  const baseline = metric.startValue ?? valued[0]!.value!
  const span = metric.targetValue - baseline
  if (span === 0) return 100
  const pct = ((latest - baseline) / span) * 100
  return Math.min(100, Math.max(0, pct))
}

/**
 * Overall goal progress: explicit completion wins, then the metric,
 * then the fraction of checkpoints achieved. Null = nothing to measure.
 */
export function goalPercent(
  goal: Goal,
  checkIns: CheckIn[],
  checkpoints: Checkpoint[],
): number | null {
  if (goal.completedAt) return 100
  if (goal.metric) {
    const p = metricPercent(goal.metric, checkIns)
    if (p != null) return p
  }
  if (checkpoints.length > 0) {
    const achieved = checkpoints.filter((c) => c.achievedAt != null).length
    return (achieved / checkpoints.length) * 100
  }
  return null
}

export interface WeekBucket {
  /** Sunday that starts the week */
  weekStart: DateStr
  count: number
}

/**
 * Bucket completion dates into the trailing `numWeeks` weeks (oldest first,
 * current week last). Feeds the per-task consistency bars on a goal page.
 */
export function weeklyCompletionCounts(
  dates: DateStr[],
  numWeeks: number,
  today: DateStr,
): WeekBucket[] {
  const currentWeekStart = startOfWeek(fromDateStr(today), { weekStartsOn: 0 })
  const buckets: WeekBucket[] = []
  const index = new Map<DateStr, number>()
  for (let i = numWeeks - 1; i >= 0; i--) {
    const ws = toDateStr(subWeeks(currentWeekStart, i))
    index.set(ws, buckets.length)
    buckets.push({ weekStart: ws, count: 0 })
  }
  for (const d of dates) {
    const ws = toDateStr(startOfWeek(fromDateStr(d), { weekStartsOn: 0 }))
    const i = index.get(ws)
    if (i != null) buckets[i]!.count++
  }
  return buckets
}
