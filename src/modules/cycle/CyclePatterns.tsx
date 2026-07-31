import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, CalendarClock } from 'lucide-react'
import { Card } from '../../components/ui'
import { analyzeSymptoms, computePms, type SymptomPattern } from '../../lib/cycleSymptoms'
import { useSymptomLabel } from './symptoms'
import type { CycleDayEntry } from '../../types'

/**
 * Личные закономерности симптомов и предменструальное окно.
 *
 * Здесь нет ни одного универсального утверждения: всё, что показывается, —
 * пересказ собственных отметок пользователя. Пока данных мало, честнее
 * сказать «нужно ещё N циклов», чем показать уверенный вывод из двух точек;
 * если предменструальных отметок нет вовсе — блока ПМС просто не будет.
 */
export function CyclePatterns({
  cycleLog,
  nextPeriodDate,
  today,
}: {
  cycleLog: CycleDayEntry[]
  nextPeriodDate: string | null
  today: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const label = useSymptomLabel()

  const analysis = useMemo(() => analyzeSymptoms(cycleLog), [cycleLog])
  const pms = useMemo(
    () => computePms(analysis.patterns, nextPeriodDate, today),
    [analysis, nextPeriodDate, today],
  )

  // Симптомы вообще отмечались? Если нет — раздел человеку не нужен, и
  // подсказка «нужно ещё N циклов» была бы просто шумом на экране.
  const logsSymptoms = useMemo(() => cycleLog.some((e) => e.symptoms?.length), [cycleLog])
  if (!logsSymptoms) return null

  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(d))

  const when = (p: SymptomPattern) =>
    p.anchor === 'beforePeriod'
      ? p.from === p.to
        ? t('health.cycPatternBefore', { n: p.typical })
        : t('health.cycPatternBeforeRange', { from: p.from, to: p.to })
      : p.from === p.to
        ? t('health.cycPatternDay', { n: p.typical })
        : t('health.cycPatternDays', { from: p.from, to: p.to })

  return (
    <>
      {pms && (
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock size={16} style={{ color: 'var(--warning-text)' }} />
            <h3 className="text-sm font-semibold">{t('health.cycPmsTitle')}</h3>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>
              {pms.active
                ? t('health.cycPmsActive')
                : pms.daysUntil === 0
                  ? t('health.cycPmsToday')
                  : t('health.cycPmsSoon', { n: pms.daysUntil })}
            </span>
            <span className="text-xs text-[var(--text-3)] tnum">
              {t('health.cycPmsRange', { from: fmt(pms.start), to: fmt(pms.end) })}
            </span>
          </div>
          <div className="mt-2 text-xs text-[var(--text-3)]">{t('health.cycPmsBasis')}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pms.symptoms.map((s) => (
              <span
                key={s}
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
                  color: 'var(--warning-text)',
                }}
              >
                {label(s)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold">{t('health.cycPatternsTitle')}</h3>
        </div>

        {!analysis.enoughData ? (
          <p className="text-sm text-[var(--text-3)]">
            {t('health.cycPatternsNeed', { count: analysis.cyclesNeeded })}
          </p>
        ) : analysis.patterns.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">{t('health.cycPatternsNone')}</p>
        ) : (
          <ul className="space-y-2">
            {analysis.patterns.map((p) => (
              <li key={p.symptom} className="text-sm">
                <span className="font-medium">{label(p.symptom)}</span>
                <span className="text-[var(--text-2)]"> — {when(p)}</span>
                <span className="ml-1 text-[11px] text-[var(--text-3)] tnum">
                  {t('health.cycPatternIn', { n: p.cycles, total: analysis.cyclesAnalyzed })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[11px] text-[var(--text-3)]">{t('health.cycPatternsHint')}</p>
      </Card>
    </>
  )
}
