import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Floating action key, positioned above the bottom nav. Portaled to <body>
 * like the sheets: the screen-in animation transforms each screen's wrapper,
 * and a transformed ancestor becomes the containing block for position:fixed
 * — which made the key render high and snap down after every tab swipe.
 */
export function Fab({ onClick, label = 'Add' }: { onClick: () => void; label?: string }) {
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="key key-primary fixed right-5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center !rounded-full"
    >
      <Icon name="plus" size={24} strokeWidth={2.5} />
    </button>,
    document.body,
  )
}
