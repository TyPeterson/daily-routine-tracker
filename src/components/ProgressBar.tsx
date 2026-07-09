export function ProgressBar({
  percent,
  color,
  className,
}: {
  percent: number | null
  /** custom fill color (e.g. the goal's color); done state still shows green */
  color?: string
  className?: string
}) {
  const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent))
  const done = clamped >= 100
  return (
    <div
      className={`h-[10px] overflow-hidden rounded-[4px] border border-edge/60 bg-surface2 ${className ?? ''}`}
    >
      {percent != null && (
        <div
          className={`h-full transition-[width] duration-300 ${
            done ? 'bg-good' : color ? '' : 'bg-accent'
          }`}
          style={{ width: `${clamped}%`, ...(color && !done ? { background: color } : {}) }}
        />
      )}
    </div>
  )
}
