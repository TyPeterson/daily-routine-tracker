import { useAppUpdate } from '../pwa/useAppUpdate'

/** Slim banner that appears when a newer deploy is waiting. */
export function UpdateBanner() {
  const { needRefresh, applyUpdate } = useAppUpdate()
  if (!needRefresh) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-safe">
      <div className="animate-drop-in pointer-events-auto mx-4 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3 text-white shadow-lg">
        <span className="text-[15px] font-medium">A new version is ready</span>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="rounded-full bg-white/25 px-3.5 py-1.5 text-[14px] font-semibold"
        >
          Update
        </button>
      </div>
    </div>
  )
}
