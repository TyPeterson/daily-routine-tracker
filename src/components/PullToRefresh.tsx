import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

const TRIGGER = 44 // scaled pull distance that triggers a refresh
const MIN_HOLD_MS = 900 // stay pulled long enough to read as "refreshing"

/**
 * Scroll container with native-style pull-to-refresh.
 *
 * The gesture is owned outright: touchmove is registered non-passive and
 * preventDefault()ed once a pull engages, so iOS never rubber-bands the list
 * underneath the indicator (React's synthetic touch handlers are passive and
 * can't do this — the source of the old fighting-motions jank). An arrow
 * flips at the threshold; on release the area stays held open with a spinner
 * until the refresh (plus a minimum hold) completes, then eases shut.
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
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let gesture: { startY: number; pulling: boolean } | null = null
    let pullNow = 0
    let busyNow = false

    const setPullBoth = (v: number) => {
      pullNow = v
      setPull(v)
    }

    const onStart = (e: TouchEvent) => {
      if (busyNow) return
      gesture = el.scrollTop <= 0 ? { startY: e.touches[0]!.clientY, pulling: false } : null
    }

    const onMove = (e: TouchEvent) => {
      if (!gesture || busyNow) return
      const dy = e.touches[0]!.clientY - gesture.startY
      if (!gesture.pulling) {
        if (dy > 6 && el.scrollTop <= 0) {
          gesture.pulling = true
          setDragging(true)
        } else if (dy < 0) {
          gesture = null
          return
        } else {
          return
        }
      }
      e.preventDefault()
      setPullBoth(Math.max(0, Math.min(100, dy * 0.5)))
    }

    const onEnd = () => {
      const wasPulling = gesture?.pulling
      gesture = null
      setDragging(false)
      if (!wasPulling || busyNow) return
      if (pullNow >= TRIGGER) {
        busyNow = true
        setBusy(true)
        setPullBoth(TRIGGER)
        const started = Date.now()
        void Promise.resolve(refreshRef.current()).finally(() => {
          const hold = Math.max(0, MIN_HOLD_MS - (Date.now() - started))
          window.setTimeout(() => {
            busyNow = false
            setBusy(false)
            setPullBoth(0)
          }, hold)
        })
      } else {
        setPullBoth(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return (
    <div ref={scrollRef} className={`overflow-y-auto overscroll-contain ${className ?? ''}`}>
      <div
        style={{ height: busy ? TRIGGER : pull }}
        className={`flex items-end justify-center overflow-hidden ${
          dragging ? '' : 'transition-[height] duration-300 ease-out'
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
