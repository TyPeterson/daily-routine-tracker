import { Icon } from './Icon'

/** Palette tuned to stay legible on both light and dark surfaces. */
export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
]

export const PRESET_EMOJI = [
  '🏃', '💪', '🏋️', '🚴', '🧘', '🥗', '💧', '💊',
  '📚', '✍️', '💼', '🧹', '😴', '🎯', '🎸', '🐕',
]

export function ColorPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (color: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
      <button
        type="button"
        aria-label="No color"
        onClick={() => onChange(undefined)}
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-ink-dim ${
          value == null ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
        }`}
      >
        <Icon name="x" size={14} strokeWidth={2.5} />
      </button>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-full ${
            value === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''
          }`}
          style={{ background: c, ...(value === c ? { ['--tw-ring-color' as string]: c } : {}) }}
        />
      ))}
    </div>
  )
}

export function EmojiPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (emoji: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
      <button
        type="button"
        aria-label="No icon"
        onClick={() => onChange(undefined)}
        className={`flex h-9 w-9 items-center justify-center rounded-xl bg-surface2 text-ink-dim ${
          value == null ? 'ring-2 ring-accent' : ''
        }`}
      >
        <Icon name="x" size={14} strokeWidth={2.5} />
      </button>
      {PRESET_EMOJI.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-[19px] ${
            value === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface2'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
