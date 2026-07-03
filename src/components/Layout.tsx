import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
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

// поля, вызывающие экранную клавиатуру
const KEYBOARD_INPUTS = new Set([
  'text', 'number', 'search', 'email', 'tel', 'url', 'password',
  'date', 'time', 'datetime-local', 'month', 'week',
])
function summonsKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') return KEYBOARD_INPUTS.has((el as HTMLInputElement).type)
  return false
}

/** Фокус в текстовом поле (открыта клавиатура) — на телефоне прячем нижнюю
 *  навигацию, иначе она всплывает над клавиатурой посреди экрана. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onIn = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      if (timer) clearTimeout(timer)
      setOpen(true)
    }
    const onOut = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      // задержка, чтобы переход фокуса между полями не дёргал панель
      timer = setTimeout(() => setOpen(false), 150)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      if (timer) clearTimeout(timer)
    }
  }, [])
  return open
}

export function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState(false)
  const [more, setMore] = useState(false)
  const keyboardOpen = useKeyboardOpen()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'text-[var(--text)]' : 'text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)]'
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
            <NavLink
              key={it.key}
              to={it.to}
              end={it.to === '/'}
              className={navClass}
              style={({ isActive }) => (isActive ? { background: 'var(--bg-3)' } : undefined)}
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
          <div className="flex items-center gap-1">
            <button onClick={() => setSearch(true)} className="p-1 text-[var(--text-2)]" aria-label={t('common.search')}>
              <Search size={18} />
            </button>
            <SyncBadge />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 sm:p-6 sm:pb-6">
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
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  isActive ? '' : 'text-[var(--text-3)]'
                }`
              }
              style={({ isActive }) => (isActive ? { color: 'var(--accent)' } : undefined)}
            >
              {it.icon}
              {t(`nav.${it.key}`)}
            </NavLink>
          ))}
          <button
            onClick={() => setMore(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-[var(--text-3)]"
          >
            <MoreHorizontal size={20} />
            {t('nav.more')}
          </button>
        </nav>

        {/* «Ещё» — нижний лист (mobile) */}
        {more && (
          <div className="fixed inset-0 z-40 flex items-end bg-black/50 sm:hidden" onClick={() => setMore(false)}>
            <div
              className="w-full rounded-t-2xl border-t p-4 pb-8"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">{t('nav.more')}</span>
                <button onClick={() => setMore(false)} className="text-[var(--text-3)]">
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
