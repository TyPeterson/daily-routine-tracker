import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useKeyboardInset } from '../hooks/useVisualViewport'

/**
 * Bottom sheet modal, portaled to <body> so transformed/scrolling ancestors
 * can't break its fixed positioning. The container is h-glass (not inset-0):
 * in frozen standalone the iOS fixed-viewport bottom sits 62pt above the
 * real screen, so bottom-anchoring to it would float the sheet and leave an
 * undimmed band — the glass height carries it to the true bottom.
 *
 * Keyboard handling: the panel itself NEVER moves — no translating, no
 * resizing, no jumping chrome. A spacer inside the scroll body grows to the
 * keyboard's height so any control can scroll clear of it, and the focused
 * control is revealed with a normal internal scroll (see App's focus-reveal
 * listener). `tall` pins editor sheets to a fixed height so the form doesn't
 * reflow as the keyboard comes and goes.
 */
export function Sheet({
  onClose,
  title,
  tall = false,
  children,
}: {
  onClose: () => void
  title: string
  /** fixed near-full height — use for sheets with text/number entry */
  tall?: boolean
  children: ReactNode
}) {
  const keyboardInset = useKeyboardInset()

  // deliberately NO body overflow lock while open: with the document
  // intentionally overflowed in standalone, body{overflow:hidden} propagates
  // to the viewport and distorts it (the v1.4.1–v1.4.3 dead-band class).
  // Background scrolling is already stopped by the pan guard + the scroll
  // body's overscroll-contain.

  return createPortal(
    <div className="h-glass fixed inset-x-0 top-0 z-40">
      <div className="animate-fade-in absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className={`animate-sheet-up absolute inset-x-0 bottom-0 flex flex-col rounded-t-[14px] border-x-[1.5px] border-t-[1.5px] border-edge bg-canvas ${
          tall ? 'h-[92dvh]' : 'max-h-[92dvh]'
        }`}
      >
        <div className="mx-auto mt-2.5 h-[3px] w-10 shrink-0 rounded-sm bg-ink-dim/50" />
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="key flex h-8 w-8 items-center justify-center text-ink"
          >
            <Icon name="x" size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="pb-safe">
            <div className="pb-8">{children}</div>
          </div>
          {/* room to scroll controls above the keyboard; changing this height
              never moves anything already on screen */}
          <div style={{ height: keyboardInset }} aria-hidden />
        </div>
      </div>
    </div>,
    document.body,
  )
}
