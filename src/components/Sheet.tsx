import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Bottom sheet modal, portaled to <body> so transformed/scrolling ancestors
 * can't break its fixed positioning.
 */
export function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="animate-fade-in absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-canvas shadow-2xl">
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-ink-dim/40" />
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <h2 className="text-[19px] font-bold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full bg-surface2 p-1.5 text-ink-dim"
          >
            <Icon name="x" size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="pb-safe">
            <div className="pb-8">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
