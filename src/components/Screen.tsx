import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { PullToRefresh } from './PullToRefresh'
import { checkForUpdates } from '../pwa/useAppUpdate'

/** Standard page: silkscreen header + pull-to-refresh scroll body. */
export function Screen({
  title,
  subtitle,
  right,
  onBack,
  backLabel,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  onBack?: () => void
  backLabel?: string
  children: ReactNode
}) {
  return (
    <PullToRefresh onRefresh={checkForUpdates} className="h-full">
      {/* header sits below the status bar; content scrolls edge-to-edge under it */}
      <header className="pt-safe px-5 pb-3">
        <div className="pt-3" />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-1.5 flex items-center gap-1 text-[13px] font-bold text-accent"
          >
            <Icon name="chevron-left" size={15} strokeWidth={2.5} />
            {backLabel ?? 'back'}
          </button>
        )}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[11px] font-bold tracking-[0.14em] text-ink-dim uppercase">
                {subtitle}
              </p>
            )}
            <h1 className="truncate text-[27px] leading-tight font-bold tracking-tight">
              {title}
            </h1>
          </div>
          {right && <div className="flex shrink-0 items-center gap-2 pb-1">{right}</div>}
        </div>
      </header>
      <div className="px-4 pb-28">{children}</div>
    </PullToRefresh>
  )
}
