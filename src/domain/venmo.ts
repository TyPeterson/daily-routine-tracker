import { aggregateMissesByTask, type MissLine } from './settlement'

/** Trim and strip a single leading '@'. */
export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

/**
 * One line per missed task across the whole span: `<emoji>x<count>` when the
 * task has an icon, `[Title]x<count>` otherwise. No space around the 'x'.
 */
export function buildVenmoNote(misses: MissLine[]): string {
  return aggregateMissesByTask(misses)
    .map((t) => `${t.icon ?? `[${t.title}]`}x${t.count}`)
    .join('\n')
}

/** Deep link that opens the Venmo app with recipient, amount, and note prefilled. */
export function buildVenmoLink(handle: string, amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2)
  return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(
    normalizeHandle(handle),
  )}&amount=${amount}&note=${encodeURIComponent(note)}`
}
