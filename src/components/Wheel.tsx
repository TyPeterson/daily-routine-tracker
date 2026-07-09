import { useEffect, useRef } from 'react'

const ITEM_H = 34
const VISIBLE = 3
const PAD = (ITEM_H * (VISIBLE - 1)) / 2

/**
 * iOS-style scroll wheel built on native scroll + snap points, so momentum
 * and rubber-banding feel exactly like the system picker.
 */
export function Wheel<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<number>(undefined)
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  // keep the wheel aligned with the value (initial mount + external changes)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [index])

  const onScroll = () => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const idx = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      const picked = options[idx]!
      if (picked.value !== value) onChange(picked.value)
    }, 120)
  }

  return (
    <div className={`relative ${className ?? ''}`} role="listbox" aria-label={ariaLabel}>
      {/* center row indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[7px] border border-edge/40 bg-surface2/60"
        style={{ height: ITEM_H }}
      />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          height: ITEM_H * VISIBLE,
          touchAction: 'pan-y',
          maskImage:
            'linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)',
        }}
      >
        <div style={{ height: PAD }} />
        {options.map((o) => (
          <div
            key={String(o.value)}
            role="option"
            aria-selected={o.value === value}
            onClick={() => onChange(o.value)}
            className={`flex snap-center items-center justify-center text-[16px] ${
              o.value === value ? 'font-bold' : 'text-ink-dim'
            }`}
            style={{ height: ITEM_H }}
          >
            {o.label}
          </div>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </div>
  )
}
