import type { ReactNode } from 'react'

/** A faceplate module: bordered panel with internal divider rows. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`module divide-y divide-line overflow-hidden ${className ?? ''}`}>
      {children}
    </div>
  )
}

/** Silkscreen section label, optionally with a printed index ("01 repeats"). */
export function SectionLabel({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.1em] text-ink-dim">
      {index && <span className="mr-1.5 text-accent">{index}</span>}
      {children}
    </p>
  )
}

/** A labeled row inside a Group, control pinned right. */
export function Row({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[15px]">{label}</span>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="module flex overflow-hidden p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[6px] py-1.5 text-[13px] font-semibold transition-colors ${
            o.value === value ? 'bg-edge text-canvas' : 'text-ink-dim'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-[30px] w-[52px] shrink-0 rounded-full border-[1.5px] border-edge p-[2px] transition-colors ${
        on ? 'bg-accent' : 'bg-surface2'
      }`}
    >
      <span
        className={`block h-[22px] w-[22px] rounded-full border-[1.5px] border-edge bg-surface transition-transform duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
          on ? 'translate-x-[22px]' : ''
        }`}
      />
    </button>
  )
}
