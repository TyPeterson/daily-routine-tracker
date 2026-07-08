import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'sun', label: 'Today' },
  { to: '/calendar', icon: 'calendar', label: 'Calendar' },
  { to: '/goals', icon: 'target', label: 'Goals' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="shrink-0 border-t border-line bg-surface pb-safe">
      <div className="flex">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-semibold ${
                isActive ? 'text-accent' : 'text-ink-dim'
              }`
            }
          >
            <Icon name={tab.icon} size={23} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
