import { useEffect, useMemo, useState } from 'react'
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
  Settings2,
  Plus,
  ArrowUp,
  ArrowDown,
  Droplet,
} from 'lucide-react'
import { useStore } from '../../store'
import { Card, Button, Modal, IconButton } from '../../components/ui'
import { todayISO } from '../../lib/id'
import { convert, formatMoney } from '../../services/nbrb'
import { ALL_WIDGETS, type Currency, type WidgetId } from '../../types'
import { computeHealth } from '../health/calc'
import { gradientCss, digitsOf } from '../cards/brand'

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US'

  const data = useStore((s) => s.data)
  const rates = useStore((s) => s.rates)
  const base = data.settings.baseCurrency
  const addExpense = useStore((s) => s.addExpense)
  const addHomeTask = useStore((s) => s.addHomeTask)
  const toggleHomeTask = useStore((s) => s.toggleHomeTask)
  const addWater = useStore((s) => s.addWater)
  const setDashboardWidgets = useStore((s) => s.setDashboardWidgets)

  const today = todayISO()
  const monthPrefix = today.slice(0, 7)

  // ---- живые часы ----
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const dateStr = now.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString(locale, { hour12: false })
  const tzShort =
    new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value ?? ''

  const toBase = (amount: number, currency: Currency) =>
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
  const reminderLines = [
    ...overdueTasks.map((x) => `⏰ ${x.title} — ${t('dashboard.overdue')}`),
    ...dueTodayTasks.map((x) => `• ${x.title}`),
    ...calendarToday.map((x) => (x.time ? `${x.time} — ${x.title}` : `• ${x.title}`)),
  ]
  const totalDue = overdueTasks.length + dueTodayTasks.length + calendarToday.length

  // ---- уведомления ----
  const canNotify = typeof window !== 'undefined' && 'Notification' in window
  useEffect(() => {
    if (!canNotify || Notification.permission !== 'granted' || totalDue === 0) return
    const sig = `${today}|${reminderLines.join('|')}`
    if (localStorage.getItem('planner.notifiedSig') === sig) return
    localStorage.setItem('planner.notifiedSig', sig)
    const shown = reminderLines.slice(0, 5)
    const extra = reminderLines.length - shown.length
    const body = shown.join('\n') + (extra > 0 ? `\n${t('dashboard.moreItems', { count: extra })}` : '')
    try {
      new Notification(`🔔 ${t('dashboard.remindersNotifTitle')}`, { body, tag: 'planner-reminders' })
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNotify, totalDue, today])

  // ---- здоровье/вода ----
  const profile = data.healthProfile
  const waterGoal = profile ? computeHealth(profile).waterMl : null
  const waterToday = data.waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0)
  const workoutDoneToday = data.workoutLog.some((w) => w.date === today)
  const waterLow = waterGoal != null && waterToday < waterGoal && now.getHours() >= 17

  // ---- «требует внимания»: бюджеты + ближайший платёж ----
  const budgetAlerts = useMemo(() => {
    const spend = new Map<string, number>()
    for (const e of data.expenses) {
      if (e.type === 'income' || !e.categoryId || !e.date.startsWith(monthPrefix)) continue
      spend.set(e.categoryId, (spend.get(e.categoryId) ?? 0) + toBase(e.amount, e.currency))
    }
    return data.expenseCategories
      .filter((c) => c.budget && (spend.get(c.id) ?? 0) > c.budget)
      .map((c) => ({ name: c.name, spent: spend.get(c.id) ?? 0, budget: c.budget as number }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, data.expenseCategories, rates, base, monthPrefix])

  const dayOfMonth = Number(today.slice(8, 10))
  const nextRecurring = useMemo(
    () =>
      [...data.recurringExpenses]
        .filter((r) => r.dayOfMonth >= dayOfMonth)
        .sort((a, b) => a.dayOfMonth - b.dayOfMonth)[0] ?? null,
    [data.recurringExpenses, dayOfMonth],
  )

  const attentionCount =
    overdueTasks.length +
    dueTodayTasks.length +
    calendarToday.length +
    budgetAlerts.length +
    (nextRecurring ? 1 : 0) +
    (waterLow ? 1 : 0)

  const greeting = (() => {
    const h = now.getHours()
    if (h < 6) return t('dashboard.night')
    if (h < 12) return t('dashboard.morning')
    if (h < 18) return t('dashboard.day')
    return t('dashboard.evening')
  })()

  // ---- быстрый ввод финансов ----
  const [qaType, setQaType] = useState<'expense' | 'income'>('expense')
  const [qaAmount, setQaAmount] = useState('')
  const [qaCur, setQaCur] = useState<Currency>(base)
  function quickAddMoney() {
    const a = Number(qaAmount)
    if (!Number.isFinite(a) || a <= 0) return
    addExpense({ amount: a, currency: qaCur, categoryId: null, note: '', date: today, type: qaType })
    setQaAmount('')
  }

  // ---- быстрый ввод задачи ----
  const [qaTask, setQaTask] = useState('')
  function quickAddTask() {
    const tt = qaTask.trim()
    if (!tt) return
    addHomeTask({ title: tt, priority: 'medium', recurrence: 'none' })
    setQaTask('')
  }
  const activeTasks = useMemo(() => {
    const rank = (x: (typeof data.homeTasks)[number]) =>
      x.dueDate && x.dueDate < today ? 0 : x.dueDate === today ? 1 : 2
    return data.homeTasks.filter((x) => !x.done).sort((a, b) => rank(a) - rank(b))
  }, [data.homeTasks, today])

  // ---- виджеты ----
  const widgets = data.dashboardWidgets.filter((w) =>
    (ALL_WIDGETS as readonly string[]).includes(w),
  ) as WidgetId[]
  const [manageOpen, setManageOpen] = useState(false)
  function toggleWidget(id: WidgetId) {
    setDashboardWidgets(widgets.includes(id) ? widgets.filter((x) => x !== id) : [...widgets, id])
  }
  function moveWidget(id: WidgetId, dir: -1 | 1) {
    const i = widgets.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    setDashboardWidgets(next)
  }
  const widgetName: Record<WidgetId, string> = {
    reminders: t('dashboard.wReminders'),
    finance: t('dashboard.wFinance'),
    cards: t('dashboard.wCards'),
    tasks: t('dashboard.wTasks'),
    calendar: t('dashboard.wCalendar'),
    water: t('dashboard.wWater'),
    workout: t('dashboard.wWorkout'),
  }

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'reminders':
        return (
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Bell size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.attention')}
              </h2>
              {canNotify && Notification.permission === 'default' && (
                <button onClick={() => Notification.requestPermission()} className="text-xs font-medium text-[var(--accent)]">
                  {t('dashboard.enableReminders')}
                </button>
              )}
            </div>
            {attentionCount === 0 ? (
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
                {budgetAlerts.map((b) => (
                  <li key={`b-${b.name}`} className="flex items-center gap-2 text-sm">
                    <Wallet size={14} style={{ color: 'var(--danger)' }} />
                    <span className="flex-1 truncate">{t('dashboard.budgetOver')}: {b.name}</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--danger)' }}>
                      {formatMoney(b.spent, base)} / {formatMoney(b.budget, base)}
                    </span>
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
                    {x.time && <span className="text-xs tabular-nums text-[var(--text-3)]">{x.time}</span>}
                    <span className="flex-1 truncate">{x.title}</span>
                  </li>
                ))}
                {nextRecurring && (
                  <li className="flex items-center gap-2 text-sm">
                    <Wallet size={14} style={{ color: 'var(--text-3)' }} />
                    <span className="flex-1 truncate">
                      {t('dashboard.recurringSoon', { day: nextRecurring.dayOfMonth })}: {nextRecurring.label}
                    </span>
                    <span className="text-xs tabular-nums text-[var(--text-3)]">
                      {formatMoney(nextRecurring.amount, nextRecurring.currency)}
                    </span>
                  </li>
                )}
                {waterLow && (
                  <li className="flex items-center gap-2 text-sm">
                    <Droplet size={14} style={{ color: 'var(--warning)' }} />
                    <span className="flex-1 truncate">{t('dashboard.waterLow')}</span>
                    <span className="text-xs tabular-nums text-[var(--text-3)]">
                      {waterToday} / {waterGoal} {t('health.waterMlUnit')}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </Card>
        )

      case 'finance':
        return (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Wallet size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.wFinance')}
              </h2>
              <span
                className="text-sm font-semibold"
                style={{ color: money.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {formatMoney(money.balance, base)}
              </span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('dashboard.income')}</div>
                <div className="font-semibold" style={{ color: 'var(--success)' }}>{formatMoney(money.income, base)}</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('dashboard.spending')}</div>
                <div className="font-semibold">{formatMoney(money.spending, base)}</div>
              </div>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1">
              {(['expense', 'income'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setQaType(tp)}
                  className="rounded-md py-1 text-xs font-medium transition-colors"
                  style={qaType === tp ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bg-3)', color: 'var(--text-2)' }}
                >
                  {tp === 'expense' ? t('expenses.typeExpense') : t('expenses.typeIncome')}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={qaAmount}
                onChange={(e) => setQaAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && quickAddMoney()}
                placeholder={t('dashboard.qaAmount')}
                className="min-w-0 flex-1"
              />
              <select value={qaCur} onChange={(e) => setQaCur(e.target.value as Currency)} className="w-20 shrink-0">
                {(['BYN', 'USD', 'EUR', 'RUB'] as Currency[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button onClick={quickAddMoney} disabled={!qaAmount} className="shrink-0">
                <Plus size={16} />
              </Button>
            </div>
          </Card>
        )

      case 'cards':
        return (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard size={16} style={{ color: 'var(--accent)' }} /> {t('nav.cards')}
              </h2>
              <button onClick={() => navigate('/cards')} className="text-xs font-medium text-[var(--accent)]">
                {t('dashboard.open')}
              </button>
            </div>
            {data.cards.length === 0 ? (
              <p className="text-sm text-[var(--text-3)]">{t('dashboard.noCards')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.cards.slice(0, 2).map((c) => {
                  const last4 = c.loyalty ? '' : c.enc ? c.last4 ?? '' : digitsOf(c.number).slice(-4)
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate('/cards')}
                      className="rounded-xl p-3 text-left text-white"
                      style={{ background: gradientCss(c.gradient), aspectRatio: '1.9 / 1' }}
                    >
                      <div className="truncate text-sm font-medium">{c.label}</div>
                      {!c.loyalty && (
                        <div className="mt-3 font-mono text-sm tracking-widest">•••• {last4}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        )

      case 'tasks':
        return (
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <HomeIcon size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.wTasks')}
            </h2>
            {activeTasks.length === 0 ? (
              <p className="mb-2 text-sm text-[var(--text-3)]">{t('dashboard.noTasksW')}</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {activeTasks.slice(0, 5).map((x) => {
                  const overdue = x.dueDate && x.dueDate < today
                  return (
                    <li key={x.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={x.done}
                        onChange={() => toggleHomeTask(x.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                      />
                      <span className="flex-1 truncate">{x.title}</span>
                      {overdue && <span className="text-xs" style={{ color: 'var(--danger)' }}>{t('dashboard.overdue')}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={qaTask}
                onChange={(e) => setQaTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && quickAddTask()}
                placeholder={t('dashboard.qaTask')}
                className="min-w-0 flex-1"
              />
              <Button onClick={quickAddTask} disabled={!qaTask.trim()} className="shrink-0">
                <Plus size={16} />
              </Button>
            </div>
          </Card>
        )

      case 'calendar':
        return (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.calendarToday')}
              </h2>
              <button onClick={() => navigate('/calendar')} className="text-xs font-medium text-[var(--accent)]">
                {t('dashboard.open')}
              </button>
            </div>
            {calendarToday.length === 0 ? (
              <p className="text-sm text-[var(--text-3)]">{t('dashboard.nothingToday')}</p>
            ) : (
              <ul className="space-y-1.5">
                {calendarToday.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 text-sm">
                    {x.time ? (
                      <span className="w-12 shrink-0 text-xs tabular-nums text-[var(--text-3)]">{x.time}</span>
                    ) : (
                      <span className="w-12 shrink-0 text-xs text-[var(--text-3)]">{t('calendar.allDay')}</span>
                    )}
                    <span className="flex-1 truncate">{x.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )

      case 'water':
        return (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Droplet size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.wWater')}
              </h2>
              <span className="text-sm font-semibold tabular-nums">
                {waterToday}
                {waterGoal != null && <span className="text-[var(--text-3)]"> / {waterGoal}</span>} {t('health.waterMlUnit')}
              </span>
            </div>
            {waterGoal != null && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (waterToday / waterGoal) * 100)}%`, background: 'var(--accent)' }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="subtle" className="flex-1" onClick={() => addWater(250)}>
                <Plus size={16} /> {t('health.waterAdd250')}
              </Button>
              <Button variant="subtle" className="flex-1" onClick={() => addWater(500)}>
                <Plus size={16} /> {t('health.waterAdd500')}
              </Button>
            </div>
          </Card>
        )

      case 'workout':
        return (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Dumbbell size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.workoutToday')}
              </h2>
              {workoutDoneToday ? (
                <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--success)' }}>
                  <Check size={15} /> {t('dashboard.workoutDone')}
                </span>
              ) : (
                <Button variant="subtle" onClick={() => navigate('/health')}>{t('dashboard.open')}</Button>
              )}
            </div>
          </Card>
        )
    }
  }

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
      {/* Шапка: приветствие + часы + курсы */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting} 👋</h1>
          <p className="mt-0.5 text-sm text-[var(--text-2)] tabular-nums">
            {dateStr} · {timeStr} · {tzShort}
          </p>
        </div>
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-3)]">{t('dashboard.ratesTitle')}</div>
          {rates ? (
            <div className="space-y-0.5 tabular-nums">
              <div className="flex justify-between gap-3"><span className="text-[var(--text-3)]">1 USD</span><span>{rates.bynPerUnit.USD?.toFixed(2)} Br</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-3)]">1 EUR</span><span>{rates.bynPerUnit.EUR?.toFixed(2)} Br</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--text-3)]">100 RUB</span><span>{((rates.bynPerUnit.RUB ?? 0) * 100).toFixed(2)} Br</span></div>
            </div>
          ) : (
            <div className="text-[var(--text-3)]">—</div>
          )}
        </div>
      </div>

      {/* Кнопка настройки виджетов */}
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" onClick={() => setManageOpen(true)}>
          <Settings2 size={16} /> {t('dashboard.manageWidgets')}
        </Button>
      </div>

      {/* Виджеты — кладка (masonry) через колонки: без дыр под короткими блоками */}
      <div className="columns-1 sm:columns-2" style={{ columnGap: '1rem' }}>
        {widgets.map((id) => (
          <div key={id} className="mb-4 break-inside-avoid">
            {renderWidget(id)}
          </div>
        ))}
      </div>

      {/* Быстрые разделы */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--text-2)]">{t('dashboard.quick')}</h2>
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

      {/* Настройка виджетов */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title={t('dashboard.manageTitle')}>
        <ul className="space-y-1.5">
          {ALL_WIDGETS.map((id) => {
            const enabled = widgets.includes(id)
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: 'var(--bg-2)' }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleWidget(id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                />
                <span className="flex-1 text-sm">{widgetName[id]}</span>
                {enabled && (
                  <span className="flex shrink-0">
                    <IconButton onClick={() => moveWidget(id, -1)} aria-label="up"><ArrowUp size={14} /></IconButton>
                    <IconButton onClick={() => moveWidget(id, 1)} aria-label="down"><ArrowDown size={14} /></IconButton>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Modal>
    </div>
  )
}
