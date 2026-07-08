import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { UpdateBanner } from './components/UpdateBanner'
import TodayView from './features/today/TodayView'
import CalendarView from './features/calendar/CalendarView'
import GoalsList from './features/goals/GoalsList'
import GoalDetail from './features/goals/GoalDetail'
import SettingsView from './features/settings/SettingsView'

export default function App() {
  useEffect(() => {
    // ask the browser not to evict IndexedDB under storage pressure
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  return (
    <div className="flex h-full flex-col pt-safe">
      <UpdateBanner />
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
