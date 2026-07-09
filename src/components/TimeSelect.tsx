import { Wheel } from './Wheel'

const pad = (n: number) => String(n).padStart(2, '0')

const HOURS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad(i * 5) }))
const PERIODS = [
  { value: 'AM' as const, label: 'AM' },
  { value: 'PM' as const, label: 'PM' },
]

/** Hour / minute / AM-PM scroll wheels storing 'HH:mm'; minutes step by 5. */
export function TimeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [h24 = 8, rawMin = 0] = value.split(':').map(Number)
  const minute = Math.floor(rawMin / 5) * 5
  const hour12 = h24 % 12 || 12
  const isPM = h24 >= 12

  const commit = (h12: number, min: number, pm: boolean) => {
    const hour = (h12 % 12) + (pm ? 12 : 0)
    onChange(`${pad(hour)}:${pad(min)}`)
  }

  return (
    <div className="flex items-stretch justify-center gap-2">
      <Wheel
        ariaLabel="Hour"
        options={HOURS}
        value={hour12}
        onChange={(h) => commit(h, minute, isPM)}
        className="w-16"
      />
      <Wheel
        ariaLabel="Minutes"
        options={MINUTES}
        value={minute}
        onChange={(m) => commit(hour12, m, isPM)}
        className="w-16"
      />
      <Wheel
        ariaLabel="AM or PM"
        options={PERIODS}
        value={isPM ? 'PM' : 'AM'}
        onChange={(p) => commit(hour12, minute, p === 'PM')}
        className="w-16"
      />
    </div>
  )
}
