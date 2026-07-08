import type { ReactNode } from 'react'

/** iOS-style inset grouped section. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-line rounded-2xl bg-surface ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 px-2 text-[12px] font-semibold tracking-wide text-ink-dim uppercase">
      {children}
    </p>
  )
}

/** A labeled row inside a Group, control pinned right. */
export function Row({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[16px]">{label}</span>
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
    <div className="flex rounded-xl bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-1.5 text-[14px] font-medium transition-colors ${
            o.value === value ? 'bg-surface shadow-sm' : 'text-ink-dim'
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
      className={`h-[30px] w-[50px] shrink-0 rounded-full p-[2px] transition-colors ${
        on ? 'bg-good' : 'bg-surface2'
      }`}
    >
      <span
        className={`block h-[26px] w-[26px] rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
