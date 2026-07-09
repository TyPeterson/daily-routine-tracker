import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon, type IconName } from './Icon'

export interface SwipeAction {
  icon: IconName
  label: string
  /** background utility class, e.g. 'bg-danger' */
  bg: string
  /** text color class; defaults to white print */
  fg?: string
  onAct: () => void
}

const ACTION_WIDTH = 64

/**
 * iOS-style swipe-to-reveal actions: drag the row left to expose buttons on
 * the right. Parent controls open state so only one row is open at a time.
 */
export function SwipeActions({
  actions,
  open,
  onOpenChange,
  children,
}: {
  actions: SwipeAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const fullWidth = actions.length * ACTION_WIDTH
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
    setDrag(Math.min(0, Math.max(-fullWidth - 24, start.current.offset + dx)))
  }

  const onTouchEnd = () => {
    if (start.current == null && dragRef.current == null) return
    start.current = null
    if (dragRef.current != null) onOpenChange(dragRef.current < -fullWidth / 2)
    setDrag(null)
  }

  return (
    <div className="module relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: fullWidth }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              onOpenChange(false)
              a.onAct()
            }}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${a.fg ?? 'text-white'} ${a.bg}`}
            style={{ width: ACTION_WIDTH }}
          >
            <Icon name={a.icon} size={19} />
            {a.label}
          </button>
        ))}
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
        }}
      >
        {children}
      </div>
    </div>
  )
}
