import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startOfWeek } from 'date-fns'
import { ChevronDown, ExternalLink, Activity, Dumbbell, Check, Trash2, CalendarCheck } from 'lucide-react'
import { useStore } from '../../../store'
import { Card, Button, IconButton, Empty } from '../../../components/ui'
import { Heatmap } from '../../../components/Heatmap'
import type { Equipment } from '../../../types'
import { todayISO, toISODate } from '../../../lib/id'
import { generatePlan, type SessionFocus } from '../workout'
import { techniqueLink, SELECTABLE_EQUIPMENT } from '../exercises'

const DAYS = [1, 2, 3, 4, 5, 6]

// поддержка старого формата (один тип) → массив
function normalizeOwned(eq: unknown): Equipment[] {
  if (Array.isArray(eq)) return eq as Equipment[]
  if (eq === 'dumbbell') return ['dumbbell']
  if (eq === 'gym')
    return ['dumbbell', 'barbell', 'kettlebell', 'bands', 'pullupbar', 'treadmill', 'bike', 'machines']
  return []
}

const FOCUS_KEY: Record<SessionFocus, string> = {
  fullbody: 'wkFocusFullbody',
  upper: 'wkFocusUpper',
  lower: 'wkFocusLower',
  push: 'wkFocusPush',
  pull: 'wkFocusPull',
  legs: 'wkFocusLegs',
}

export default function WorkoutView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'

  const profile = useStore((s) => s.data.healthProfile)
  const prefs = useStore((s) => s.data.fitnessPrefs)
  const setFitnessPrefs = useStore((s) => s.setFitnessPrefs)
  const workoutLog = useStore((s) => s.data.workoutLog)
  const addWorkoutLog = useStore((s) => s.addWorkoutLog)
  const deleteWorkoutLog = useStore((s) => s.deleteWorkoutLog)

  const daysPerWeek = prefs?.daysPerWeek ?? 3
  const goal = profile?.goal ?? 'lose'
  const owned = useMemo(() => normalizeOwned(prefs?.equipment), [prefs])

  function toggleEquipment(e: Equipment) {
    // читаем свежее состояние из стора (на случай быстрых кликов подряд)
    const p = useStore.getState().data.fitnessPrefs
    const current = normalizeOwned(p?.equipment)
    const next = current.includes(e) ? current.filter((x) => x !== e) : [...current, e]
    setFitnessPrefs({ equipment: next, daysPerWeek: p?.daysPerWeek ?? daysPerWeek })
  }

  const plan = useMemo(
    () => generatePlan(goal, daysPerWeek, owned),
    [goal, daysPerWeek, owned],
  )

  const today = todayISO()
  const doneToday = workoutLog.some((w) => w.date === today)

  // Предложенная тренировка: следующая в ротации сплита по числу выполненных.
  const suggestIdx = plan.sessions.length ? workoutLog.length % plan.sessions.length : 0
  const suggested = plan.sessions[suggestIdx]

  const focusLabel = (focus: string) =>
    FOCUS_KEY[focus as SessionFocus] ? t(`health.${FOCUS_KEY[focus as SessionFocus]}`) : focus

  function markDone() {
    if (suggested) addWorkoutLog({ date: today, focus: suggested.focus })
  }

  // Данные для heatmap и статистики
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const w of workoutLog) m[w.date] = (m[w.date] ?? 0) + 1
    return m
  }, [workoutLog])

  const year = new Date().getFullYear()
  const totalYear = workoutLog.filter((w) => w.date.startsWith(String(year))).length
  const weekStart = toISODate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const thisWeek = workoutLog.filter((w) => w.date >= weekStart).length

  const feed = useMemo(
    () => [...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [workoutLog],
  )

  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const eqLabel: Record<Equipment, string> = {
    bodyweight: t('health.wkEqBodyweight'),
    dumbbell: t('health.wkEqDumbbell'),
    barbell: t('health.wkEqBarbell'),
    kettlebell: t('health.wkEqKettlebell'),
    bands: t('health.wkEqBands'),
    pullupbar: t('health.wkEqPullupbar'),
    treadmill: t('health.wkEqTreadmill'),
    bike: t('health.wkEqBike'),
    machines: t('health.wkEqMachines'),
  }
  const goalLabel: Record<string, string> = {
    lose: t('health.wkGoalLose'),
    maintain: t('health.wkGoalMaintain'),
    gain: t('health.wkGoalGain'),
  }

  return (
    <div>
      {/* Тренировка на сегодня */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <CalendarCheck size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold">{t('health.wkToday')}</h3>
        </div>
        {suggested ? (
          <>
            <div className="mb-1 text-base font-medium">{focusLabel(suggested.focus)}</div>
            <div className="mb-3 text-xs text-[var(--text-3)]">
              {suggested.items
                .map((it) => it.exercise[lang])
                .slice(0, 4)
                .join(' · ')}
            </div>
            {doneToday ? (
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: 'var(--success)' }}
                >
                  <Check size={16} /> {t('health.wkDoneToday')}
                </span>
                <Button variant="subtle" onClick={markDone}>
                  {t('health.wkAddAgain')}
                </Button>
              </div>
            ) : (
              <Button onClick={markDone}>
                <Check size={16} /> {t('health.wkMarkDone')}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-3)]">—</p>
        )}
      </Card>

      {/* Лента активности + heatmap */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={16} style={{ color: 'var(--accent)' }} />
            {t('health.wkActivityFeed')}
          </h3>
          <div className="flex gap-3 text-xs text-[var(--text-3)]">
            <span>{t('health.wkThisWeek', { count: thisWeek })}</span>
            <span>{t('health.wkThisYear', { count: totalYear })}</span>
          </div>
        </div>

        <Heatmap
          counts={counts}
          year={year}
          lang={lang}
          today={today}
          tooltip={(iso, count) =>
            `${iso} — ${count > 0 ? t('health.wkHeatmapCount', { count }) : t('health.wkHeatmapNone')}`
          }
        />

        {feed.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {feed.map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: 'var(--bg-2)' }}
              >
                <Dumbbell size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm">{focusLabel(w.focus)}</span>
                <span className="ml-auto text-xs text-[var(--text-3)] tabular-nums">{w.date}</span>
                <IconButton onClick={() => deleteWorkoutLog(w.id)} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<Activity size={24} />} text={t('health.wkFeedEmpty')} />
        )}
      </Card>

      {/* Управление */}
      <Card className="mb-4">
        <div className="mb-3">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
            {t('health.wkEquipment')}
          </span>
          <div className="flex flex-wrap gap-2">
            {SELECTABLE_EQUIPMENT.map((eq) => {
              const active = owned.includes(eq)
              return (
                <button
                  key={eq}
                  onClick={() => toggleEquipment(eq)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                  }}
                >
                  {eqLabel[eq]}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-3)]">{t('health.wkEquipmentHint')}</p>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
            {t('health.wkDays')}
          </span>
          <div className="grid grid-cols-6 gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setFitnessPrefs({ equipment: owned, daysPerWeek: d })}
                className="rounded-lg border py-2 text-sm tabular-nums transition-colors"
                style={{
                  borderColor: daysPerWeek === d ? 'var(--accent)' : 'var(--border)',
                  background:
                    daysPerWeek === d
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                  color: daysPerWeek === d ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Норма активности в неделю */}
      <Card className="mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold">{t('health.wkWeeklyTitle')}</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          {t('health.wkTrainingDays', { count: plan.daysPerWeek })}
        </p>
        <p className="text-sm text-[var(--text-2)]">
          {t('health.wkCardioPerWeek', {
            min: plan.cardioMinPerWeek[0],
            max: plan.cardioMinPerWeek[1],
          })}
        </p>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          {t('health.wkForGoal')}: {goalLabel[goal]}
        </p>
      </Card>

      {/* Тренировки — раскрывающиеся */}
      <div className="space-y-2">
        {plan.sessions.map((session, i) => {
          const isOpen = open.has(i)
          return (
            <div
              key={i}
              className="overflow-hidden rounded-xl border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <Dumbbell size={16} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-medium">
                    {t('health.wkDay', { n: i + 1 })} · {t(`health.${FOCUS_KEY[session.focus]}`)}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className="text-[var(--text-3)] transition-transform"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {isOpen && (
                <ul className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {session.items.map((it, j) => (
                    <li
                      key={j}
                      className="flex items-center justify-between gap-2 px-4 py-2.5"
                      style={{ borderTop: j === 0 ? 'none' : '1px solid var(--border)' }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm">{it.exercise[lang]}</div>
                        <div className="text-xs text-[var(--text-3)]">
                          {it.minutes != null
                            ? t('health.wkMinutes', { min: it.minutes })
                            : t('health.wkSetsReps', { sets: it.sets, reps: it.reps })}
                        </div>
                      </div>
                      <a
                        href={techniqueLink(it.exercise, lang)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('health.wkTechnique')}
                        aria-label={t('health.wkTechnique')}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)]"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-[var(--text-3)]">{t('health.wkHint')}</p>
    </div>
  )
}
