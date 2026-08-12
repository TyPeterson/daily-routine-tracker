import { describe, expect, it } from 'vitest'
import { EMOJI_CATEGORIES, searchEmoji } from './emojiData'

const all = EMOJI_CATEGORIES.flatMap((c) => c.emoji)

describe('EMOJI_CATEGORIES', () => {
  it('every entry is exactly one grapheme', () => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    for (const [char] of all) {
      const parts = [...segmenter.segment(char)]
      expect(parts.length, `"${char}"`).toBe(1)
    }
  })

  it('has no duplicate characters', () => {
    const chars = all.map(([c]) => c)
    expect(new Set(chars).size).toBe(chars.length)
  })

  it('every entry carries lowercase search keywords', () => {
    for (const [char, keywords] of all) {
      expect(keywords.length, `"${char}" has no keywords`).toBeGreaterThan(0)
      expect(keywords, `"${char}" keywords must be lowercase`).toBe(keywords.toLowerCase())
    }
  })

  it('has a useful amount of choice', () => {
    expect(all.length).toBeGreaterThan(200)
  })
})

describe('searchEmoji', () => {
  it('finds emoji by name', () => {
    expect(searchEmoji('pizza').map(([c]) => c)).toContain('🍕')
    expect(searchEmoji('running').map(([c]) => c)).toContain('🏃')
  })

  it('finds emoji by an associated keyword, not just the name', () => {
    expect(searchEmoji('gym').map(([c]) => c)).toContain('💪')
    expect(searchEmoji('laundry').map(([c]) => c)).toContain('🧺')
    expect(searchEmoji('caffeine').map(([c]) => c)).toContain('☕')
  })

  it('matches partial words so results appear while typing', () => {
    expect(searchEmoji('piz').map(([c]) => c)).toContain('🍕')
  })

  it('requires every term to match', () => {
    expect(searchEmoji('ice cream').map(([c]) => c)).toContain('🍦')
    expect(searchEmoji('pizza cream')).toHaveLength(0)
  })

  it('is case insensitive and ignores surrounding whitespace', () => {
    expect(searchEmoji('  PIZZA ').map(([c]) => c)).toContain('🍕')
  })

  it('returns nothing for an empty query', () => {
    expect(searchEmoji('')).toHaveLength(0)
    expect(searchEmoji('   ')).toHaveLength(0)
  })
})
