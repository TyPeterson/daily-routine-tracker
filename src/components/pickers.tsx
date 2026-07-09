import { Icon } from './Icon'

/** Hardware-ish palette: signal colors that read on ivory and charcoal. */
export const PRESET_COLORS = [
  '#d92b21', // red
  '#ff4d00', // signal orange
  '#eab000', // yellow
  '#0f9d58', // green
  '#00a3a3', // teal
  '#0055d4', // cobalt
  '#5a4fe0', // violet
  '#b03fd4', // magenta
  '#e0559a', // pink
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
        className={`flex h-9 w-9 items-center justify-center rounded-[8px] border border-edge/40 bg-surface2 text-ink-dim ${
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
          className={`flex h-9 w-9 items-center justify-center rounded-[8px] border border-edge/40 text-[19px] ${
            value === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface2'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
