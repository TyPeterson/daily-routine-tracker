import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon, type IconName } from './Icon'

export interface SwipeAction {
  icon: IconName
  /** accessible name; buttons are icon-only circles */
  label: string
  /** background utility class, e.g. 'bg-danger' */
  bg: string
  /** icon color class; defaults to white print */
  fg?: string
  onAct: () => void
}

const GAP = 10
const EDGE_PAD = 12

/**
 * iOS-style swipe-to-reveal actions: drag the row left to expose small round
 * keys on the right. `touch-action: pan-y` hands vertical panning to the
 * browser and keeps horizontal drags for us, so the page never scrolls or
 * jitters mid-swipe. Parent controls open state so only one row is open.
 * Renders chrome-less — the consumer supplies any card faceplate around it.
 */
export function SwipeActions({
  actions,
  open,
  onOpenChange,
  children,
  size = 42,
}: {
  actions: SwipeAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** action key diameter in px; rows shorter than this will clip the keys */
  size?: number
}) {
  const fullWidth = actions.length * size + (actions.length - 1) * GAP + EDGE_PAD * 2
  const start = useRef<{ x: number; y: number; offset: number } | null>(null)
  const [drag, setDragState] = useState<number | null>(null)
  // decisions read the ref: touch events can outpace React re-renders
  const dragRef = useRef<number | null>(null)
  const setDrag = (v: number | null) => {
    dragRef.current = v
    setDragState(v)
  }
  const suppressClick = useRef(false)

  const offset = drag ?? (open ? -fullWidth : 0)

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]!
    start.current = { x: t.clientX, y: t.clientY, offset }
    suppressClick.current = false
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!start.current) return
    const t = e.touches[0]!
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    if (Math.abs(dx) < 8 && dragRef.current == null) return
    if (Math.abs(dy) > Math.abs(dx) * 1.2 && dragRef.current == null) {
      start.current = null // vertical scroll wins
      return
    }
    suppressClick.current = true
    setDrag(Math.min(0, Math.max(-fullWidth - 20, start.current.offset + dx)))
  }

  const onTouchEnd = () => {
    if (start.current == null && dragRef.current == null) return
    start.current = null
    if (dragRef.current != null) onOpenChange(dragRef.current < -fullWidth / 2)
    setDrag(null)
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end"
        style={{ width: fullWidth, gap: GAP, paddingRight: EDGE_PAD }}
      >
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            aria-label={a.label}
            onClick={() => {
              onOpenChange(false)
              a.onAct()
            }}
            className={`flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-edge ${a.fg ?? 'text-white'} ${a.bg}`}
            style={{ width: size, height: size }}
          >
            <Icon name={a.icon} size={Math.round(size * 0.4)} />
          </button>
        ))}
      </div>
      <div
        onTouchStart={(e) => {
          e.stopPropagation() // keep row swipes from also switching tabs
          onTouchStart(e)
        }}
        onTouchMove={(e) => {
          e.stopPropagation()
          onTouchMove(e)
        }}
        onTouchEnd={(e) => {
          e.stopPropagation()
          onTouchEnd()
        }}
        onClickCapture={(e) => {
          if (suppressClick.current || open) {
            e.stopPropagation()
            e.preventDefault()
            suppressClick.current = false
            if (open) onOpenChange(false)
          }
        }}
        className="relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: drag != null ? 'none' : 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
