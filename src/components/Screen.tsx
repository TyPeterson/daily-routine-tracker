import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { PullToRefresh } from './PullToRefresh'
import { checkForUpdates } from '../pwa/useAppUpdate'

/** Standard page: large title header + pull-to-refresh scroll body. */
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
            className="-ml-1.5 mb-1 flex items-center text-[15px] font-medium text-accent"
          >
            <Icon name="chevron-left" size={19} strokeWidth={2.5} />
            {backLabel ?? 'Back'}
          </button>
        )}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {subtitle && <p className="text-[13px] font-semibold text-ink-dim">{subtitle}</p>}
            <h1 className="truncate text-[28px] leading-tight font-bold">{title}</h1>
          </div>
          {right && <div className="flex shrink-0 items-center gap-1.5 pb-1">{right}</div>}
        </div>
      </header>
      <div className="px-4 pb-28">{children}</div>
    </PullToRefresh>
  )
}
