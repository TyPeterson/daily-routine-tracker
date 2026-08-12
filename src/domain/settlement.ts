import { addDaysStr, startOfWeekStr, type DateStr } from './dates'
import { occurrencesInRange, type Schedulable } from './recurrence'

/** One missed wagered occurrence, snapshotted at settlement time. */
export interface MissLine {
  taskId: string
  title: string
  icon?: string
  /** the day that was missed — per-date so timeframes can slice history */
  date: DateStr
  amountCents: number
  friendId: string
}

/** What one friend is owed for a settled week; name/handle are snapshots. */
export interface Payout {
  friendId: string
  name: string
  /** venmo handle, normalized (no '@') */
  handle: string
  amountCents: number
  paidAt?: number
}

/** The task fields settlement math needs — structural so tests pass plain objects. */
export interface WagerTaskLike extends Schedulable {
  id: string
  title: string
  icon?: string
  /** 'HH:mm'; absent means the task is open all day */
  timeOfDay?: string
  archivedAt?: number
  wagerCents?: number
  wagerFriendId?: string
}

export interface FriendLike {
  id: string
  firstName: string
  lastName?: string
  handle: string
}

export interface WeekSpan {
  weekStart: DateStr
  weekEnd: DateStr
}

// corruption guard: never walk more than ~5 years of missed weeks
const MAX_WEEKS = 260

/** Complete Sun–Sat weeks after settledThrough and strictly before today's week. */
export function weeksToSettle(settledThrough: DateStr, today: DateStr): WeekSpan[] {
  const currentWeekStart = startOfWeekStr(today)
  const out: WeekSpan[] = []
  // re-anchor defensively in case settledThrough isn't a Saturday
  let weekStart = startOfWeekStr(addDaysStr(settledThrough, 1))
  while (out.length < MAX_WEEKS) {
    const weekEnd = addDaysStr(weekStart, 6)
    if (weekEnd >= currentWeekStart) break
    out.push({ weekStart, weekEnd })
    weekStart = addDaysStr(weekStart, 7)
  }
  return out
}

/** True when a task's wager is fully configured and the task is live. */
function hasActiveWager(t: WagerTaskLike): boolean {
  return t.archivedAt == null && t.wagerCents != null && t.wagerCents > 0 && t.wagerFriendId != null
}

/**
 * Misses + total at stake for one week. completedKeys entries are
 * `${taskId}|${date}`. Deleted occurrences (skipDates) and deleted tasks
 * simply don't occur, so they are neither wagered nor billed.
 */
export function computeWeekSettlement(
  tasks: WagerTaskLike[],
  completedKeys: ReadonlySet<string>,
  weekStart: DateStr,
  weekEnd: DateStr,
): { wageredCents: number; misses: MissLine[] } {
  let wageredCents = 0
  const misses: MissLine[] = []
  for (const t of tasks) {
    if (!hasActiveWager(t)) continue
    for (const date of occurrencesInRange(t, weekStart, weekEnd)) {
      wageredCents += t.wagerCents!
      if (!completedKeys.has(`${t.id}|${date}`)) {
        misses.push({
          taskId: t.id,
          title: t.title,
          icon: t.icon,
          date,
          amountCents: t.wagerCents!,
          friendId: t.wagerFriendId!,
        })
      }
    }
  }
  return { wageredCents, misses }
}

/**
 * Has an occurrence's moment arrived? A task with no set time is on the hook
 * all day; a timed one only once the clock reaches it. Both arguments are
 * 'HH:mm', which compares correctly as text because the hour is zero-padded.
 */
export function isOverdue(timeOfDay: string | undefined, nowHm: string): boolean {
  return timeOfDay == null || timeOfDay <= nowHm
}

/** "Firstname Lastname" (lastName optional). */
export function friendName(f: { firstName: string; lastName?: string }): string {
  return f.lastName ? `${f.firstName} ${f.lastName}` : f.firstName
}

/** Group misses per friend, snapshotting name/handle. Unknown friendIds are skipped. */
export function buildPayouts(misses: MissLine[], friends: FriendLike[]): Payout[] {
  const byId = new Map(friends.map((f) => [f.id, f]))
  const out = new Map<string, Payout>()
  for (const m of misses) {
    const friend = byId.get(m.friendId)
    if (!friend) continue
    const existing = out.get(m.friendId)
    if (existing) existing.amountCents += m.amountCents
    else
      out.set(m.friendId, {
        friendId: m.friendId,
        name: friendName(friend),
        handle: friend.handle,
        amountCents: m.amountCents,
      })
  }
  return [...out.values()]
}

export interface TaskMissSummary {
  taskId: string
  title: string
  icon?: string
  count: number
  amountCents: number
}

/** Per-task counts/amounts, ordered by first miss date then title (deterministic). */
export function aggregateMissesByTask(misses: MissLine[]): TaskMissSummary[] {
  const byTask = new Map<string, TaskMissSummary & { firstDate: DateStr }>()
  for (const m of misses) {
    const existing = byTask.get(m.taskId)
    if (existing) {
      existing.count += 1
      existing.amountCents += m.amountCents
      if (m.date < existing.firstDate) existing.firstDate = m.date
    } else {
      byTask.set(m.taskId, {
        taskId: m.taskId,
        title: m.title,
        icon: m.icon,
        count: 1,
        amountCents: m.amountCents,
        firstDate: m.date,
      })
    }
  }
  return [...byTask.values()]
    .sort((a, b) =>
      a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : a.title.localeCompare(b.title),
    )
    .map(({ firstDate: _first, ...rest }) => rest)
}

/** Total cents owed per friendId within the given miss set. */
export function aggregateMissesByFriend(misses: MissLine[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of misses) out.set(m.friendId, (out.get(m.friendId) ?? 0) + m.amountCents)
  return out
}

/** 600 → "$6", 650 → "$6.50", 0 → "$0". */
export function formatMoney(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}
