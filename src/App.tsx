import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { DialogHost } from './components/Dialog'
import { UpdateBanner } from './components/UpdateBanner'
import { pinViewportListener } from './hooks/useVisualViewport'
import TodayView from './features/today/TodayView'
import CalendarView from './features/calendar/CalendarView'
import GoalsList from './features/goals/GoalsList'
import GoalDetail from './features/goals/GoalDetail'
import SettingsView from './features/settings/SettingsView'

export default function App() {
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
    return () => {
      unpin()
      document.removeEventListener('focusin', reveal)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* frosted strip so content scrolling under the status bar stays legible */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-canvas/70 backdrop-blur-md" />
      <UpdateBanner />
      <DialogHost />
      <main className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<TodayView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/goals" element={<GoalsList />} />
          <Route path="/goals/:goalId" element={<GoalDetail />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
