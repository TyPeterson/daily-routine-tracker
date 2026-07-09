export type ThemePref = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'routine-theme'
const CHASSIS = { light: '#e9e7e0', dark: '#131313' }

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

/**
 * Force light/dark or follow the system. Works by stamping data-theme on the
 * root element (the CSS token blocks key off it) and keeping the status-bar
 * theme-color metas in step.
 */
export function applyThemePref(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref)
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const mediaDark = m.media.includes('dark')
    m.content = pref === 'system' ? CHASSIS[mediaDark ? 'dark' : 'light'] : CHASSIS[pref]
  })

  // charts resolve token colors imperatively — tell them to re-read
  window.dispatchEvent(new Event('themechange'))
}

export function initTheme(): void {
  applyThemePref(getThemePref())
}
