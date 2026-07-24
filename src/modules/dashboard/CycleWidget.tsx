import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Droplets, ChevronRight, Plus, Check } from 'lucide-react'
import { useStore } from '../../store'
import { todayISO } from '../../lib/id'
import { computeCycle } from '../../lib/cycle'

/**
 * Виджет цикла на Главной (cycle-first, как в спец-приложениях): день цикла,
 * прогноз следующей менструации диапазоном, уровень уверенности + быстрый
 * «отметить менструацию». Тап по карточке — в раздел /cycle. Рендерится
 * только при включённом трекере (settings.cycleEnabled).
 */
export function CycleWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cycleLog = useStore((s) => s.data.cycleLog)
  const logCycleDay = useStore((s) => s.logCycleDay)
  const today = todayISO()

  const periodDays = useMemo(() => cycleLog.filter((e) => e.period).map((e) => e.date), [cycleLog])
  const info = useMemo(() => computeCycle(periodDays, today), [periodDays, today])

  const loggedToday = cycleLog.find((e) => e.date === today)?.period === true

  const fmt = (iso: string | null) => {
    if (!iso) return '—'
    const [, m, d] = iso.split('-')
    return `${d}.${m}`
  }
  const confColor =
    info.confidence === 'high'
      ? 'var(--success-text)'
      : info.confidence === 'medium'
        ? 'var(--warning-text)'
        : 'var(--text-3)'

  return (
    <div className="cc rounded-2xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={() => navigate('/cycle')}
        className="flex w-full items-center gap-2 text-left"
      >
        <Droplets size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold">{t('nav.cycle')}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-[var(--text-3)]">
          {info.dayOfCycle != null && t('health.cycDayOfCycle', { n: info.dayOfCycle })}
          <ChevronRight size={15} />
        </span>
      </button>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {info.daysLate != null ? (
            <span className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>
              {t('health.cycLate', { n: info.daysLate })}
            </span>
          ) : info.nextPeriodDate ? (
            <span className="text-sm">
              <span className="text-[var(--text-3)]">{t('health.cycNextPeriod')}: </span>
              <span className="font-medium tnum">
                {fmt(info.nextPeriodDate)}
                {info.predictSpread > 0 && ` ±${info.predictSpread}`}
              </span>
            </span>
          ) : (
            <span className="text-sm text-[var(--text-3)]">{t('dashboard.cycNoData')}</span>
          )}
          {info.hasPrediction && (
            <div className="mt-0.5 text-[11px]" style={{ color: confColor }}>
              {t('health.cycConf_' + info.confidence)}
            </div>
          )}
        </div>

        {/* быстрый лог менструации на сегодня */}
        <button
          type="button"
          onClick={() => logCycleDay(today, { period: !loggedToday })}
          className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderColor: loggedToday ? 'var(--accent)' : 'var(--border)',
            background: loggedToday ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
            color: loggedToday ? 'var(--accent)' : 'var(--text-2)',
          }}
          aria-pressed={loggedToday}
        >
          {loggedToday ? <Check size={14} /> : <Plus size={14} />}
          {t('dashboard.cycLogToday')}
        </button>
      </div>
    </div>
  )
}
