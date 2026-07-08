import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  // token values only change when the system theme flips
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
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
