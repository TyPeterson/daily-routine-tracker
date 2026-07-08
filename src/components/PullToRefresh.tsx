import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon } from './Icon'

const TRIGGER = 44 // scaled pull distance that triggers a refresh

/**
 * Scroll container with native-style pull-to-refresh. Pulling down past the
 * threshold while at the top runs onRefresh (here: a check for new deploys —
 * data is already live via Dexie queries).
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
      try {
        await onRefresh()
        // brief pause so the spinner reads as "did something"
        await new Promise((r) => setTimeout(r, 350))
      } finally {
        setBusy(false)
        setPull(0)
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
        style={{ height: pull }}
        className={`flex items-end justify-center overflow-hidden ${
          dragging ? '' : 'transition-[height] duration-200'
        }`}
      >
        <div
          className={`pb-2 text-ink-dim ${busy ? 'animate-spin' : ''}`}
          style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }}
        >
          <Icon name="refresh" size={20} />
        </div>
      </div>
      {children}
    </div>
  )
}
