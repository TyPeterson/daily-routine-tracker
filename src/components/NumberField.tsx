import { useState } from 'react'

/**
 * Integer field for values with an obvious default (repeat interval, day of
 * month). Tapping in clears it so you can type fresh; it may sit empty while
 * editing; leaving it empty falls back to the last committed value. Valid
 * digits commit as you type, so saving mid-edit always works.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  className,
}: {
  value: number
  onCommit: (n: number) => void
  min: number
  max: number
  className?: string
}) {
  // null = not editing; while editing the draft may be '' without snapping back
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft ?? String(value)}
      onFocus={() => setDraft('')}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
        setDraft(digits)
        if (digits !== '') {
          onCommit(Math.min(max, Math.max(min, Number.parseInt(digits, 10))))
        }
      }}
      onBlur={() => setDraft(null)}
      className={
        className ?? 'w-16 rounded-lg bg-surface2 px-2 py-1 text-center outline-none'
      }
    />
  )
}
