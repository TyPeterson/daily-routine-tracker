import { db } from '../../db/schema'
import { getMeta, setMeta, SETTLED_THROUGH_KEY } from '../../db/repo'
import { addDaysStr, startOfWeekStr, todayStr } from '../../domain/dates'
import { buildPayouts, computeWeekSettlement, weeksToSettle } from '../../domain/settlement'

const HOUR = 60 * 60 * 1000

let running = false

/**
 * Freeze every complete week since settledThrough into a settlement record.
 * Idempotent and safe to re-run: each week is created at most once (checked
 * here, backstopped by the unique weekStart index), and everything happens in
 * one transaction so the completion snapshot and the marker advance together.
 *
 * The grace window falls out of running lazily: completions are read at the
 * moment this first runs on/after a Sunday, so anything backfilled before the
 * app was opened still counts. Weeks with nothing at stake produce no record
 * (no popup) but still advance the marker.
 */
export async function settleDueWeeks(today = todayStr()): Promise<void> {
  if (running) return
  running = true
  try {
    await db.transaction(
      'rw',
      [db.tasks, db.completions, db.settlements, db.friends, db.meta],
      async () => {
        let settledThrough = await getMeta(SETTLED_THROUGH_KEY)
        if (settledThrough == null) {
          // first run ever: anchor to last Saturday so history is never billed
          settledThrough = addDaysStr(startOfWeekStr(today), -1)
          await setMeta(SETTLED_THROUGH_KEY, settledThrough)
          return
        }
        const weeks = weeksToSettle(settledThrough, today)
        if (weeks.length === 0) return
        const [tasks, friends] = await Promise.all([db.tasks.toArray(), db.friends.toArray()])
        for (const { weekStart, weekEnd } of weeks) {
          const exists = await db.settlements.where('weekStart').equals(weekStart).count()
          if (exists === 0) {
            const completions = await db.completions
              .where('date')
              .between(weekStart, weekEnd, true, true)
              .toArray()
            const completedAt = new Map(
              completions.map((c) => [`${c.taskId}|${c.date}`, c.completedAt]),
            )
            const { wageredCents, misses } = computeWeekSettlement(
              tasks,
              completedAt,
              weekStart,
              weekEnd,
            )
            if (wageredCents > 0) {
              await db.settlements.add({
                id: crypto.randomUUID(),
                weekStart,
                weekEnd,
                createdAt: Date.now(),
                wageredCents,
                misses,
                payouts: buildPayouts(misses, friends),
              })
            }
          }
          await setMeta(SETTLED_THROUGH_KEY, weekEnd)
        }
      },
    )
  } finally {
    running = false
  }
}

/**
 * Keep settlements current while the app is open. iOS keeps home-screen apps
 * suspended for days, so besides the mount-time run we re-check on foreground
 * and hourly (an app left open across Saturday midnight still settles).
 */
export function startSettlementWatcher(): () => void {
  const run = () => {
    if (document.visibilityState === 'visible') void settleDueWeeks()
  }
  void settleDueWeeks()
  document.addEventListener('visibilitychange', run)
  const timer = window.setInterval(run, HOUR)
  return () => {
    document.removeEventListener('visibilitychange', run)
    window.clearInterval(timer)
  }
}
