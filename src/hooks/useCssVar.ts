import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  // token values change when the system theme flips or settings force one
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  window.addEventListener('themechange', onChange)
  return () => {
    mq.removeEventListener('change', onChange)
    window.removeEventListener('themechange', onChange)
  }
}

/**
 * Resolved value of a CSS custom property (e.g. '--accent'). SVG presentation
 * attributes can't use var(), so charts need concrete color strings.
 */
export function useCssVar(name: string): string {
  return useSyncExternalStore(subscribe, () =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  )
}
