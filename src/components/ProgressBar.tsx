export function ProgressBar({ percent, className }: { percent: number | null; className?: string }) {
  const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent))
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-surface2 ${className ?? ''}`}>
      {percent != null && (
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            clamped >= 100 ? 'bg-good' : 'bg-accent'
          }`}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  )
}
