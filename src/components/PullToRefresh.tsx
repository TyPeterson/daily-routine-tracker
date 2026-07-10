import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon } from './Icon'

const TRIGGER = 44 // scaled pull distance that triggers a refresh
const MIN_HOLD_MS = 900 // stay pulled long enough to read as "refreshing"

/**
 * Scroll container with native-style pull-to-refresh: an arrow flips once the
 * pull passes the threshold, and on release the area stays held open with a
 * spinner until the refresh (plus a minimum hold) completes.
 */
export function PullToRefresh({
  onRefresh,
  className,
  children,
}: {
  onRefresh: () => Promise<void> | void
  className?: string
  children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const onTouchStart = (e: TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 1) <= 0) {
      startY.current = e.touches[0]!.clientY
      setDragging(true)
    } else {
      startY.current = null
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (startY.current == null || busy) return
    const dy = e.touches[0]!.clientY - startY.current
    if (dy > 0 && (scrollRef.current?.scrollTop ?? 1) <= 0) {
      setPull(Math.min(90, dy * 0.45))
    } else {
      setPull(0)
    }
  }

  const onTouchEnd = async () => {
    startY.current = null
    setDragging(false)
    if (busy) return
    if (pull >= TRIGGER) {
      setBusy(true)
      setPull(TRIGGER)
      const started = Date.now()
      try {
        await onRefresh()
      } finally {
        const hold = Math.max(0, MIN_HOLD_MS - (Date.now() - started))
        window.setTimeout(() => {
          setBusy(false)
          setPull(0)
        }, hold)
      }
    } else {
      setPull(0)
    }
  }

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => void onTouchEnd()}
      className={`overflow-y-auto overscroll-contain ${className ?? ''}`}
    >
      <div
        style={{ height: busy ? TRIGGER : pull }}
        className={`flex items-end justify-center overflow-hidden ${
          dragging ? '' : 'transition-[height] duration-200'
        }`}
      >
        <div className="pb-2 text-ink-dim">
          {busy ? (
            <Icon name="refresh" size={19} className="animate-spin" />
          ) : (
            <Icon
              name="arrow-down"
              size={19}
              className="transition-transform duration-150"
              style={{
                transform: pull >= TRIGGER ? 'rotate(180deg)' : 'rotate(0deg)',
                opacity: Math.min(1, pull / TRIGGER),
              }}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
