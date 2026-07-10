import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Floating action key, positioned above the bottom nav. Portaled into #root
 * (position: relative, sized to the real glass via --glass-h) and anchored
 * absolute: the iOS fixed-viewport bottom sits 62pt above the true screen in
 * frozen standalone, so position:fixed would float the key. As a direct
 * child of #root it also stays outside the animated route wrapper, so the
 * screen-in transform can never hijack its containing block (the old
 * jump-during-tab-swipes bug).
 */
export function Fab({ onClick, label = 'Add' }: { onClick: () => void; label?: string }) {
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="key key-primary absolute right-5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center !rounded-full"
    >
      <Icon name="plus" size={24} strokeWidth={2.5} />
    </button>,
    document.getElementById('root')!,
  )
}
