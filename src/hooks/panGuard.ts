/**
 * iOS moves the whole page when a touch drag has nothing else to scroll —
 * chained overscroll and rubber-banding visibly drag the app shell, bottom
 * nav included. Every CSS-level cure tried (overflow/overscroll/position on
 * html or body) distorts the standalone-PWA viewport and leaves a dead band
 * at the bottom of the screen (see the warning in index.css), so the pan is
 * cancelled at the source instead: any touchmove that no scrollable inner
 * container claims is preventDefault()ed before iOS can act on it.
 *
 * JS-owned gestures keep working — element listeners (pull-to-refresh,
 * wheels, swipe rows) fire before this document-level listener and still
 * receive every event; only the browser's native page pan dies.
 */
export function installPanGuard(): () => void {
  const scrollsAlong = (el: Element): boolean => {
    const style = getComputedStyle(el)
    const scrollableY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 1
    const scrollableX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 1
    return scrollableY || scrollableX
  }

  const onMove = (e: TouchEvent) => {
    if (e.defaultPrevented) return
    let el = e.target instanceof Element ? e.target : null
    // caret drags inside text fields are a native behavior worth keeping
    if (el?.closest('input, textarea')) return
    while (el && el !== document.documentElement) {
      if (scrollsAlong(el)) return
      el = el.parentElement
    }
    e.preventDefault()
  }

  document.addEventListener('touchmove', onMove, { passive: false })
  return () => document.removeEventListener('touchmove', onMove)
}
