import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Info, Trash2 } from 'lucide-react'
import { useStore } from '../../../store'
import { Card, IconButton } from '../../../components/ui'
import { todayISO } from '../../../lib/id'
import { computeCycle, addDays } from '../../../lib/cycle'
import type { CycleFlow, CycleMood } from '../../../types'

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const FLOWS: CycleFlow[] = ['spotting', 'light', 'medium', 'heavy']
const MOODS: { key: CycleMood; emoji: string }[] = [
  { key: 'great', emoji: '😄' },
  { key: 'good', emoji: '🙂' },
  { key: 'ok', emoji: '😐' },
  { key: 'low', emoji: '😕' },
  { key: 'bad', emoji: '😣' },
]
const SYMPTOMS = ['cramps', 'headache', 'bloating', 'fatigue', 'backache', 'tender', 'acne', 'nausea', 'cravings']
const symKey = (s: string) => 'cycSym' + s.charAt(0).toUpperCase() + s.slice(1)

export default function CycleView() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const cycleLog = useStore((s) => s.data.cycleLog)
  const logCycleDay = useStore((s) => s.logCycleDay)
  const deleteCycleDay = useStore((s) => s.deleteCycleDay)

  const today = todayISO()
  const periodDays = useMemo(() => cycleLog.filter((e) => e.period).map((e) => e.date), [cycleLog])
  const info = useMemo(() => computeCycle(periodDays, today), [periodDays, today])
  const byDate = useMemo(() => new Map(cycleLog.map((e) => [e.date, e])), [cycleLog])
  const todayEntry = byDate.get(today)

  // курсор месяца
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(cursor.y, cursor.m, 1),
  )
  // заголовки дней недели, понедельник первым
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i))) // 1 янв 2024 = пн
  }, [locale])

  // ячейки месяца (со смещением на понедельник)
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const offset = (first.getDay() + 6) % 7 // пн=0
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < offset; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(iso(cursor.y, cursor.m, d))
    return out
  }, [cursor])

  const periodSet = useMemo(() => new Set(periodDays), [periodDays])
  // прогнозные дни менструации (следующий цикл)
  const predictedSet = useMemo(() => {
    const s = new Set<string>()
    if (info.nextPeriodDate) for (let i = 0; i < info.avgPeriod; i++) s.add(addDays(info.nextPeriodDate, i))
    return s
  }, [info])
  const inFertile = (d: string) =>
    info.fertileStart && info.fertileEnd && d >= info.fertileStart && d <= info.fertileEnd

  const phaseText: Record<string, string> = {
    menstruation: t('health.cycPhaseMenstruation'),
    follicular: t('health.cycPhaseFollicular'),
    ovulation: t('health.cycPhaseOvulation'),
    luteal: t('health.cycPhaseLuteal'),
    unknown: t('health.cycPhaseUnknown'),
  }
  const fmtDate = (d: string | null) =>
    d ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(d)) : '—'

  function toggleSymptom(s: string) {
    const cur = todayEntry?.symptoms ?? []
    logCycleDay(today, { symptoms: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }

  return (
    <div className="space-y-4">
      {/* Фаза + прогноз */}
      <Card>
        {info.phase === 'unknown' && !info.hasPrediction ? (
          <p className="text-sm text-[var(--text-3)]">{t('health.cycNoData')}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-xs text-[var(--text-3)]">{t('health.cycPhaseLabel')}</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                  {phaseText[info.phase]}
                </div>
              </div>
              {info.dayOfCycle != null && (
                <div className="text-sm text-[var(--text-2)]">
                  {t('health.cycDayOfCycle', { n: info.dayOfCycle })}
                </div>
              )}
            </div>
            {/* задержка — важный сигнал для нерегулярного цикла */}
            {info.daysLate != null && (
              <div
                className="mt-2 rounded-lg p-2 text-center text-sm font-medium"
                style={{ background: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning-text)' }}
              >
                {t('health.cycLate', { n: info.daysLate })}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('health.cycNextPeriod')}</div>
                <div className="font-semibold">
                  {fmtDate(info.nextPeriodDate)}
                  {info.predictSpread > 0 && (
                    <span className="ml-1 font-normal text-[var(--text-3)]">
                      {t('health.cycAbout', { n: info.predictSpread })}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-[var(--text-3)]">{t('health.cycAvgCycle')}</div>
                <div className="font-semibold tnum">
                  {info.avgCycle} {t('health.cycDaysUnit')}
                </div>
              </div>
            </div>
            {info.regularity === 'irregular' && (
              <p className="mt-2 text-center text-[11px] text-[var(--warning-text)]">{t('health.cycIrregular')}</p>
            )}
            {info.fertileStart && (
              <div className="mt-2 rounded-lg p-2 text-center text-xs" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                <span className="text-[var(--text-3)]">{t('health.cycFertile')}: </span>
                <span className="font-medium" style={{ color: 'var(--success-text)' }}>
                  {fmtDate(info.fertileStart)} — {fmtDate(info.fertileEnd)}
                </span>
              </div>
            )}
          </>
        )}
        {/* дисклеймер к фертильному окну — обязателен */}
        <div className="mt-3 flex items-start gap-2 text-[11px] text-[var(--text-3)]">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>{t('health.cycFertileDisclaimer')}</span>
        </div>
        {/* приватность: цикл — локальная коллекция (решение 17.07) */}
        <p className="mt-1.5 text-[11px] text-[var(--text-3)]">{t('health.cycLocalOnly')}</p>
      </Card>

      {/* Календарь */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
            aria-label="←"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--text-2)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold capitalize">{monthTitle}</span>
          <button
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
            aria-label="→"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--text-2)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--text-3)]">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const dayNum = Number(d.slice(-2))
            const isPeriod = periodSet.has(d)
            const isPredicted = !isPeriod && predictedSet.has(d)
            const isOv = d === info.ovulationDate
            const isFert = !isPeriod && !isPredicted && inFertile(d)
            const isToday = d === today
            const style: CSSProperties = { minHeight: 40 }
            let cls = 'text-[var(--text)]'
            if (isPeriod) {
              style.background = 'var(--accent)'
              style.color = 'var(--on-accent)'
            } else if (isPredicted) {
              style.background = 'color-mix(in srgb, var(--accent) 18%, transparent)'
              style.color = 'var(--accent)'
            } else if (isFert) {
              style.background = 'color-mix(in srgb, var(--success) 14%, transparent)'
            }
            if (isToday) style.outline = '2px solid var(--text-2)'
            return (
              <button
                key={i}
                onClick={() => logCycleDay(d, { period: !isPeriod })}
                className={`relative flex items-center justify-center rounded-lg text-sm ${cls}`}
                style={style}
              >
                {dayNum}
                {isOv && (
                  <span
                    className="absolute bottom-1 h-1 w-1 rounded-full"
                    style={{ background: isPeriod ? 'var(--on-accent)' : 'var(--success)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-3)]">{t('health.cycTapHint')}</p>
        {/* легенда */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-3)]">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--accent)' }} />{t('health.cycLegendPeriod')}</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }} />{t('health.cycLegendPredicted')}</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--success) 14%, transparent)' }} />{t('health.cycLegendFertile')}</span>
          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />{t('health.cycLegendOvulation')}</span>
        </div>
      </Card>

      {/* Сегодня: менструация / поток / настроение / симптомы */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold">{t('health.cycTodayTitle')}</h3>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!todayEntry?.period}
            onChange={(e) => logCycleDay(today, { period: e.target.checked })}
            className="h-5 w-5"
            style={{ width: 20, height: 20 }}
          />
          {t('health.cycPeriodToday')}
        </label>

        {todayEntry?.period && (
          <div className="mt-3">
            <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycFlow')}</div>
            <div className="flex flex-wrap gap-1.5">
              {FLOWS.map((f) => {
                const on = todayEntry?.flow === f
                return (
                  <button
                    key={f}
                    onClick={() => logCycleDay(today, { flow: on ? undefined : f })}
                    className="chip"
                    style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' } : undefined}
                  >
                    {t('health.cycFlow' + f.charAt(0).toUpperCase() + f.slice(1))}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycMood')}</div>
          <div className="flex gap-1.5">
            {MOODS.map((m) => {
              const on = todayEntry?.mood === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => logCycleDay(today, { mood: on ? undefined : m.key })}
                  aria-label={t('health.cycMood' + m.key.charAt(0).toUpperCase() + m.key.slice(1))}
                  aria-pressed={on}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg text-xl transition"
                  style={{ background: on ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--bg-3)', outline: on ? '2px solid var(--accent)' : undefined }}
                >
                  {m.emoji}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycSymptoms')}</div>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => {
              const on = (todayEntry?.symptoms ?? []).includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  aria-pressed={on}
                  className="chip"
                  style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' } : undefined}
                >
                  {t('health.' + symKey(s))}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Статистика цикла */}
      {info.loggedCycles > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">{t('health.cycStatsTitle')}</h3>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: t('health.cycStatShortest'), val: info.minCycle },
              { label: t('health.cycStatLongest'), val: info.maxCycle },
              { label: t('health.cycStatCycles'), val: info.loggedCycles },
              { label: t('health.cycStatPeriod'), val: info.avgPeriod },
            ].map((s, i) => (
              <div key={i} className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <div className="text-lg font-semibold tnum">{s.val ?? '—'}</div>
                <div className="text-[var(--text-3)]">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Дневник — история записей, новые сверху */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold">{t('health.cycDiaryTitle')}</h3>
        {cycleLog.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">{t('health.cycDiaryEmpty')}</p>
        ) : (
          <ul className="space-y-1">
            {[...cycleLog]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => {
                const moodEmoji = MOODS.find((m) => m.key === e.mood)?.emoji
                return (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg py-1.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-[var(--text-3)]">{fmtDate(e.date)}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {e.period && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
                        >
                          {t('health.cycDiaryPeriod')}
                          {e.flow ? ` · ${t('health.cycFlow' + e.flow.charAt(0).toUpperCase() + e.flow.slice(1))}` : ''}
                        </span>
                      )}
                      {moodEmoji && <span className="text-base">{moodEmoji}</span>}
                      {(e.symptoms ?? []).map((s) => (
                        <span key={s} className="text-[11px] text-[var(--text-3)]">
                          {t('health.' + symKey(s))}
                        </span>
                      ))}
                    </span>
                    <IconButton aria-label={t('health.cycDiaryDelete')} onClick={() => deleteCycleDay(e.id)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </li>
                )
              })}
          </ul>
        )}
      </Card>
    </div>
  )
}
