import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { DialogHost } from './components/Dialog'
import { UpdateBanner } from './components/UpdateBanner'
import { pinViewportListener } from './hooks/useVisualViewport'
import { useSwipeNav } from './hooks/useSwipe'
import { startCalendarAutoSync } from './features/settings/calendarSync'
import TodayView from './features/today/TodayView'
import CalendarView from './features/calendar/CalendarView'
import GoalsList from './features/goals/GoalsList'
import GoalDetail from './features/goals/GoalDetail'
import SettingsView from './features/settings/SettingsView'

const TAB_PATHS = ['/', '/calendar', '/goals', '/settings']

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  // horizontal swipes anywhere page between tabs (edges are no-ops)
  const tabIndex =
    location.pathname === '/'
      ? 0
      : location.pathname.startsWith('/calendar')
        ? 1
        : location.pathname.startsWith('/goals')
          ? 2
          : 3
  const tabSwipe = useSwipeNav(
    () => {
      if (tabIndex > 0) navigate(TAB_PATHS[tabIndex - 1]!)
    },
    () => {
      if (tabIndex < TAB_PATHS.length - 1) navigate(TAB_PATHS[tabIndex + 1]!)
    },
  )

  useEffect(() => {
    // ask the browser not to evict IndexedDB under storage pressure
    void navigator.storage?.persist?.().catch(() => {})
    // keep the layout pinned when the iOS keyboard tries to pan the page
    const unpin = pinViewportListener()
    // reveal whatever gets focused with a calm internal scroll once the
    // keyboard has settled, instead of letting the page jump around
    const reveal = (e: FocusEvent) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return
      window.setTimeout(() => {
        if (document.activeElement === el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }, 350)
    }
    document.addEventListener('focusin', reveal)
    // keep the subscribed calendar feed fresh while the app is open
    const stopCalendarSync = startCalendarAutoSync()
    return () => {
      unpin()
      document.removeEventListener('focusin', reveal)
      stopCalendarSync()
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* frosted strip so content scrolling under the status bar stays legible */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-canvas/70 backdrop-blur-md" />
      <UpdateBanner />
      <DialogHost />
      <main {...tabSwipe} className="min-h-0 flex-1">
        {/* keyed by path so each screen breathes in on navigation */}
        <div key={location.pathname} className="animate-screen-in h-full">
          <Routes>
            <Route path="/" element={<TodayView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/goals" element={<GoalsList />} />
            <Route path="/goals/:goalId" element={<GoalDetail />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
