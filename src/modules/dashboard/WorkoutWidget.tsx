import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Check, Dumbbell } from 'lucide-react'
import { useStore } from '../../store'
import { Button, Card } from '../../components/ui'
import { todayISO } from '../../lib/id'

/** Тренировка на сегодня: сделана или переход в раздел. */
export function WorkoutWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const workoutLog = useStore((s) => s.data.workoutLog)
  const today = todayISO()
  const doneToday = workoutLog.some((w) => w.date === today)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Dumbbell size={16} style={{ color: 'var(--accent)' }} /> {t('dashboard.workoutToday')}
        </h2>
        {doneToday ? (
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
