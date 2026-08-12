import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { db } from '../../db/schema'
import { acknowledgePendingSettlements, markFriendPaid } from '../../db/repo'
import { fromDateStr, type DateStr } from '../../domain/dates'
import { formatMoney } from '../../domain/settlement'
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
 * The Sunday reckoning. Shows whenever any settlement is unacknowledged and
 * blocks the entire app until every payout is paid (or none were owed) and
 * the user closes it. Deliberately has no dismiss path: the backdrop ignores
 * taps and the ✗ only renders once all lines are paid. Pending records live
 * in Dexie, so closing/reopening the app re-materializes the popup.
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

  // merge payouts per friend across all pending weeks (newest snapshot wins
  // for name/handle); a friend is "paid" only when every underlying line is
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
  const lines = [...byFriend.values()].sort((a, b) => Number(a.paid) - Number(b.paid))
  const allMisses = pending.flatMap((s) => s.misses)
  const wageredCents = pending.reduce((sum, s) => sum + s.wageredCents, 0)
  const owedCents = lines.reduce((sum, l) => sum + l.amountCents, 0)
  const allPaid = lines.every((l) => l.paid)
  const span = `${fmtDay(pending[0]!.weekStart)} – ${fmtDay(pending.at(-1)!.weekEnd)}`

  return createPortal(
    <div className="h-glass fixed inset-x-0 top-0 z-[80] flex items-center justify-center p-5">
      {/* no onClick: the scrim is a wall, not a dismiss target */}
      <div className="animate-fade-in absolute inset-0 bg-black/50" />
      <div className="module animate-pop-in relative max-h-[80vh] w-full max-w-sm overflow-y-auto overscroll-contain p-5">
        <p className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">{span}</p>
        <h2 className="mt-0.5 text-[19px] font-bold tracking-tight">
          {owedCents === 0 ? 'all clear' : 'settle up'}
        </h2>
        <p className="mt-1 text-[13px] text-ink-dim">
          {owedCents === 0
            ? `you had ${formatMoney(wageredCents)} on the line and kept every cent`
            : `${formatMoney(wageredCents)} wagered · ${formatMoney(owedCents)} owed`}
        </p>

        {lines.length > 0 && (
          <div className="mt-4 divide-y divide-line border-y-[1.5px] border-line">
            {lines.map((l) => (
              <div key={l.friendId} className={`flex items-center gap-3 py-3 ${l.paid ? 'opacity-70' : ''}`}>
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    l.paid ? 'animate-check-pop border-edge bg-accent text-on-accent' : 'border-edge bg-surface2'
                  }`}
                >
                  {l.paid && <Icon name="check" size={12} strokeWidth={3} />}
                </span>
                <span className={`text-[15px] font-bold ${l.paid ? 'text-ink-dim line-through' : ''}`}>
                  {formatMoney(l.amountCents)}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${l.paid ? 'text-ink-dim line-through' : ''}`}>
                  {l.name}
                </span>
                {l.paid ? (
                  <span className="text-[11px] font-bold tracking-[0.1em] text-ink-dim">paid</span>
                ) : (
                  <a
                    href={buildVenmoLink(
                      l.handle,
                      l.amountCents,
                      buildVenmoNote(allMisses.filter((m) => m.friendId === l.friendId)),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void markFriendPaid(l.friendId)}
                    className="key key-primary px-3.5 py-1.5 text-[13px] font-bold"
                  >
                    pay
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {allPaid ? (
          <button
            type="button"
            aria-label="Close settlement"
            onClick={() => void acknowledgePendingSettlements()}
            className="key key-danger mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Icon name="x" size={18} strokeWidth={2.5} />
          </button>
        ) : (
          <p className="mt-4 text-center text-[11px] text-ink-dim">
            pay everyone to close this out
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
