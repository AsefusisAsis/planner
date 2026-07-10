import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startOfWeek } from 'date-fns'
import {
  ChevronDown,
  ExternalLink,
  Activity,
  Dumbbell,
  Check,
  Trash2,
  CalendarCheck,
  Home as HomeIcon,
  Building2,
  Flame,
} from 'lucide-react'
import { useStore } from '../../../store'
import { useVoice } from '../../../lib/voice'
import { Card, Button, IconButton, Empty, Field, Modal, SegmentedControl } from '../../../components/ui'
import { Heatmap } from '../../../components/Heatmap'
import type { Equipment } from '../../../types'
import { todayISO, toISODate } from '../../../lib/id'
import { generatePlan, estimateCalories, GYM_TYPES, type SessionFocus, type GymType } from '../workout'
import { techniqueLink, SELECTABLE_EQUIPMENT } from '../exercises'

const DAYS = [1, 2, 3, 4, 5, 6]

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
const GYM_KEY: Record<GymType, string> = {
  strength: 'wkGymStrength',
  cardio: 'wkGymCardio',
  trainer: 'wkGymTrainer',
  functional: 'wkGymFunctional',
}

export default function WorkoutView() {
  const { t, i18n } = useTranslation()
  const vt = useVoice()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'

  const profile = useStore((s) => s.data.healthProfile)
  const prefs = useStore((s) => s.data.fitnessPrefs)
  const setFitnessPrefs = useStore((s) => s.setFitnessPrefs)
  const workoutLog = useStore((s) => s.data.workoutLog)
  const addWorkoutLog = useStore((s) => s.addWorkoutLog)
  const deleteWorkoutLog = useStore((s) => s.deleteWorkoutLog)

  const weight = profile?.weight
  const daysPerWeek = prefs?.daysPerWeek ?? 3
  const goal = profile?.goal ?? 'lose'
  const owned = useMemo(() => normalizeOwned(prefs?.equipment), [prefs])

  const [mode, setMode] = useState<'home' | 'gym'>('home')
  const [gymType, setGymType] = useState<GymType>('strength')

  function toggleEquipment(e: Equipment) {
    const p = useStore.getState().data.fitnessPrefs
    const current = normalizeOwned(p?.equipment)
    const next = current.includes(e) ? current.filter((x) => x !== e) : [...current, e]
    setFitnessPrefs({ equipment: next, daysPerWeek: p?.daysPerWeek ?? daysPerWeek })
  }

  const plan = useMemo(() => generatePlan(goal, daysPerWeek, owned), [goal, daysPerWeek, owned])

  const today = todayISO()
  const doneToday = workoutLog.some((w) => w.date === today)
  // Ротация домашнего плана — только по домашним тренировкам, зальные её не сбивают
  const homeLogCount = workoutLog.filter((w) => (w.place ?? 'home') === 'home').length
  const suggestIdx = plan.sessions.length ? homeLogCount % plan.sessions.length : 0
  const suggested = plan.sessions[suggestIdx]

  const focusLabel = (focus: string) =>
    FOCUS_KEY[focus as SessionFocus] ? t(`health.${FOCUS_KEY[focus as SessionFocus]}`) : focus
  const gymLabel = (type: string) => (GYM_KEY[type as GymType] ? t(`health.${GYM_KEY[type as GymType]}`) : type)
  const entryLabel = (w: { place?: string; focus: string }) =>
    w.place === 'gym' ? gymLabel(w.focus) : focusLabel(w.focus)

  // ---- лог-модалка ----
  const [logOpen, setLogOpen] = useState(false)
  const [logPlace, setLogPlace] = useState<'home' | 'gym'>('home')
  const [logFocus, setLogFocus] = useState<string>('fullbody')
  const [logDuration, setLogDuration] = useState('45')
  const [logCalories, setLogCalories] = useState('')
  const [calTouched, setCalTouched] = useState(false)

  const estFor = (focus: string, durStr: string) => {
    const d = Number(durStr)
    return Number.isFinite(d) && d > 0 ? estimateCalories(focus, weight, d) : 0
  }
  function openLog(place: 'home' | 'gym', focus: string, dur = place === 'gym' ? '60' : '45') {
    setLogPlace(place)
    setLogFocus(focus)
    setLogDuration(dur)
    setCalTouched(false)
    setLogCalories(String(estFor(focus, dur)))
    setLogOpen(true)
  }
  function changeDuration(v: string) {
    setLogDuration(v)
    if (!calTouched) setLogCalories(String(estFor(logFocus, v)))
  }
  function saveLog() {
    const dur = Number(logDuration)
    const cal = Number(logCalories)
    addWorkoutLog({
      date: today,
      place: logPlace,
      focus: logFocus,
      durationMin: Number.isFinite(dur) && dur > 0 ? dur : undefined,
      calories: Number.isFinite(cal) && cal > 0 ? cal : undefined,
    })
    setLogOpen(false)
  }

  // ---- статистика / heatmap ----
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const w of workoutLog) m[w.date] = (m[w.date] ?? 0) + 1
    return m
  }, [workoutLog])

  const year = new Date().getFullYear()
  const weekStart = toISODate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const yearLogs = workoutLog.filter((w) => w.date.startsWith(String(year)))
  const weekLogs = workoutLog.filter((w) => w.date >= weekStart)
  const totalYear = yearLogs.length
  const thisWeek = weekLogs.length
  const calWeek = weekLogs.reduce((s, w) => s + (w.calories ?? 0), 0)

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
      {/* Режим: дома / в зале */}
      <SegmentedControl<'home' | 'gym'>
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'home', label: t('health.wkModeHome'), icon: <HomeIcon size={15} /> },
          { value: 'gym', label: t('health.wkModeGym'), icon: <Building2 size={15} /> },
        ]}
      />

      {mode === 'home' ? (
        /* Тренировка на сегодня (дом) */
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <CalendarCheck size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-semibold">{t('health.wkToday')}</h3>
          </div>
          {suggested ? (
            <>
              <div className="mb-1 text-base font-medium">{focusLabel(suggested.focus)}</div>
              <div className="mb-3 text-xs text-[var(--text-3)]">
                {suggested.items.map((it) => it.exercise[lang]).slice(0, 4).join(' · ')}
              </div>
              {doneToday ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--success)' }}>
                    <Check size={16} /> {t('health.wkDoneToday')}
                  </span>
                  <Button variant="subtle" onClick={() => openLog('home', suggested.focus)}>
                    {t('health.wkAddAgain')}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => openLog('home', suggested.focus)}>
                  <Check size={16} /> {t('health.wkMarkDone')}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--text-3)]">—</p>
          )}
        </Card>
      ) : (
        /* Записать тренировку в зале */
        <Card className="mb-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-semibold">{t('health.wkGymTitle')}</h3>
          </div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">{t('health.wkGymType')}</span>
          <SegmentedControl<GymType>
            className="mb-3"
            value={gymType}
            onChange={setGymType}
            options={GYM_TYPES.map((gt) => ({ value: gt, label: gymLabel(gt) }))}
          />
          <Button onClick={() => openLog('gym', gymType)}>
            <Check size={16} /> {t('health.wkLogBtn')}
          </Button>
        </Card>
      )}

      {/* Лента активности + heatmap */}
      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={16} style={{ color: 'var(--accent)' }} />
            {t('health.wkActivityFeed')}
          </h3>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-3)]">
            <span className="tnum">{t('health.wkThisWeek', { count: thisWeek })}</span>
            <span className="tnum">{t('health.wkThisYear', { count: totalYear })}</span>
            {calWeek > 0 && (
              <span className="inline-flex items-center gap-1 tnum" style={{ color: 'var(--warning)' }}>
                <Flame size={12} /> {t('health.wkBurnedWeek', { cal: calWeek })}
              </span>
            )}
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
              <li key={w.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-2)' }}>
                {w.place === 'gym' ? (
                  <Building2 size={14} style={{ color: 'var(--accent)' }} />
                ) : (
                  <HomeIcon size={14} style={{ color: 'var(--accent)' }} />
                )}
                <span className="min-w-0 truncate text-sm">{entryLabel(w)}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--text-3)] tabular-nums">
                  {w.durationMin ? `${w.durationMin} ${t('health.wkMinUnit')}` : ''}
                  {w.durationMin && w.calories ? ' · ' : ''}
                  {w.calories ? `${w.calories} ${t('health.wkKcalUnit')}` : ''}
                </span>
                <IconButton danger big onClick={() => deleteWorkoutLog(w.id)} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<Activity size={24} />} text={vt('health.wkFeedEmpty')} />
        )}
      </Card>

      {/* Норма активности в неделю */}
      <Card className="mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold">{t('health.wkWeeklyTitle')}</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--text-2)] tnum">{t('health.wkTrainingDays', { count: plan.daysPerWeek })}</p>
        <p className="text-sm text-[var(--text-2)] tnum">
          {t('health.wkCardioPerWeek', { min: plan.cardioMinPerWeek[0], max: plan.cardioMinPerWeek[1] })}
        </p>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          {t('health.wkForGoal')}: {goalLabel[goal]}
        </p>
      </Card>

      {/* Дом: инвентарь + план */}
      {mode === 'home' && (
        <>
          <Card className="mb-4">
            <div className="mb-3">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">{t('health.wkEquipment')}</span>
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
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">{t('health.wkDays')}</span>
              <div className="grid grid-cols-6 gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setFitnessPrefs({ equipment: owned, daysPerWeek: d })}
                    className="rounded-lg border py-2 text-sm tabular-nums transition-colors"
                    style={{
                      borderColor: daysPerWeek === d ? 'var(--accent)' : 'var(--border)',
                      background: daysPerWeek === d ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                      color: daysPerWeek === d ? 'var(--accent)' : 'var(--text-2)',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {plan.sessions.map((session, i) => {
              const isOpen = open.has(i)
              return (
                <div key={i} className="overflow-hidden rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <button onClick={() => toggle(i)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <span className="flex items-center gap-2">
                      <Dumbbell size={16} style={{ color: 'var(--accent)' }} />
                      <span className="text-sm font-medium">
                        {t('health.wkDay', { n: i + 1 })} · {t(`health.${FOCUS_KEY[session.focus]}`)}
                      </span>
                    </span>
                    <ChevronDown size={16} className="text-[var(--text-3)] transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {isOpen && (
                    <ul className="border-t" style={{ borderColor: 'var(--border)' }}>
                      {session.items.map((it, j) => (
                        <li key={j} className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderTop: j === 0 ? 'none' : '1px solid var(--border)' }}>
                          <div className="min-w-0">
                            <div className="truncate text-sm">{it.exercise[lang]}</div>
                            <div className="text-xs text-[var(--text-3)]">
                              {it.minutes != null ? t('health.wkMinutes', { min: it.minutes }) : t('health.wkSetsReps', { sets: it.sets, reps: it.reps })}
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
        </>
      )}

      {/* Модалка записи тренировки */}
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title={t('health.wkLogTitle')}>
        <p className="mb-3 text-sm font-medium">
          {logPlace === 'gym' ? gymLabel(logFocus) : focusLabel(logFocus)}
        </p>
        <Field label={t('health.wkDuration')}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={logDuration}
            onChange={(e) => changeDuration(e.target.value)}
          />
        </Field>
        <Field label={t('health.wkCalories')}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={logCalories}
            onChange={(e) => {
              setCalTouched(true)
              setLogCalories(e.target.value)
            }}
          />
        </Field>
        <p className="mb-3 -mt-1 text-xs text-[var(--text-3)] tnum">
          {t('health.wkEstimateHint', { n: estFor(logFocus, logDuration) })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setLogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={saveLog}>{t('health.wkSaveLog')}</Button>
        </div>
      </Modal>
    </div>
  )
}
