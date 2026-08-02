import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  Home as HomeIcon,
  ShoppingCart,
  CalendarDays,
  HeartPulse,
  CreditCard,
  Settings2,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useStore } from '../../store'
import { Button } from '../../components/ui'
import { MascotCard } from '../../components/Mascot'
import { PullToRefresh } from '../../components/PullToRefresh'
import { tap } from '../../lib/haptics'
import { ALL_WIDGETS, type WidgetId } from '../../types'
import { useAttention } from './attention'
import { Header } from './Header'
import { ManageWidgetsModal } from './ManageWidgetsModal'
import { CycleWidget } from './CycleWidget'
import { WaterWidget } from './WaterWidget'
import { RemindersWidget } from './RemindersWidget'
import { NowNextWidget } from './NowNextWidget'
import { FinanceWidget } from './FinanceWidget'
import { CardsWidget } from './CardsWidget'
import { TasksWidget } from './TasksWidget'
import { CalendarWidget } from './CalendarWidget'
import { ShoppingWidget } from './ShoppingWidget'
import { WorkoutWidget } from './WorkoutWidget'

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  const cycleEnabled = useStore((s) => s.data.settings.cycleEnabled)
  const dashboardWidgets = useStore((s) => s.data.dashboardWidgets)

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

  // ---- живые часы ----
  // Один интервал на страницу: время в шапке, относительные подписи
  // «Сейчас/Далее» и правило «поздно ли для воды» должны идти в такт.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ---- «требует внимания» ----
  // Считается здесь, а не в виджете: этими же цифрами пользуются маскот
  // (allDone) и отправка уведомлений ниже.
  const attention = useAttention(now)

  // ---- уведомления ----
  // только веб: в нативном приложении напоминания идут через
  // @capacitor/local-notifications (services/notifications.ts), а веб-Notification
  // в Android WebView бесполезен — не показывается и зря просит разрешение
  const canNotify =
    typeof window !== 'undefined' && 'Notification' in window && !Capacitor.isNativePlatform()

  const { reminderLines, totalDue, remindersSig } = attention
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
  }, [canNotify, totalDue, remindersSig])

  // ---- виджеты ----
  // фильтр от неизвестных id: после обновления в сохранённых настройках
  // может остаться виджет, которого в сборке больше нет
  const widgets = dashboardWidgets.filter((w) =>
    (ALL_WIDGETS as readonly string[]).includes(w),
  ) as WidgetId[]
  const [manageOpen, setManageOpen] = useState(false)

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'reminders':
        return <RemindersWidget attention={attention} />
      case 'nownext':
        return <NowNextWidget now={now} />
      case 'finance':
        return <FinanceWidget />
      case 'cards':
        return <CardsWidget />
      case 'tasks':
        return <TasksWidget />
      case 'calendar':
        return <CalendarWidget />
      case 'shopping':
        return <ShoppingWidget />
      case 'water':
        return <WaterWidget />
      case 'workout':
        return <WorkoutWidget />
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
      <Header now={now} />

      {/* Маскот темы («Тёплая»/«Спокойная»): реплика по ситуации, тап — следующая */}
      <MascotCard
        overdue={attention.overdueTasks.length}
        waterLow={attention.waterLow}
        allDone={attention.count === 0}
      />

      {/* Виджет цикла (cycle-first) — только при включённом трекере, наверху */}
      {cycleEnabled && (
        <div className="mb-3">
          <CycleWidget />
        </div>
      )}

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

      <ManageWidgetsModal open={manageOpen} onClose={() => setManageOpen(false)} widgets={widgets} />
    </PullToRefresh>
  )
}
