import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useStore } from '../../store'
import { CollapsibleCard } from '../../components/ui'
import { todayISO } from '../../lib/id'

/**
 * «Сейчас / Далее»: два ближайших ещё не наступивших события с временем на
 * сегодня. Это умная сортировка уже существующих данных, а не таймлайн.
 *
 * `now` приходит пропом, а не заводится здесь: те же живые часы показывают
 * время в шапке и решают, «поздно ли» для воды. Свой интервал означал бы
 * третий таймер и расхождение подписей на тик.
 */
export function NowNextWidget({ now }: { now: Date }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const calendarTasks = useStore((s) => s.data.calendarTasks)
  const today = todayISO()

  const nowNext = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    return calendarTasks
      .filter((x) => x.date === today && !x.done && x.time && x.time >= hhmm)
      .sort((a, b) => (a.time as string).localeCompare(b.time as string))
      .slice(0, 2)
  }, [calendarTasks, today, now])

  /** Минут до времени HH:MM сегодня (относительно живых часов). */
  function minutesUntil(time: string): number {
    const [h, m] = time.split(':').map(Number)
    const target = new Date(now)
    target.setHours(h, m, 0, 0)
    return Math.round((target.getTime() - now.getTime()) / 60000)
  }

  const relLabel = (time: string) => {
    const mins = minutesUntil(time)
    if (mins <= 0) return t('dashboard.now')
    if (mins < 60) return t('dashboard.inMin', { count: mins })
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? t('dashboard.inHM', { h, m }) : t('dashboard.inH', { count: h })
  }

  const up = nowNext[0]
  const later = nowNext[1]

  return (
    <CollapsibleCard
      id="nownext"
      icon={<Clock size={16} style={{ color: 'var(--accent)' }} />}
      title={t('dashboard.nowNext')}
      summary={
        up ? <span className="tnum text-xs text-[var(--text-3)]">{relLabel(up.time as string)}</span> : undefined
      }
    >
      {!up ? (
        <p className="text-sm text-[var(--text-3)]">{t('dashboard.nowNextEmpty')}</p>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => navigate('/calendar', { state: { focusId: up.id, focusDate: up.date } })}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:opacity-90"
            style={{ background: 'var(--bg-3)' }}
          >
            <span className="flex w-14 shrink-0 flex-col items-center">
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
                {up.time}
              </span>
              <span className="text-[10px] text-[var(--text-3)]">{relLabel(up.time as string)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
                {t('dashboard.upNext')}
              </span>
              <span className="block truncate text-sm font-medium">{up.title}</span>
            </span>
          </button>
          {later && (
            <button
              onClick={() => navigate('/calendar', { state: { focusId: later.id, focusDate: later.date } })}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--bg-3)]"
            >
              <span className="w-14 shrink-0 text-center text-xs tabular-nums text-[var(--text-3)]">
                {later.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wide text-[var(--text-3)]">
                  {t('dashboard.thenNext')}
                </span>
                <span className="block truncate text-sm">{later.title}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </CollapsibleCard>
  )
}
