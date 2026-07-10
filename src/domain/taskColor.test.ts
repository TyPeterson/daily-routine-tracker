import { describe, expect, it } from 'vitest'
import { effectiveTaskColor } from './taskColor'
import type { Goal } from '../db/models'

const goal = (id: string, color?: string): Goal => ({
  id,
  title: id,
  description: '',
  color,
  createdAt: 0,
})

const goals = new Map(
  [goal('red', '#d92b21'), goal('alsoRed', '#d92b21'), goal('blue', '#0055d4'), goal('plain')].map(
    (g) => [g.id, g],
  ),
)

describe('effectiveTaskColor', () => {
  it('an explicit task color always wins', () => {
    expect(effectiveTaskColor({ color: '#ff4d00', goalIds: ['blue'] }, goals)).toBe('#ff4d00')
  })

  it('inherits from a single colored goal', () => {
    expect(effectiveTaskColor({ goalIds: ['blue'] }, goals)).toBe('#0055d4')
  })

  it('inherits when several goals agree on one color', () => {
    expect(effectiveTaskColor({ goalIds: ['red', 'alsoRed'] }, goals)).toBe('#d92b21')
  })

  it('ambiguous goal colors → no color', () => {
    expect(effectiveTaskColor({ goalIds: ['red', 'blue'] }, goals)).toBeUndefined()
  })

  it('colorless goals contribute nothing', () => {
    expect(effectiveTaskColor({ goalIds: ['plain'] }, goals)).toBeUndefined()
    expect(effectiveTaskColor({ goalIds: ['plain', 'blue'] }, goals)).toBe('#0055d4')
  })

  it('no goals, no color', () => {
    expect(effectiveTaskColor({ goalIds: [] }, goals)).toBeUndefined()
  })
})
