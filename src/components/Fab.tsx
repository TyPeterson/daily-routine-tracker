import { Icon } from './Icon'

/** Floating action button, positioned above the bottom nav. */
export function Fab({ onClick, label = 'Add' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed right-5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform active:scale-90"
    >
      <Icon name="plus" size={26} strokeWidth={2.5} />
    </button>
  )
}
