import { describe, expect, it } from 'vitest'
import { EMOJI_CATEGORIES } from './emojiData'

describe('EMOJI_CATEGORIES', () => {
  const all = EMOJI_CATEGORIES.flatMap((c) => c.emoji)

  it('every entry is exactly one grapheme', () => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    for (const e of all) {
      const parts = [...segmenter.segment(e)]
      expect(parts.length, `"${e}" (${[...e].map((c) => c.codePointAt(0)?.toString(16)).join(' ')})`).toBe(1)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(all).size).toBe(all.length)
  })

  it('has a useful amount of choice', () => {
    expect(all.length).toBeGreaterThan(200)
  })
})
