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
import { Capacitor } from '@capacitor/core'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { Card, CollapsibleCard, Button, Modal, IconButton, Checkbox } from '../../components/ui'
import { MascotCard } from '../../components/Mascot'
import { PullToRefresh } from '../../components/PullToRefresh'
import { tap } from '../../lib/haptics'
import { todayISO } from '../../lib/id'
import { convert, formatMoney, rateOf, amountInBase } from '../../services/rates'
import { CURRENCY_SYMBOLS } from '../../types'
import { CurrencySelect } from '../../components/CurrencySelect'
import { describeWeather } from '../../services/weather'
import { getNotifPermission, requestNotifPermission, rescheduleNotifications, type NotifPermission } from '../../services/notifications'
import { ALL_WIDGETS, type Currency, type WidgetId } from '../../types'
import { computeHealth } from '../health/calc'
import { gradientCss, digitsOf } from '../cards/brand'

// две колонки виджетов начиная с sm (640px) — стабильное распределение
// вместо CSS columns, см. комментарий у раскладки
function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const on = () => setIs(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return is
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const vt = useVoice()
  const navigate = useNavigate()
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US'
  const isDesktop = useIsDesktop()

  const data = useStore((s) => s.data)
  const rates = useStore((s) => s.rates)
  const weather = useStore((s) => s.weather)
  const base = data.settings.baseCurrency
  // валюты тикера курсов: настроенные пользователем или дефолт, минус базовая
  const tickerCurrencies: Currency[] = (
    data.settings.displayCurrencies?.length
      ? data.settings.displayCurrencies
      : (['USD', 'EUR', 'RUB'] as Currency[])
  )
    .filter((c) => c !== base)
    .slice(0, 3)
  const addExpense = useStore((s) => s.addExpense)
  const addHomeTask = useStore((s) => s.addHomeTask)
  const toggleHomeTask = useStore((s) => s.toggleHomeTask)
  const addWater = useStore((s) => s.addWater)
  const setDashboardWidgets = useStore((s) => s.setDashboardWidgets)

  // ---- pull-to-refresh: синк + курсы + погода ----
  const account = useStore((s) => s.account)
  const syncConfigured = useStore((s) => s.sync.configured)
  const cloudSyncNow = useStore((s) => s.cloudSyncNow)
  const syncNow = useStore((s) => s.syncNow)
  const refreshRates = useStore((s) => s.refreshRates)
  const refreshWeather = useStore((s) => s.refreshWeather)
  async function handleRefresh() {
    tap() // отклик на жест (UI-действие, стор здесь не вибрирует)
    await Promise.all([
      account ? cloudSyncNow() : syncConfigured ? syncNow() : Promise.resolve(),
      refreshRates(true),
      refreshWeather(true),
    ])
  }

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

  // null — нет курса, запись неконвертируема: такие пропускаем в суммах, а не считаем как 0
  const toBase = (amount: number, currency: Currency): number | null =>
    rates ? convert(amount, currency, base, rates) : currency === base ? amount : null

  // ---- деньги за месяц (курс на момент траты, live-fallback) ----
  const money = useMemo(() => {
    let income = 0
    let spending = 0
    for (const e of data.expenses) {
      if (!e.date.startsWith(monthPrefix)) continue
      const v = amountInBase(e, base, rates)
      if (v == null) continue
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
    ...overdueTasks.map((x) => `⏰ ${x.title} — ${vt('dashboard.overdue')}`),
    ...dueTodayTasks.map((x) => `• ${x.title}`),
    ...calendarToday.map((x) => (x.time ? `${x.time} — ${x.title}` : `• ${x.title}`)),
  ]
  const totalDue = overdueTasks.length + dueTodayTasks.length + calendarToday.length

  // ---- уведомления ----
  // только веб: в нативном приложении напоминания идут через
  // @capacitor/local-notifications (services/notifications.ts), а веб-Notification
  // в Android WebView бесполезен — не показывается и зря просит разрешение
  const canNotify =
    typeof window !== 'undefined' && 'Notification' in window && !Capacitor.isNativePlatform()

  // единое состояние разрешения на напоминания для веба И натива: раньше кнопка
  // «Включить» показывалась только в вебе, на Android affordance не было вовсе
  const [notifPerm, setNotifPerm] = useState<NotifPermission>('unsupported')
  useEffect(() => {
    let alive = true
    void getNotifPermission().then((s) => alive && setNotifPerm(s))
    return () => {
      alive = false
    }
  }, [])
  // sig в зависимостях: содержимое может измениться при том же количестве.
  // Строим из сырых данных (не из локализованных строк) — смена языка не
  // должна повторно отправлять то же уведомление.
  const remindersSig = `${today}|${[
    ...overdueTasks.map((x) => `o:${x.id}:${x.title}`),
    ...dueTodayTasks.map((x) => `d:${x.id}:${x.title}`),
    ...calendarToday.map((x) => `c:${x.id}:${x.time ?? ''}:${x.title}`),
  ].join('|')}`
  useEffect(() => {
    if (!canNotify || Notification.permission !== 'granted' || totalDue === 0) return
    if (localStorage.getItem('planner.notifiedSig') === remindersSig) return
    localStorage.setItem('planner.notifiedSig', remindersSig)
    const shown = reminderLines.slice(0, 5)
    const extra = reminderLines.length - shown.length
    const body = shown.join('\n') + (extra > 0 ? `\n${t('dashboard.moreItems', { count: extra })}` : '')
    try {
      new Notification(`🔔 ${t('dashboard.remindersNotifTitle')}`, { body, tag: 'planner-reminders' })
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNotify, totalDue, today, remindersSig])

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
      const v = toBase(e.amount, e.currency)
      if (v == null) continue
      spend.set(e.categoryId, (spend.get(e.categoryId) ?? 0) + v)
    }
    // бюджет хранится в своей валюте (budgetCurrency) — сравниваем в базовой;
    // без курса сравнение невозможно — алерт не показываем
    return data.expenseCategories.flatMap((c) => {
      if (!c.budget) return []
      const budgetBase = toBase(c.budget, c.budgetCurrency ?? base)
      if (budgetBase == null) return []
      const spent = spend.get(c.id) ?? 0
      return spent > budgetBase ? [{ name: c.name, spent, budget: budgetBase }] : []
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, data.expenseCategories, rates, base, monthPrefix])

  const dayOfMonth = Number(today.slice(8, 10))
  // Циклический выбор: в ЭТОМ месяце кандидаты — ещё не применённые платежи с днём
  // впереди; если таких нет — самый ранний день из ВСЕХ платежей как платёж
  // следующего месяца (применённость этого месяца там уже не имеет значения)
  const nextRecurring = useMemo(() => {
    if (data.recurringExpenses.length === 0) return null
    const byDay = [...data.recurringExpenses].sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    const thisMonth = byDay.find(
      (r) => r.dayOfMonth >= dayOfMonth && r.lastAppliedMonth !== monthPrefix,
    )
    return thisMonth ? { rec: thisMonth, nextMonth: false } : { rec: byDay[0], nextMonth: true }
  }, [data.recurringExpenses, dayOfMonth, monthPrefix])

  const attentionCount =
    overdueTasks.length +
    dueTodayTasks.length +
    calendarToday.length +
    budgetAlerts.length +
    (nextRecurring ? 1 : 0) +
    (waterLow ? 1 : 0)

  const greeting = (() => {
    const h = now.getHours()
    // слово-приветствие звучит в тоне темы (у «Спокойной» — свои варианты)
    const base =
      h < 6 ? vt('dashboard.night') : h < 12 ? vt('dashboard.morning') : h < 18 ? vt('dashboard.day') : vt('dashboard.evening')
    const nm = data.settings.userName
    const g = nm ? `${base}, ${nm}` : base
    // тёплая — персонаж-солнце/месяц по времени суток (характер темы);
    // деловая и спокойная — без эмодзи
    if ((data.settings.palette ?? 'classic') !== 'warm') return g
    const glyph = h < 6 ? '🌙' : h < 12 ? '🌅' : h < 18 ? '☀️' : '🌇'
    return `${g} ${glyph}`
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
          <CollapsibleCard
            id="reminders"
            icon={<Bell size={16} style={{ color: 'var(--accent)' }} />}
            title={vt('dashboard.attention')}
            summary={
              attentionCount > 0 ? (
                <span className="tnum text-xs font-semibold text-[var(--danger)]">{attentionCount}</span>
              ) : undefined
            }
          >
            {(notifPerm === 'default' || notifPerm === 'denied') && (
              <div className="mb-2">
                {notifPerm === 'default' && (
                  <button
                    onClick={async () => {
                      const ok = await requestNotifPermission()
                      setNotifPerm(ok ? 'granted' : 'denied')
                      // на нативе сразу планируем набор — данные уже есть, менять их не нужно
                      if (ok && Capacitor.isNativePlatform()) rescheduleNotifications(data)
                    }}
                    className="text-xs font-medium text-[var(--accent)]"
                  >
                    {t('dashboard.enableReminders')}
                  </button>
                )}
                {notifPerm === 'denied' && (
                  <span className="text-xs text-[var(--text-3)]">{t('dashboard.remindersBlocked')}</span>
                )}
              </div>
            )}
            {attentionCount === 0 ? (
              <p className="text-sm text-[var(--text-3)]">{vt('dashboard.noReminders')}</p>
            ) : (
              <ul className="space-y-1.5">
                {overdueTasks.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 text-sm">
                    <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                    <span className="flex-1 truncate">{x.title}</span>
                    <span className="text-xs" style={{ color: 'var(--danger)' }}>{vt('dashboard.overdue')}</span>
                  </li>
                ))}
                {budgetAlerts.map((b) => (
                  <li key={`b-${b.name}`} className="flex items-center gap-2 text-sm">
                    <Wallet size={14} style={{ color: 'var(--danger)' }} />
                    <span className="flex-1 truncate">{vt('dashboard.budgetOver')}: {b.name}</span>
                    <span className="text-xs tabular-nums tnum" style={{ color: 'var(--danger)' }}>
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
                      {t(
                        nextRecurring.nextMonth ? 'dashboard.recurringSoonNextMonth' : 'dashboard.recurringSoon',
                        { day: nextRecurring.rec.dayOfMonth },
                      )}: {nextRecurring.rec.label}
                    </span>
                    <span className="text-xs tabular-nums tnum text-[var(--text-3)]">
                      {formatMoney(nextRecurring.rec.amount, nextRecurring.rec.currency)}
                    </span>
                  </li>
                )}
                {waterLow && (
                  <li className="flex items-center gap-2 text-sm">
                    <Droplet size={14} style={{ color: 'var(--warning)' }} />
                    <span className="flex-1 truncate">{vt('dashboard.waterLow')}</span>
                    <span className="text-xs tabular-nums tnum text-[var(--text-3)]">
                      {waterToday} / {waterGoal} {t('health.waterMlUnit')}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </CollapsibleCard>
        )

      case 'finance':
        return (
          <CollapsibleCard
            id="finance"
            icon={<Wallet size={16} style={{ color: 'var(--accent)' }} />}
            title={t('dashboard.wFinance')}
            summary={
              <span
                className="text-sm font-semibold tnum"
                style={{ color: money.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {formatMoney(money.balance, base)}
              </span>
            }
          >
            <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('dashboard.income')}</div>
                <div className="font-semibold tnum" style={{ color: 'var(--success)' }}>{formatMoney(money.income, base)}</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('dashboard.spending')}</div>
                <div className="font-semibold tnum">{formatMoney(money.spending, base)}</div>
              </div>
            </div>
            {!rates && (
              <p className="mb-2 text-[11px]" style={{ color: 'var(--warning)' }}>
                {t('dashboard.ratesMissing')}
              </p>
            )}
            {/* зоны нажатия ≥40px: тип операции, сумма, валюта, добавить.
                Порядок кнопок = порядку сводки выше (Доходы | Расходы),
                иначе пользователи путались; по умолчанию выбран Расход */}
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {(['income', 'expense'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setQaType(tp)}
                  className="min-h-10 rounded-lg py-2 text-sm font-medium transition active:scale-[.97]"
                  style={qaType === tp ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { background: 'var(--bg-3)', color: 'var(--text-2)' }}
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
                className="min-h-11 min-w-0 flex-1"
              />
              <div className="w-24 shrink-0">
                <CurrencySelect value={qaCur} onChange={setQaCur} />
              </div>
              <Button
                onClick={quickAddMoney}
                disabled={!qaAmount}
                aria-label={t('common.add')}
                className="min-h-11 min-w-11 shrink-0"
              >
                <Plus size={18} />
              </Button>
            </div>
          </CollapsibleCard>
        )

      case 'cards':
        return (
          <CollapsibleCard
            id="cards"
            icon={<CreditCard size={16} style={{ color: 'var(--accent)' }} />}
            title={t('nav.cards')}
            summary={<span className="text-xs text-[var(--text-3)] tnum">{data.cards.length}</span>}
          >
            {data.cards.length === 0 ? (
              <button onClick={() => navigate('/cards')} className="text-sm text-[var(--accent)]">
                {t('dashboard.noCards')} · {t('dashboard.open')}
              </button>
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
          </CollapsibleCard>
        )

      case 'tasks':
        return (
          <CollapsibleCard
            id="tasks"
            icon={<HomeIcon size={16} style={{ color: 'var(--accent)' }} />}
            title={t('dashboard.wTasks')}
            summary={
              activeTasks.length > 0 ? (
                <span className="tnum text-xs text-[var(--text-3)]">{activeTasks.length}</span>
              ) : undefined
            }
          >
            {activeTasks.length === 0 ? (
              <p className="mb-2 text-sm text-[var(--text-3)]">{t('dashboard.noTasksW')}</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {activeTasks.slice(0, 5).map((x) => {
                  const overdue = x.dueDate && x.dueDate < today
                  return (
                    <li key={x.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={x.done} onChange={() => toggleHomeTask(x.id)} label={x.title} />
                      <span className="flex-1 truncate">{x.title}</span>
                      {overdue && <span className="text-xs" style={{ color: 'var(--danger)' }}>{vt('dashboard.overdue')}</span>}
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
          </CollapsibleCard>
        )

      case 'calendar':
        return (
          <CollapsibleCard
            id="calendar"
            icon={<CalendarDays size={16} style={{ color: 'var(--accent)' }} />}
            title={t('dashboard.calendarToday')}
            summary={
              calendarToday.length > 0 ? (
                <span className="tnum text-xs text-[var(--text-3)]">{calendarToday.length}</span>
              ) : undefined
            }
          >
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
          </CollapsibleCard>
        )

      case 'water':
        return (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Droplet size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.wWater')}
              </h2>
              <span className="text-sm font-semibold tabular-nums tnum">
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
    <PullToRefresh onRefresh={handleRefresh}>
      {/* Шапка. Иерархия: приветствие + дата/время — главное; погода и курсы —
          вторичный ряд компактных чипов, а не равновесные карточки */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        <p className="mt-0.5 text-sm text-[var(--text-2)] tabular-nums">
          {dateStr} · {timeStr} · {tzShort}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {weather && data.settings.weatherLocation && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <span className="text-base leading-none">{describeWeather(weather.code).emoji}</span>
              <span className="tnum font-semibold">{weather.tempC}°C</span>
              <span className="text-[var(--text-3)]">{data.settings.weatherLocation.name.split(',')[0]}</span>
            </span>
          )}
          {rates && tickerCurrencies.length > 0 && (
            <span
              className="tnum inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              title={t('dashboard.ratesTitle')}
            >
              {tickerCurrencies.map((q) => {
                // сколько базовой валюты за 1 единицу q; для «мелких» курсов
                // (напр. RUB) показываем за 100 единиц — читабельнее
                const r = rateOf(q, base, rates!)
                if (r == null) return null
                const per100 = r < 0.1
                const sym = CURRENCY_SYMBOLS[q] ?? q
                return (
                  <span key={q}>
                    <span className="text-[var(--text-3)]">
                      {per100 ? `100${sym}` : sym}
                    </span>{' '}
                    {(per100 ? r * 100 : r).toFixed(2)}
                  </span>
                )
              })}
            </span>
          )}
        </div>
      </div>

      {/* Маскот темы («Тёплая»/«Спокойная»): реплика по ситуации, тап — следующая */}
      <MascotCard
        overdue={overdueTasks.length}
        waterLow={waterLow}
        allDone={attentionCount === 0}
      />

      {/* Кнопка настройки виджетов */}
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" onClick={() => setManageOpen(true)}>
          <Settings2 size={16} /> {t('dashboard.manageWidgets')}
        </Button>
      </div>

      {/* Виджеты. НЕ CSS columns: та кладка балансирует колонки по высоте,
          и сворачивание виджета перекидывало соседей из колонки в колонку.
          Стабильное распределение — по порядку (первая половина слева),
          высоты на раскладку не влияют; колонки — независимые стеки,
          дыр под короткими виджетами нет. */}
      {isDesktop ? (
        <div className="grid grid-cols-2 items-start" style={{ columnGap: '1rem' }}>
          {[widgets.slice(0, Math.ceil(widgets.length / 2)), widgets.slice(Math.ceil(widgets.length / 2))].map(
            (col, ci) => (
              <div key={ci} className="min-w-0">
                {col.map((id) => (
                  <div key={id} className="mb-4">
                    {renderWidget(id)}
                  </div>
                ))}
              </div>
            ),
          )}
        </div>
      ) : (
        <div>
          {widgets.map((id) => (
            <div key={id} className="mb-4">
              {renderWidget(id)}
            </div>
          ))}
        </div>
      )}

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
                <Checkbox checked={enabled} onChange={() => toggleWidget(id)} label={widgetName[id]} />
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
    </PullToRefresh>
  )
}
