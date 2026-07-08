import { Icon, type IconName } from './Icon'

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink-dim">
        <Icon name={icon} size={28} />
      </div>
      <p className="text-[16px] font-semibold">{title}</p>
      {hint && <p className="mt-1 text-[14px] text-ink-dim">{hint}</p>}
    </div>
  )
}
