import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Wallet,
  Home as HomeIcon,
  ShoppingCart,
  CalendarDays,
  HeartPulse,
  CreditCard,
  AlertTriangle,
  Check,
  Dumbbell,
} from 'lucide-react'
import { useStore } from '../../store'
import { Card, Button } from '../../components/ui'
import { todayISO } from '../../lib/id'
import { convert, formatMoney } from '../../services/nbrb'

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const data = useStore((s) => s.data)
  const rates = useStore((s) => s.rates)
  const base = data.settings.baseCurrency
  const today = todayISO()
  const monthPrefix = today.slice(0, 7)

  const toBase = (amount: number, currency: typeof base) =>
    rates ? convert(amount, currency, base, rates) : currency === base ? amount : 0

  // ---- деньги за месяц ----
  const money = useMemo(() => {
    let income = 0
    let spending = 0
    for (const e of data.expenses) {
      if (!e.date.startsWith(monthPrefix)) continue
      const v = toBase(e.amount, e.currency)
      if (e.type === 'income') income += v
      else spending += v
    }
    return { income, spending, balance: income - spending }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, rates, base, monthPrefix])

  // ---- напоминания ----
  const overdueTasks = data.homeTasks.filter((x) => !x.done && x.dueDate && x.dueDate < today)
  const dueTodayTasks = data.homeTasks.filter((x) => !x.done && x.dueDate === today)
  const calendarToday = data.calendarTasks.filter((x) => x.date === today && !x.done)
  const reminders = [...overdueTasks, ...dueTodayTasks]

  // ---- тренировка ----
  const workoutDoneToday = data.workoutLog.some((w) => w.date === today)

  // ---- уведомления (Notification API) ----
  const canNotify = typeof window !== 'undefined' && 'Notification' in window
  const totalDue = reminders.length + calendarToday.length

  useEffect(() => {
    if (!canNotify || Notification.permission !== 'granted' || totalDue === 0) return
    const key = 'planner.notifiedDate'
    if (localStorage.getItem(key) === today) return
    localStorage.setItem(key, today)
    try {
      new Notification(t('app.title'), {
        body: `${t('dashboard.reminders')}: ${totalDue}`,
      })
    } catch {
      /* ignore */
    }
  }, [canNotify, totalDue, today, t])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6) return t('dashboard.night')
    if (h < 12) return t('dashboard.morning')
    if (h < 18) return t('dashboard.day')
    return t('dashboard.evening')
  })()

  const links = [
    { to: '/expenses', icon: <Wallet size={20} />, key: 'expenses' },
    { to: '/home', icon: <HomeIcon size={20} />, key: 'home' },
    { to: '/shopping', icon: <ShoppingCart size={20} />, key: 'shopping' },
    { to: '/calendar', icon: <CalendarDays size={20} />, key: 'calendar' },
    { to: '/health', icon: <HeartPulse size={20} />, key: 'health' },
    { to: '/cards', icon: <CreditCard size={20} />, key: 'cards' },
  ]

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{greeting} 👋</h1>
      <p className="mb-5 text-sm text-[var(--text-2)]">{new Date().toLocaleDateString()}</p>

      {/* Напоминания */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Bell size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.reminders')}
          </h2>
          {canNotify && Notification.permission === 'default' && (
            <button
              onClick={() => Notification.requestPermission()}
              className="text-xs font-medium text-[var(--accent)]"
            >
              {t('dashboard.enableReminders')}
            </button>
          )}
        </div>
        {totalDue === 0 ? (
          <p className="text-sm text-[var(--text-3)]">{t('dashboard.noReminders')}</p>
        ) : (
          <ul className="space-y-1.5">
            {overdueTasks.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                <span className="flex-1 truncate">{x.title}</span>
                <span className="text-xs" style={{ color: 'var(--danger)' }}>{t('dashboard.overdue')}</span>
              </li>
            ))}
            {dueTodayTasks.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <Bell size={14} style={{ color: 'var(--warning)' }} />
                <span className="flex-1 truncate">{x.title}</span>
                <span className="text-xs text-[var(--text-3)]">{t('dashboard.dueToday')}</span>
              </li>
            ))}
            {calendarToday.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <CalendarDays size={14} style={{ color: 'var(--accent)' }} />
                <span className="flex-1 truncate">{x.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Деньги за месяц */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">{t('dashboard.month')}</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-[var(--text-3)]">{t('dashboard.income')}</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              {formatMoney(money.income, base)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-3)]">{t('dashboard.spending')}</div>
            <div className="mt-0.5 text-sm font-semibold">{formatMoney(money.spending, base)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-3)]">{t('dashboard.balance')}</div>
            <div
              className="mt-0.5 text-sm font-semibold"
              style={{ color: money.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {formatMoney(money.balance, base)}
            </div>
          </div>
        </div>
      </Card>

      {/* Тренировка на сегодня */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Dumbbell size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.workoutToday')}
          </h2>
          {workoutDoneToday ? (
            <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--success)' }}>
              <Check size={15} /> {t('dashboard.workoutDone')}
            </span>
          ) : (
            <Button variant="subtle" onClick={() => navigate('/health')}>
              {t('dashboard.open')}
            </Button>
          )}
        </div>
      </Card>

      {/* Быстрые разделы */}
      <h2 className="mb-2 text-sm font-semibold text-[var(--text-2)]">{t('dashboard.quick')}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {links.map((l) => (
          <button
            key={l.key}
            onClick={() => navigate(l.to)}
            className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors hover:bg-[var(--bg-3)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <span style={{ color: 'var(--accent)' }}>{l.icon}</span>
            {t(`nav.${l.key}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
