import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'sun', label: 'today' },
  { to: '/calendar', icon: 'calendar', label: 'calendar' },
  { to: '/goals', icon: 'target', label: 'goals' },
  { to: '/settings', icon: 'settings', label: 'settings' },
]

export function BottomNav() {
  return (
    <nav className="shrink-0 border-t-[1.5px] border-edge bg-surface pb-safe">
      <div className="flex">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 pt-2 pb-2 text-[10px] font-semibold tracking-[0.06em] ${
                isActive ? 'text-ink' : 'text-ink-dim'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`led ${isActive ? 'led-on' : ''}`} />
                <Icon name={tab.icon} size={21} />
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
