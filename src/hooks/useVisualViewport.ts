import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  const vv = window.visualViewport
  if (!vv) return () => {}
  vv.addEventListener('resize', onChange)
  vv.addEventListener('scroll', onChange)
  return () => {
    vv.removeEventListener('resize', onChange)
    vv.removeEventListener('scroll', onChange)
  }
}

/**
 * Height of the *visible* viewport — shrinks when the iOS keyboard opens
 * (the layout viewport does not). Lets sheets fit above the keyboard.
 */
export function useVisualViewportHeight(): number {
  return useSyncExternalStore(subscribe, () =>
    Math.round(window.visualViewport?.height ?? window.innerHeight),
  )
}

/**
 * How much of the app shell the iOS keyboard covers. Measured against the
 * shell (#root, sized to the real glass via --glass-h), NOT innerHeight: in
 * frozen standalone the layout viewport is 62pt shorter than the glass, so
 * innerHeight − vvHeight under-reports the keyboard by that much. Everywhere
 * else rootH === innerHeight and this is identical to the old formula.
 */
export function useKeyboardInset(): number {
  const vvH = useVisualViewportHeight()
  const glassH = document.getElementById('root')?.clientHeight ?? window.innerHeight
  return Math.max(0, glassH - vvH)
}

/**
 * iOS pans the whole page to reveal a focused input, shoving the top of the
 * UI off-screen. Undo that pan whenever it happens — inner scroll containers
 * still scroll the input into view on their own.
 */
export function pinViewportListener(): () => void {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const pin = () => {
    if (window.scrollY !== 0) window.scrollTo(0, 0)
    const doc = document.documentElement
    if (doc.scrollTop !== 0) doc.scrollTop = 0
  }
  vv.addEventListener('resize', pin)
  vv.addEventListener('scroll', pin)
  window.addEventListener('scroll', pin)
  return () => {
    vv.removeEventListener('resize', pin)
    vv.removeEventListener('scroll', pin)
    window.removeEventListener('scroll', pin)
  }
}
