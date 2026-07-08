import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

let registration: ServiceWorkerRegistration | undefined

/** Ask the browser to re-fetch the service worker; a changed deploy flips needRefresh. */
export async function checkForUpdates(): Promise<void> {
  try {
    await registration?.update()
  } catch {
    // offline — nothing to do
  }
}

/**
 * Registers the service worker and keeps looking for new deploys. iOS keeps
 * home-screen apps suspended in memory for days, so besides the hourly timer
 * we re-check every time the app returns to the foreground.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration = reg
      if (!reg) return
      const checkIfVisible = () => {
        if (document.visibilityState === 'visible') void checkForUpdates()
      }
      setInterval(checkIfVisible, HOUR)
      document.addEventListener('visibilitychange', checkIfVisible)
    },
  })

  return { needRefresh, applyUpdate: () => updateServiceWorker(true) }
}
