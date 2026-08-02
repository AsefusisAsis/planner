import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarDays, Droplet, Wallet } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { CollapsibleCard } from '../../components/ui'
import { formatMoney } from '../../services/rates'
import {
  getNotifPermission,
  requestNotifPermission,
  rescheduleNotifications,
  type NotifPermission,
} from '../../services/notifications'
import type { Attention } from './attention'

/**
 * «Требует внимания»: просроченные задачи, превышенные бюджеты, дела на
 * сегодня, ближайший платёж, недопитая вода.
 *
 * Расчёт приходит готовым (useAttention) — теми же цифрами пользуются маскот
 * и отправка уведомлений на странице, считать их здесь второй раз нельзя.
 * Состояние разрешения на уведомления, наоборот, живёт ЗДЕСЬ: кнопка
 * «Включить напоминания» — единственный его потребитель.
 */
export function RemindersWidget({ attention }: { attention: Attention }) {
  const { t } = useTranslation()
  const vt = useVoice()
  const navigate = useNavigate()
  const data = useStore((s) => s.data)
  const base = data.settings.baseCurrency
  const {
    overdueTasks,
    dueTodayTasks,
    calendarToday,
    budgetAlerts,
    nextRecurring,
    waterLow,
    waterToday,
    waterGoal,
    count,
  } = attention

  // единое состояние разрешения для веба И натива: раньше кнопка «Включить»
  // показывалась только в вебе, на Android affordance не было вовсе
  const [notifPerm, setNotifPerm] = useState<NotifPermission>('unsupported')
  useEffect(() => {
    let alive = true
    void getNotifPermission().then((s) => alive && setNotifPerm(s))
    return () => {
      alive = false
    }
  }, [])

  const row = 'flex w-full items-center gap-2 rounded-md py-0.5 text-left text-sm transition-colors hover:bg-[var(--bg-3)]'

  return (
    <CollapsibleCard
      id="reminders"
      icon={<Bell size={16} style={{ color: 'var(--accent)' }} />}
      title={vt('dashboard.attention')}
      summary={
        count > 0 ? (
          <span className="tnum text-xs font-semibold text-[var(--danger-text)]">{count}</span>
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
      {count === 0 ? (
        <p className="text-sm text-[var(--text-3)]">{vt('dashboard.noReminders')}</p>
      ) : (
        <ul className="space-y-1.5">
          {/* строки-напоминания кликабельны: тап ведёт на страницу
              соответствующего раздела (задачи → /home, события →
              /calendar, бюджет/платёж → /expenses, вода → /health) */}
          {overdueTasks.map((x) => (
            <li key={x.id}>
              <button onClick={() => navigate('/home', { state: { focusId: x.id } })} className={row}>
                <AlertTriangle size={14} style={{ color: 'var(--danger-text)' }} />
                <span className="flex-1 truncate">{x.title}</span>
                <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{vt('dashboard.overdue')}</span>
              </button>
            </li>
          ))}
          {budgetAlerts.map((b) => (
            <li key={`b-${b.name}`}>
              <button onClick={() => navigate('/expenses')} className={row}>
                <Wallet size={14} style={{ color: 'var(--danger-text)' }} />
                <span className="flex-1 truncate">{vt('dashboard.budgetOver')}: {b.name}</span>
                <span className="text-xs tabular-nums tnum" style={{ color: 'var(--danger-text)' }}>
                  {formatMoney(b.spent, base)} / {formatMoney(b.budget, base)}
                </span>
              </button>
            </li>
          ))}
          {dueTodayTasks.map((x) => (
            <li key={x.id}>
              <button onClick={() => navigate('/home', { state: { focusId: x.id } })} className={row}>
                <Bell size={14} style={{ color: 'var(--warning-text)' }} />
                <span className="flex-1 truncate">{x.title}</span>
                <span className="text-xs text-[var(--text-3)]">{t('dashboard.dueToday')}</span>
              </button>
            </li>
          ))}
          {calendarToday.map((x) => (
            <li key={x.id}>
              <button
                onClick={() => navigate('/calendar', { state: { focusId: x.id, focusDate: x.date } })}
                className={row}
              >
                <CalendarDays size={14} style={{ color: 'var(--accent)' }} />
                {x.time && <span className="text-xs tabular-nums text-[var(--text-3)]">{x.time}</span>}
                <span className="flex-1 truncate">{x.title}</span>
              </button>
            </li>
          ))}
          {nextRecurring && (
            <li>
              <button onClick={() => navigate('/expenses')} className={row}>
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
              </button>
            </li>
          )}
          {waterLow && (
            <li>
              <button onClick={() => navigate('/health')} className={row}>
                <Droplet size={14} style={{ color: 'var(--warning-text)' }} />
                <span className="flex-1 truncate">{vt('dashboard.waterLow')}</span>
                <span className="text-xs tabular-nums tnum text-[var(--text-3)]">
                  {waterToday} / {waterGoal} {t('health.waterMlUnit')}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </CollapsibleCard>
  )
}
