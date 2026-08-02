import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { useStore } from '../../store'
import { CollapsibleCard } from '../../components/ui'
import { todayISO } from '../../lib/id'

/**
 * События на сегодня.
 *
 * Фильтр повторяет тот, что делает useAttention, — намеренно: пробрасывать
 * сюда весь набор «требует внимания» ради одной строки означало бы связать
 * простой виджет с расчётом, который ему не нужен.
 */
export function CalendarWidget() {
  const { t } = useTranslation()
  const calendarTasks = useStore((s) => s.data.calendarTasks)
  const today = todayISO()
  const calendarToday = calendarTasks.filter((x) => x.date === today && !x.done)

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
}
