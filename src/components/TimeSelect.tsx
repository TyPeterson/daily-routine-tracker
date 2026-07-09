const pad = (n: number) => String(n).padStart(2, '0')

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/**
 * Hour / minute / AM-PM selects storing 'HH:mm'. Native <select> gives the
 * iOS wheel picker; minutes step by 5 (type="time" ignores step on iOS).
 */
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

  const selectCls =
    'appearance-none rounded-lg bg-surface2 px-2.5 py-1.5 text-center font-medium text-accent outline-none'

  return (
    <span className="flex items-center gap-1.5">
      <select
        aria-label="Hour"
        value={hour12}
        onChange={(e) => commit(Number(e.target.value), minute, isPM)}
        className={selectCls}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="font-semibold text-ink-dim">:</span>
      <select
        aria-label="Minutes"
        value={minute}
        onChange={(e) => commit(hour12, Number(e.target.value), isPM)}
        className={selectCls}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {pad(m)}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={isPM ? 'PM' : 'AM'}
        onChange={(e) => commit(hour12, minute, e.target.value === 'PM')}
        className={selectCls}
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </span>
  )
}
