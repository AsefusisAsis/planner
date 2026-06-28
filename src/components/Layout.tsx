import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wallet, Home, ShoppingCart, CalendarDays, HeartPulse, CreditCard, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { SyncBadge } from './SyncBadge'

interface NavItem {
  to: string
  icon: ReactNode
  key: string
}

const items: NavItem[] = [
  { to: '/', icon: <Wallet size={20} />, key: 'expenses' },
  { to: '/home', icon: <Home size={20} />, key: 'home' },
  { to: '/shopping', icon: <ShoppingCart size={20} />, key: 'shopping' },
  { to: '/calendar', icon: <CalendarDays size={20} />, key: 'calendar' },
  { to: '/health', icon: <HeartPulse size={20} />, key: 'health' },
  { to: '/cards', icon: <CreditCard size={20} />, key: 'cards' },
  { to: '/settings', icon: <Settings size={20} />, key: 'settings' },
]

export function Layout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh">
      {/* Sidebar (desktop) */}
      <aside
        className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r p-3 sm:flex"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
      >
        <div className="mb-4 flex items-center justify-between px-2 pt-1">
          <span className="text-lg font-semibold tracking-tight">{t('app.title')}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <NavLink
              key={it.key}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)]'
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: 'var(--bg-3)' } : undefined
              }
            >
              {it.icon}
              {t(`nav.${it.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="px-2">
          <SyncBadge />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 sm:hidden"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <span className="text-base font-semibold">{t('app.title')}</span>
          <SyncBadge />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-24 sm:p-6 sm:pb-6">
          <Outlet />
        </main>

        {/* Bottom nav (mobile) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t sm:hidden"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
        >
          {items.map((it) => (
            <NavLink
              key={it.key}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[9px] font-medium transition-colors ${
                  isActive ? '' : 'text-[var(--text-3)]'
                }`
              }
              style={({ isActive }) => (isActive ? { color: 'var(--accent)' } : undefined)}
            >
              {it.icon}
              {t(`nav.${it.key}`)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
