import { useState } from 'react'
import { EMOJI_CATEGORIES, searchEmoji, type EmojiEntry } from './emojiData'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

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

/**
 * Full emoji grid in a sheet, with keyword search. iOS can't be told to open
 * the system emoji keyboard, so the picker ships its own set; the grid opens
 * with nothing focused (no cursor, no keyboard) and the search field is only
 * engaged if you tap it.
 */
function EmojiGridSheet({
  value,
  onSelect,
  onClose,
}: {
  value?: string
  onSelect: (emoji: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const results = query.trim() ? searchEmoji(query) : null

  const tile = ([char]: EmojiEntry) => (
    <button
      key={char}
      type="button"
      onClick={() => onSelect(char)}
      className={`flex h-9 items-center justify-center rounded-[8px] border border-edge/40 text-[19px] ${
        value === char ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface2'
      }`}
    >
      {char}
    </button>
  )

  return (
    <Sheet title="pick an emoji" onClose={onClose}>
      <div className="space-y-4">
        <div className="module flex items-center gap-2 px-3 py-2">
          <span className="shrink-0 text-ink-dim">
            <Icon name="search" size={15} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search emoji"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-dim/70"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="shrink-0 p-1 text-ink-dim"
            >
              <Icon name="x" size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {results ? (
          results.length > 0 ? (
            <div className="grid grid-cols-8 gap-1.5">{results.map(tile)}</div>
          ) : (
            <p className="px-2 py-6 text-center text-[13px] text-ink-dim">
              no emoji match “{query.trim()}”
            </p>
          )
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <section key={cat.label}>
              <p className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.1em] text-ink-dim">
                {cat.label}
              </p>
              <div className="grid grid-cols-8 gap-1.5">{cat.emoji.map(tile)}</div>
            </section>
          ))
        )}
      </div>
    </Sheet>
  )
}

export function EmojiPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (emoji: string | undefined) => void
}) {
  const isCustom = value != null && !PRESET_EMOJI.includes(value)
  const [gridOpen, setGridOpen] = useState(false)
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
      {/* any other emoji: opens the in-app grid, never the system keyboard */}
      <button
        type="button"
        aria-label="More emoji"
        onClick={() => setGridOpen(true)}
        className={`flex h-9 w-12 items-center justify-center rounded-[8px] border text-[17px] ${
          isCustom ? 'border-accent bg-accent-soft ring-2 ring-accent' : 'border-edge/40 bg-surface2 text-ink-dim'
        }`}
      >
        {isCustom ? value : <Icon name="plus" size={14} strokeWidth={2.5} />}
      </button>
      {gridOpen && (
        <EmojiGridSheet
          value={value}
          onSelect={(e) => {
            onChange(e)
            setGridOpen(false)
          }}
          onClose={() => setGridOpen(false)}
        />
      )}
    </div>
  )
}
