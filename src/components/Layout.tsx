import { useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Wallet,
  Home,
  ShoppingCart,
  CalendarDays,
  HeartPulse,
  CreditCard,
  Settings,
  MoreHorizontal,
  Search,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { SyncBadge } from './SyncBadge'
import { SearchModal } from './SearchModal'
import { useKeyboardOpen } from './ui'
import { tap } from '../lib/haptics'
import { useBackCloser } from '../lib/backclose'
import { useFocusTrap } from '../lib/focusTrap'

interface NavItem {
  to: string
  icon: ReactNode
  key: string
}

const items: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={20} />, key: 'dashboard' },
  { to: '/expenses', icon: <Wallet size={20} />, key: 'expenses' },
  { to: '/home', icon: <Home size={20} />, key: 'home' },
  { to: '/shopping', icon: <ShoppingCart size={20} />, key: 'shopping' },
  { to: '/calendar', icon: <CalendarDays size={20} />, key: 'calendar' },
  { to: '/health', icon: <HeartPulse size={20} />, key: 'health' },
  { to: '/cards', icon: <CreditCard size={20} />, key: 'cards' },
  { to: '/settings', icon: <Settings size={20} />, key: 'settings' },
]

// что показываем в нижней панели на телефоне (остальное — в «Ещё»)
const PRIMARY = ['dashboard', 'expenses', 'home', 'health']
const primaryItems = PRIMARY.map((k) => items.find((i) => i.key === k)!)
const moreItems = items.filter((i) => !PRIMARY.includes(i.key))

// (хук клавиатуры перенесён в components/ui — им пользуется и FAB)

export function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState(false)
  const [more, setMore] = useState(false)
  const keyboardOpen = useKeyboardOpen()
  const moreRef = useRef<HTMLDivElement>(null)
  const moreTitleId = useId()
  // системная «назад» закрывает лист «Ещё» (модалка поиска регистрируется сама)
  useBackCloser(more, () => setMore(false))
  useFocusTrap(more, moreRef)

  // активный вид задаётся в index.css (.navd.on) по характеру темы
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `navd flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'on' : 'text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)]'
    }`

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
        <button
          onClick={() => setSearch(true)}
          className="mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-[var(--text-3)] transition-colors hover:bg-[var(--bg-3)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <Search size={16} /> {t('common.search')}
        </button>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <NavLink key={it.key} to={it.to} end={it.to === '/'} className={navClass}>
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearch(true)}
              className="flex min-h-11 min-w-11 items-center justify-center text-[var(--text-2)]"
              aria-label={t('common.search')}
            >
              <Search size={18} />
            </button>
            <SyncBadge />
          </div>
        </header>

        {/* pb-36 (144px) на мобильном: нижняя навигация (~64) + FAB (80+56=136)
            не должны перекрывать последнюю строку контента */}
        <main key={location.pathname} className="page-in mx-auto w-full max-w-5xl flex-1 p-4 pb-36 sm:p-6 sm:pb-6">
          <Outlet />
        </main>

        {/* Bottom nav (mobile); при открытой клавиатуре прячем */}
        <nav
          className={`fixed inset-x-0 bottom-0 z-30 grid-cols-5 border-t sm:hidden ${
            keyboardOpen ? 'hidden' : 'grid'
          }`}
          style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
        >
          {primaryItems.map((it) => (
            <NavLink
              key={it.key}
              to={it.to}
              end={it.to === '/'}
              onClick={() => tap()}
              // активный вид (цвет/подушка/чернильная полоса) — в index.css (.navm.on) по характеру
              className={({ isActive }) =>
                `navm flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'on' : 'text-[var(--text-3)]'
                }`
              }
            >
              <span className="navm__ic flex h-7 w-14 items-center justify-center rounded-full transition-colors">
                {it.icon}
              </span>
              {t(`nav.${it.key}`)}
            </NavLink>
          ))}
          <button
            onClick={() => {
              tap()
              setMore(true)
            }}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-[var(--text-3)]"
          >
            <span className="flex h-7 w-14 items-center justify-center">
              <MoreHorizontal size={20} />
            </span>
            {t('nav.more')}
          </button>
        </nav>

        {/* «Ещё» — нижний лист (mobile) */}
        {more && (
          <div className="fixed inset-0 z-40 flex items-end bg-black/50 sm:hidden" onClick={() => setMore(false)}>
            <div
              ref={moreRef}
              data-sheet
              role="dialog"
              aria-modal="true"
              aria-labelledby={moreTitleId}
              tabIndex={-1}
              className="w-full rounded-t-2xl border-t p-4 pb-8 outline-none"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span id={moreTitleId} className="text-sm font-semibold">
                  {t('nav.more')}
                </span>
                <button
                  onClick={() => setMore(false)}
                  aria-label={t('common.close')}
                  className="-my-2 -mr-2 flex min-h-11 min-w-11 items-center justify-center text-[var(--text-3)]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {moreItems.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => {
                      setMore(false)
                      navigate(it.to)
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-medium text-[var(--text-2)]"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{it.icon}</span>
                    {t(`nav.${it.key}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <SearchModal open={search} onClose={() => setSearch(false)} />
    </div>
  )
}
