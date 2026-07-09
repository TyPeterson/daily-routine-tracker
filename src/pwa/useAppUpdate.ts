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

  /**
   * Activate the waiting worker and reload. Deliberately does not trust the
   * library's own reload: when the update was found before this page loaded
   * (the normal case on iOS — app reopened after a deploy), workbox-window
   * treats the waiting worker as "external" and never reloads, leaving the
   * banner dead. So: tell the waiting worker to skip waiting directly, reload
   * the moment it takes control, and reload on a timer as a last resort.
   */
  const applyUpdate = async () => {
    let reloaded = false
    const reload = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true })
    try {
      const reg = registration ?? (await navigator.serviceWorker?.getRegistration())
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      await updateServiceWorker(true)
    } catch {
      // fall through to the timer
    }
    window.setTimeout(reload, 1500)
  }

  return { needRefresh, applyUpdate }
}
