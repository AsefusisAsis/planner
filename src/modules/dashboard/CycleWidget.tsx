import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Droplets, ChevronRight, Plus, Check } from 'lucide-react'
import { useStore } from '../../store'
import { todayISO } from '../../lib/id'
import { computeCycle, diffDays, type CyclePhase } from '../../lib/cycle'

/** Цвет фазы через CSS-переменные темы. */
const PHASE_COLOR: Record<CyclePhase, string> = {
  menstruation: 'var(--danger)',
  follicular: 'var(--accent)',
  ovulation: 'var(--success)',
  luteal: 'var(--warning)',
  unknown: 'var(--text-3)',
}

/**
 * Крупный виджет цикла на Главной (cycle-first, как в спец-приложениях):
 * текущая фаза + день цикла, прогресс по циклу, прогноз следующей
 * менструации (обратный отсчёт диапазоном) или задержка, фертильное окно и
 * уровень уверенности + быстрый «отметить менструацию». Тап по шапке — в
 * раздел /cycle. Раздел «Цикл» на телефоне живёт в меню «Ещё», поэтому этот
 * виджет — основная точка входа на Главной. Рендерится только при включённом
 * трекере (settings.cycleEnabled).
 */
export function CycleWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cycleLog = useStore((s) => s.data.cycleLog)
  const logCycleDay = useStore((s) => s.logCycleDay)
  const today = todayISO()

  const periodDays = useMemo(
    () => cycleLog.filter((e) => e.period).map((e) => ({ date: e.date, flow: e.flow })),
    [cycleLog],
  )
  const info = useMemo(() => computeCycle(periodDays, today), [periodDays, today])
  const loggedToday = cycleLog.find((e) => e.date === today)?.period === true

  const fmt = (iso: string | null) => {
    if (!iso) return '—'
    const [, m, d] = iso.split('-')
    return `${d}.${m}`
  }
  const phaseLabel: Record<CyclePhase, string> = {
    menstruation: t('health.cycPhaseMenstruation'),
    follicular: t('health.cycPhaseFollicular'),
    ovulation: t('health.cycPhaseOvulation'),
    luteal: t('health.cycPhaseLuteal'),
    unknown: t('health.cycPhaseUnknown'),
  }
  const phaseColor = PHASE_COLOR[info.phase]
  const daysToNext = info.nextPeriodDate ? diffDays(today, info.nextPeriodDate) : null
  const pct =
    info.dayOfCycle != null ? Math.min(100, Math.round((info.dayOfCycle / info.avgCycle) * 100)) : 0
  const confColor =
    info.confidence === 'high'
      ? 'var(--success-text)'
      : info.confidence === 'medium'
        ? 'var(--warning-text)'
        : 'var(--text-3)'
  const showFertile = !!info.fertileStart && !!info.fertileEnd && diffDays(today, info.fertileEnd) >= 0

  // кнопка «отметить менструацию сегодня» (переиспользуется в обеих ветках)
  const logButton = (
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
  )

  return (
    <div
      className="cc rounded-2xl border p-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* шапка → раздел «Цикл» */}
      <button
        type="button"
        onClick={() => navigate('/cycle')}
        className="flex w-full items-center gap-2 text-left"
      >
        <Droplets size={18} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold">{t('nav.cycle')}</span>
        <ChevronRight size={16} className="ml-auto shrink-0" style={{ color: 'var(--text-3)' }} />
      </button>

      {info.dayOfCycle == null ? (
        // мало данных: приглашение отметить менструацию
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-[var(--text-3)]">{t('dashboard.cycNoData')}</p>
          {logButton}
        </div>
      ) : (
        <>
          {/* фаза + день цикла крупно, справа — быстрый лог */}
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: phaseColor }}
              >
                {phaseLabel[info.phase]}
              </div>
              <div className="text-2xl font-semibold leading-tight tnum">
                {t('health.cycDayOfCycle', { n: info.dayOfCycle })}
              </div>
            </div>
            {logButton}
          </div>

          {/* прогресс по циклу */}
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--bg-3)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: phaseColor }}
            />
          </div>

          {/* следующая менструация / задержка */}
          <div className="mt-3 text-sm">
            {info.daysLate != null ? (
              <span className="font-medium" style={{ color: 'var(--warning-text)' }}>
                {t('health.cycLate', { n: info.daysLate })}
              </span>
            ) : daysToNext != null ? (
              <span>
                <span className="text-[var(--text-3)]">{t('health.cycNextPeriod')}: </span>
                <span className="font-medium tnum">
                  {daysToNext <= 0
                    ? t('dashboard.cycToday')
                    : t('dashboard.cycInDays', { count: daysToNext })}
                  {info.predictSpread > 0 && ` ±${info.predictSpread}`}
                </span>
                <span className="text-[var(--text-3)] tnum"> · {fmt(info.nextPeriodDate)}</span>
              </span>
            ) : null}
          </div>

          {/* фертильное окно (только если ещё впереди/сейчас) */}
          {showFertile && (
            <div className="mt-1 text-xs text-[var(--text-3)]">
              {t('health.cycFertile')}:{' '}
              <span className="tnum">
                {fmt(info.fertileStart)} — {fmt(info.fertileEnd)}
              </span>
            </div>
          )}

          {/* уверенность прогноза */}
          {info.hasPrediction && (
            <div className="mt-1 text-[11px]" style={{ color: confColor }}>
              {t('health.cycConf_' + info.confidence)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
