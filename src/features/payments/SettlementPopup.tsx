import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { db } from '../../db/schema'
import type { Friend } from '../../db/models'
import { acknowledgePendingSettlements, markFriendPaid } from '../../db/repo'
import { fromDateStr, type DateStr } from '../../domain/dates'
import { buildPayouts, formatMoney, type MissLine } from '../../domain/settlement'
import { buildVenmoLink, buildVenmoNote } from '../../domain/venmo'

interface PayLine {
  friendId: string
  name: string
  handle: string
  amountCents: number
  paid: boolean
}

const fmtDay = (d: DateStr) => format(fromDateStr(d), 'MMM d').toLowerCase()

/**
 * The settlement panel itself. Blocking is a property of the caller, not this
 * component: the live host withholds `closable` until every line is paid,
 * while the preview host passes it from the start and keeps "paid" in memory.
 */
function SettlementOverlay({
  span,
  wageredCents,
  lines,
  misses,
  onPay,
  onClose,
  closable,
  preview = false,
}: {
  span: string
  wageredCents: number
  lines: PayLine[]
  misses: MissLine[]
  onPay: (friendId: string) => void
  onClose: () => void
  closable: boolean
  preview?: boolean
}) {
  const owedCents = lines.reduce((sum, l) => sum + l.amountCents, 0)
  const ordered = [...lines].sort((a, b) => Number(a.paid) - Number(b.paid))

  return createPortal(
    <div className="h-glass fixed inset-x-0 top-0 z-[80] flex items-center justify-center p-5">
      {/* no onClick: in live mode the scrim is a wall, not a dismiss target */}
      <div className="animate-fade-in absolute inset-0 bg-black/50" />
      <div className="module animate-pop-in relative max-h-[80vh] w-full max-w-sm overflow-y-auto overscroll-contain p-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">{span}</p>
          {preview && (
            <span className="rounded-[5px] border border-edge/50 bg-surface2 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-ink-dim">
              preview
            </span>
          )}
        </div>
        <h2 className="mt-0.5 text-[19px] font-bold tracking-tight">
          {owedCents === 0 ? 'all clear' : 'settle up'}
        </h2>
        <p className="mt-1 text-[13px] text-ink-dim">
          {owedCents === 0
            ? `you had ${formatMoney(wageredCents)} on the line and kept every cent`
            : `${formatMoney(wageredCents)} wagered · ${formatMoney(owedCents)} owed`}
        </p>

        {ordered.length > 0 && (
          <div className="mt-4 divide-y divide-line border-y-[1.5px] border-line">
            {ordered.map((l) => (
              <div
                key={l.friendId}
                className={`flex items-center gap-3 py-3 ${l.paid ? 'opacity-70' : ''}`}
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    l.paid
                      ? 'animate-check-pop border-edge bg-accent text-on-accent'
                      : 'border-edge bg-surface2'
                  }`}
                >
                  {l.paid && <Icon name="check" size={12} strokeWidth={3} />}
                </span>
                <span
                  className={`text-[15px] font-bold ${l.paid ? 'text-ink-dim line-through' : ''}`}
                >
                  {formatMoney(l.amountCents)}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] ${
                    l.paid ? 'text-ink-dim line-through' : ''
                  }`}
                >
                  {l.name}
                </span>
                {l.paid ? (
                  <span className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">paid</span>
                ) : (
                  <a
                    href={buildVenmoLink(
                      l.handle,
                      l.amountCents,
                      buildVenmoNote(misses.filter((m) => m.friendId === l.friendId)),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onPay(l.friendId)}
                    className="key key-primary px-3.5 py-1.5 text-[13px] font-bold"
                  >
                    pay
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {closable ? (
          <button
            type="button"
            aria-label="Close settlement"
            onClick={onClose}
            className="key key-danger mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Icon name="x" size={18} strokeWidth={2.5} />
          </button>
        ) : (
          <p className="mt-4 text-center text-[11px] text-ink-dim">pay everyone to close this out</p>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Shows whenever any settlement is unacknowledged and blocks the entire app
 * until every payout is paid (or none were owed) and the user closes it.
 * Pending records live in Dexie, so closing/reopening the app re-materializes
 * the popup, and a multi-week gap merges into one reckoning.
 */
export function SettlementPopup() {
  const pending = useLiveQuery(
    async () =>
      (await db.settlements.toArray())
        .filter((s) => s.acknowledgedAt == null)
        .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)),
    [],
  )

  if (!pending || pending.length === 0) return null

  // merge payouts per friend across all pending weeks (latest snapshot wins
  // for name/handle); a friend counts as paid only when every line is
  const byFriend = new Map<string, PayLine>()
  for (const s of pending) {
    for (const p of s.payouts) {
      const line = byFriend.get(p.friendId)
      if (line) {
        line.amountCents += p.amountCents
        line.paid = line.paid && p.paidAt != null
        line.name = p.name
        line.handle = p.handle
      } else {
        byFriend.set(p.friendId, {
          friendId: p.friendId,
          name: p.name,
          handle: p.handle,
          amountCents: p.amountCents,
          paid: p.paidAt != null,
        })
      }
    }
  }
  const lines = [...byFriend.values()]

  return (
    <SettlementOverlay
      span={`${fmtDay(pending[0]!.weekStart)} – ${fmtDay(pending.at(-1)!.weekEnd)}`}
      wageredCents={pending.reduce((sum, s) => sum + s.wageredCents, 0)}
      lines={lines}
      misses={pending.flatMap((s) => s.misses)}
      onPay={(friendId) => void markFriendPaid(friendId)}
      onClose={() => void acknowledgePendingSettlements()}
      closable={lines.every((l) => l.paid)}
    />
  )
}

/**
 * Dry run of the popup against the week in progress, so the real thing can be
 * inspected any day of the week. Nothing here touches the database: "paid" is
 * component state, and closing is always allowed.
 */
export function SettlementPreview({
  misses,
  wageredCents,
  friends,
  weekStart,
  weekEnd,
  onClose,
}: {
  misses: MissLine[]
  wageredCents: number
  friends: Friend[]
  weekStart: DateStr
  weekEnd: DateStr
  onClose: () => void
}) {
  const [paidIds, setPaidIds] = useState<string[]>([])

  const lines = buildPayouts(misses, friends).map((p) => ({
    friendId: p.friendId,
    name: p.name,
    handle: p.handle,
    amountCents: p.amountCents,
    paid: paidIds.includes(p.friendId),
  }))

  return (
    <SettlementOverlay
      span={`${fmtDay(weekStart)} – ${fmtDay(weekEnd)}`}
      wageredCents={wageredCents}
      lines={lines}
      misses={misses}
      onPay={(friendId) => setPaidIds((ids) => [...ids, friendId])}
      onClose={onClose}
      closable
      preview
    />
  )
}
