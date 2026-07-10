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
 *
 * While the finger moves, the indicator is driven by direct style writes —
 * no React state — so dragging never re-renders the page under it. State is
 * only touched on the rare idle/busy flips. A pull also only engages on a
 * clearly vertical gesture, so horizontal tab swipes can't flicker it open.
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
  const spacerRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLSpanElement>(null)
  const [busy, setBusy] = useState(false)

  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let gesture: { startX: number; startY: number; pulling: boolean } | null = null
    let pullNow = 0
    let busyNow = false

    const setSpacer = (height: number, animate: boolean) => {
      const spacer = spacerRef.current
      if (!spacer) return
      spacer.style.transition = animate ? 'height 300ms ease-out' : 'none'
      spacer.style.height = `${height}px`
    }
    const paintArrow = (pull: number) => {
      const arrow = arrowRef.current
      if (!arrow) return
      arrow.style.transform = pull >= TRIGGER ? 'rotate(180deg)' : 'rotate(0deg)'
      arrow.style.opacity = `${Math.min(1, pull / TRIGGER)}`
    }

    const onStart = (e: TouchEvent) => {
      if (busyNow) return
      const t = e.touches[0]!
      gesture = el.scrollTop <= 0 ? { startX: t.clientX, startY: t.clientY, pulling: false } : null
    }

    const onMove = (e: TouchEvent) => {
      if (!gesture || busyNow) return
      const dx = e.touches[0]!.clientX - gesture.startX
      const dy = e.touches[0]!.clientY - gesture.startY
      if (!gesture.pulling) {
        if (dy > 6 && dy > Math.abs(dx) && el.scrollTop <= 0) {
          gesture.pulling = true
        } else if (dy < 0 || Math.abs(dx) > 12) {
          gesture = null
          return
        } else {
          return
        }
      }
      e.preventDefault()
      pullNow = Math.max(0, Math.min(100, dy * 0.5))
      setSpacer(pullNow, false)
      paintArrow(pullNow)
    }

    const onEnd = () => {
      const wasPulling = gesture?.pulling
      gesture = null
      if (!wasPulling || busyNow) return
      if (pullNow >= TRIGGER) {
        busyNow = true
        setBusy(true)
        setSpacer(TRIGGER, true)
        const started = Date.now()
        void Promise.resolve(refreshRef.current()).finally(() => {
          const hold = Math.max(0, MIN_HOLD_MS - (Date.now() - started))
          window.setTimeout(() => {
            busyNow = false
            setBusy(false)
            setSpacer(0, true)
            paintArrow(0)
          }, hold)
        })
      } else {
        setSpacer(0, true)
        paintArrow(0)
      }
      pullNow = 0
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
      <div ref={spacerRef} className="flex h-0 items-end justify-center overflow-hidden">
        <div className="pb-2 text-ink-dim">
          {busy ? (
            <Icon name="refresh" size={19} className="animate-spin" />
          ) : (
            <span
              ref={arrowRef}
              className="block opacity-0 transition-transform duration-150"
            >
              <Icon name="arrow-down" size={19} />
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
