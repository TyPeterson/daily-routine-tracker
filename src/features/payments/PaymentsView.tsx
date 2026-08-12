import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { confirmDialog } from '../../components/Dialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { Group, SectionLabel, Segmented } from '../../components/forms'
import { db } from '../../db/schema'
import type { Friend } from '../../db/models'
import { deleteFriend } from '../../db/repo'
import {
  addDaysStr,
  endOfWeekStr,
  fromDateStr,
  startOfWeekStr,
  toTimeStr,
  todayStr,
} from '../../domain/dates'
import {
  aggregateMissesByFriend,
  aggregateMissesByTask,
  computeWeekSettlement,
  formatMoney,
  friendName,
  isOverdue,
  type MissLine,
} from '../../domain/settlement'
import { AddFriendSheet } from './FriendPicker'
import { SettlementPreview } from './SettlementPopup'

type Timeframe = 'week' | 'mtd' | '30d' | 'all'

/** "3d 14h" / "14h" / "under an hour" — day-and-hour precision is enough. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'any moment'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return 'under an hour'
}

export default function PaymentsView() {
  const [timeframe, setTimeframe] = useState<Timeframe>('week')
  const [editing, setEditing] = useState<Friend | null>(null)
  const [adding, setAdding] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const today = todayStr()
  const weekStart = startOfWeekStr(today)
  const yesterday = addDaysStr(today, -1)

  // the week locks in at next sunday midnight; day/hour precision, so a
  // minute tick keeps it honest without churning the page
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const closesIn = formatCountdown(fromDateStr(addDaysStr(weekStart, 7)).getTime() - nowMs)

  const data = useLiveQuery(async () => {
    const [tasks, friends, settlements] = await Promise.all([
      db.tasks.toArray(),
      db.friends.toArray(),
      db.settlements.toArray(),
    ])
    const keys = (rows: { taskId: string; date: string; completedAt: number }[]) =>
      new Map(rows.map((c) => [`${c.taskId}|${c.date}`, c.completedAt]))
    // days of the current week that are already behind us; marking one of
    // them done later still erases its miss (the grace window)
    let earlier: { wageredCents: number; misses: MissLine[] } = { wageredCents: 0, misses: [] }
    if (yesterday >= weekStart) {
      const done = await db.completions.where('date').between(weekStart, yesterday, true, true).toArray()
      earlier = computeWeekSettlement(tasks, keys(done), weekStart, yesterday)
    }
    // today in full; the time-of-day cut is applied at render so the number
    // keeps up with the clock without re-running the query
    const doneToday = await db.completions.where('date').equals(today).toArray()
    const todays = computeWeekSettlement(tasks, keys(doneToday), today, today)
    return {
      friends,
      settlements,
      earlier,
      todays,
      timeByTask: new Map(tasks.map((t) => [t.id, t.timeOfDay])),
    }
  }, [today])

  const friends = data?.friends ?? []
  const settlements = data?.settlements ?? []
  const earlier = data?.earlier ?? { wageredCents: 0, misses: [] }
  const todays = data?.todays ?? { wageredCents: 0, misses: [] }
  const timeByTask = data?.timeByTask ?? new Map<string, string | undefined>()

  // only what's already come due today counts against you yet
  const nowHm = toTimeStr(new Date(nowMs))
  const todayMisses = todays.misses.filter((m) => isOverdue(timeByTask.get(m.taskId), nowHm))
  const todayCents = todayMisses.reduce((sum, m) => sum + m.amountCents, 0)

  const from =
    timeframe === 'week'
      ? weekStart
      : timeframe === 'mtd'
        ? `${today.slice(0, 8)}01`
        : timeframe === '30d'
          ? addDaysStr(today, -30)
          : '0000-01-01'
  // settled weeks are frozen records; only the current week is live
  const misses = [
    ...settlements.flatMap((s) => s.misses),
    ...earlier.misses,
    ...todayMisses,
  ].filter((m) => m.date >= from && m.date <= today)
  const byTask = aggregateMissesByTask(misses)
  const byFriend = aggregateMissesByFriend(misses)
  const owedCents = misses.reduce((sum, m) => sum + m.amountCents, 0)

  // names for the per-person list: live friends first, payout snapshots as
  // fallback so history keeps its labels after a friend is deleted
  const names = new Map<string, { name: string; handle: string }>()
  for (const s of settlements)
    for (const p of s.payouts) names.set(p.friendId, { name: p.name, handle: p.handle })
  for (const f of friends) names.set(f.id, { name: friendName(f), handle: f.handle })

  return (
    <Screen title="payments" subtitle="routine">
      <div className="space-y-6">
        <Segmented
          value={timeframe}
          onChange={setTimeframe}
          options={[
            { value: 'week', label: 'week' },
            { value: 'mtd', label: 'mtd' },
            { value: '30d', label: '30d' },
            { value: 'all', label: 'all' },
          ]}
        />

        <section>
          <div className="module p-4">
            <p className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">owed</p>
            <p className="mt-0.5 text-[31px] leading-tight font-bold tracking-tight">
              {formatMoney(owedCents)}
            </p>
            {todayCents > 0 && (
              <p className="mt-0.5 text-[15px] font-bold text-ink-dim/70">
                {formatMoney(todayCents)} today
              </p>
            )}
            <p className="mt-2.5 border-t border-line pt-2.5 text-[11px] font-bold tracking-[0.08em] text-ink-dim">
              week closes in <span className="text-accent">{closesIn}</span>
            </p>
          </div>
        </section>

        <section>
          <SectionLabel index="01">by task</SectionLabel>
          {byTask.length > 0 ? (
            <Group>
              {byTask.map((t) => (
                <div key={t.taskId} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate text-[15px]">
                    {t.icon ? `${t.icon} ` : ''}
                    {t.title}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="text-[12px] text-ink-dim">x{t.count}</span>
                    <span className="text-[15px] font-bold">{formatMoney(t.amountCents)}</span>
                  </span>
                </div>
              ))}
            </Group>
          ) : (
            <p className="px-2 text-[13px] text-ink-dim">nothing owed in this period</p>
          )}
        </section>

        <section>
          <SectionLabel index="02">by person</SectionLabel>
          {byFriend.size > 0 ? (
            <Group>
              {[...byFriend.entries()].map(([friendId, cents]) => {
                const who = names.get(friendId)
                return (
                  <div key={friendId} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{who?.name ?? 'unknown friend'}</span>
                      {who && <span className="block text-[11px] text-ink-dim">@{who.handle}</span>}
                    </span>
                    <span className="shrink-0 text-[15px] font-bold">{formatMoney(cents)}</span>
                  </div>
                )
              })}
            </Group>
          ) : (
            <p className="px-2 text-[13px] text-ink-dim">no one is owed anything</p>
          )}
        </section>

        <section>
          <SectionLabel index="03">friends</SectionLabel>
          {friends.length > 0 ? (
            <Group>
              {friends.map((f) => (
                <div key={f.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{friendName(f)}</span>
                    <span className="block text-[11px] text-ink-dim">@{f.handle}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${f.firstName}`}
                      onClick={() => setEditing(f)}
                      className="p-2 text-ink-dim"
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${f.firstName}`}
                      onClick={() => void removeFriend(f)}
                      className="p-2 text-danger"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex min-h-12 w-full items-center justify-center gap-1.5 px-4 py-2 text-[14px] font-semibold text-accent"
              >
                <Icon name="plus" size={14} strokeWidth={2.5} />
                add friend
              </button>
            </Group>
          ) : (
            <div className="module">
              <EmptyState icon="bill" title="no friends yet" hint="add someone to bet against" />
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="key key-primary mx-auto mb-5 flex items-center gap-1.5 px-4 py-2 text-[14px] font-bold"
              >
                <Icon name="plus" size={14} strokeWidth={2.5} />
                add friend
              </button>
            </div>
          )}
        </section>
        <section>
          <SectionLabel index="04">testing</SectionLabel>
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="key w-full py-3 text-[14px] font-bold"
          >
            preview settlement popup
          </button>
          <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
            dry run against this week so far — paying here settles nothing
          </p>
        </section>
      </div>

      {adding && <AddFriendSheet onClose={() => setAdding(false)} />}
      {editing && <AddFriendSheet friend={editing} onClose={() => setEditing(null)} />}
      {previewing && (
        <SettlementPreview
          misses={[...earlier.misses, ...todayMisses]}
          wageredCents={earlier.wageredCents + todays.wageredCents}
          friends={friends}
          weekStart={weekStart}
          weekEnd={endOfWeekStr(today)}
          onClose={() => setPreviewing(false)}
        />
      )}
    </Screen>
  )
}

async function removeFriend(f: Friend) {
  const ok = await confirmDialog({
    title: `delete ${f.firstName}?`,
    message: 'tasks betting on them will have their payment removed',
    confirmLabel: 'delete',
    danger: true,
  })
  if (ok) await deleteFriend(f.id)
}
