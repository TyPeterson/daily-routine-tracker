import { useAppUpdate } from '../pwa/useAppUpdate'

/** Hazard-striped module that appears when a newer deploy is waiting. */
export function UpdateBanner() {
  const { needRefresh, applyUpdate } = useAppUpdate()
  if (!needRefresh) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-safe">
      <div className="module animate-drop-in pointer-events-auto mx-4 mt-2 flex items-stretch gap-3 overflow-hidden">
        <div className="stripes w-3 shrink-0" />
        <span className="flex flex-1 items-center gap-2.5 py-3 text-[13px] font-bold">
          <span className="led led-on animate-led-blink shrink-0" />
          new version ready
        </span>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="key key-primary my-2 mr-2.5 rounded-[8px] px-3.5 text-[13px] font-bold"
        >
          update
        </button>
      </div>
    </div>
  )
}
