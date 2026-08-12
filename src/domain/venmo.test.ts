import { describe, expect, it } from 'vitest'
import type { MissLine } from './settlement'
import { buildVenmoLink, buildVenmoNote, normalizeHandle } from './venmo'

const miss = (partial: Partial<MissLine>): MissLine => ({
  taskId: 't1',
  title: 'Exercise',
  icon: '🏃',
  date: '2026-01-05',
  amountCents: 300,
  friendId: 'f1',
  ...partial,
})

describe('normalizeHandle', () => {
  it('strips one leading @ and trims whitespace', () => {
    expect(normalizeHandle('@huntgar123')).toBe('huntgar123')
    expect(normalizeHandle('  @allygpete  ')).toBe('allygpete')
    expect(normalizeHandle('plain')).toBe('plain')
  })

  it('leaves interior characters alone', () => {
    expect(normalizeHandle('a@b')).toBe('a@b')
  })
})

describe('buildVenmoNote', () => {
  it('uses the emoji with a count and no spaces', () => {
    expect(buildVenmoNote([miss({}), miss({ date: '2026-01-07' })])).toBe('🏃x2')
  })

  it('falls back to [Title] when the task has no emoji', () => {
    expect(buildVenmoNote([miss({ icon: undefined, title: 'Brush Teeth' })])).toBe('[Brush Teeth]x1')
  })

  it('one line per task, newline-joined, in first-miss order', () => {
    const note = buildVenmoNote([
      miss({}),
      miss({ date: '2026-01-07' }),
      miss({ taskId: 't2', title: 'Brush Teeth', icon: undefined, date: '2026-01-06' }),
    ])
    expect(note).toBe('🏃x2\n[Brush Teeth]x1')
  })

  it('merges counts for the same task across weeks', () => {
    const note = buildVenmoNote([
      miss({ date: '2026-01-05' }),
      miss({ date: '2026-01-09' }),
      miss({ date: '2026-01-13' }), // following week
    ])
    expect(note).toBe('🏃x3')
  })
})

describe('buildVenmoLink', () => {
  it('builds the paycharge deep link with a two-decimal amount', () => {
    const link = buildVenmoLink('huntgar123', 800, '🏃x2\n[Brush Teeth]x1')
    expect(link.startsWith('venmo://paycharge?txn=pay&recipients=huntgar123&amount=8.00&note=')).toBe(true)
  })

  it('strips @ from the handle and URL-encodes the note', () => {
    const note = '🏃x2\n[Brush Teeth]x1'
    const link = buildVenmoLink('@huntgar123', 650, note)
    expect(link).toContain('recipients=huntgar123')
    expect(link).toContain('amount=6.50')
    const encoded = link.split('note=')[1]!
    expect(encoded).not.toContain('\n')
    expect(encoded).not.toContain('[')
    expect(decodeURIComponent(encoded)).toBe(note)
  })
})
