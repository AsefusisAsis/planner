import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { Card } from '../../components/ui'
import { LineChart } from '../../components/LineChart'
import { Donut } from '../../components/Donut'
import { periodsFromDays, computeCycle, diffDays } from '../../lib/cycle'
import { useSymptomLabel } from './symptoms'
import { todayISO } from '../../lib/id'
import type { CycleDayEntry, CycleMood } from '../../types'

// цвета настроения (от лучшего к худшему)
const MOOD_META: { key: CycleMood; emoji: string; color: string }[] = [
  { key: 'great', emoji: '😄', color: '#22c55e' },
  { key: 'good', emoji: '🙂', color: '#84cc16' },
  { key: 'ok', emoji: '😐', color: '#f59e0b' },
  { key: 'low', emoji: '😕', color: '#f97316' },
  { key: 'bad', emoji: '😣', color: '#ef4444' },
]

/**
 * Аналитика цикла (как в спец-приложениях): история длины цикла с линией
 * среднего, частота симптомов, распределение настроения. Всё по локальным
 * данным пользователя, без универсальных утверждений.
 */
export function CycleAnalytics({ cycleLog }: { cycleLog: CycleDayEntry[] }) {
  const { t } = useTranslation()
  const symptomLabel = useSymptomLabel()

  const periodDays = useMemo(
    () => cycleLog.filter((e) => e.period).map((e) => ({ date: e.date, flow: e.flow })),
    [cycleLog],
  )
  const info = useMemo(() => computeCycle(periodDays, todayISO()), [periodDays])

  // длины циклов = промежутки между стартами
  const cycleLengths = useMemo(() => {
    const { starts } = periodsFromDays(periodDays)
    const out: { label: string; value: number }[] = []
    for (let i = 1; i < starts.length; i++) {
      const [, m, d] = starts[i].split('-')
      out.push({ label: `${d}.${m}`, value: diffDays(starts[i - 1], starts[i]) })
    }
    return out.slice(-12) // как в спец-приложениях — до 12 циклов
  }, [periodDays])

  // частота симптомов (сколько дней отмечен каждый)
  const symptomFreq = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of cycleLog) for (const s of e.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1)
    // строим по фактическим отметкам, а не по каталогу: раньше диаграмма
    // перечисляла только встроенный список, поэтому свои симптомы в неё не
    // попадали, а скрытые исчезали бы из истории задним числом
    return [...counts.entries()]
      .map(([s, n]) => ({ s, n }))
      .sort((a, b) => b.n - a.n || a.s.localeCompare(b.s))
  }, [cycleLog])
  const symMax = symptomFreq.length ? symptomFreq[0].n : 0

  // распределение настроения
  const moodSegments = useMemo(() => {
    const counts = new Map<CycleMood, number>()
    for (const e of cycleLog) if (e.mood) counts.set(e.mood, (counts.get(e.mood) ?? 0) + 1)
    return MOOD_META.filter((m) => (counts.get(m.key) ?? 0) > 0).map((m) => ({
      label: m.emoji,
      value: counts.get(m.key)!,
      color: m.color,
    }))
  }, [cycleLog])

  const hasAnything = cycleLengths.length >= 1 || symptomFreq.length > 0 || moodSegments.length > 0
  if (!hasAnything) return null

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-base font-semibold">{t('health.cycAnalytics')}</h2>
      </div>

      {cycleLengths.length >= 2 && (
        <div className="mb-4">
          <div className="mb-1 text-xs text-[var(--text-3)]">{t('health.cycChartLength')}</div>
          <LineChart data={cycleLengths} goal={info.avgCycle} unit={t('health.cycDaysUnit')} />
          <div className="mt-1 text-[11px] text-[var(--text-3)]">
            {t('health.cycChartAvgLine', { n: info.avgCycle })}
          </div>
        </div>
      )}

      {symptomFreq.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycChartSymptoms')}</div>
          <div className="flex flex-col gap-1.5">
            {symptomFreq.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate text-[var(--text-2)]">{symptomLabel(s)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((n / symMax) * 100)}%`, background: 'var(--accent)' }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right tnum text-[var(--text-3)]">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {moodSegments.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycChartMood')}</div>
          <div className="flex justify-center">
            <Donut segments={moodSegments} size={130} thickness={14} />
          </div>
        </div>
      )}
    </Card>
  )
}
