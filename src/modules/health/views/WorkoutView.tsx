import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ExternalLink, Activity, Dumbbell } from 'lucide-react'
import { useStore } from '../../../store'
import { Card } from '../../../components/ui'
import type { Equipment } from '../../../types'
import { generatePlan, type SessionFocus } from '../workout'
import { techniqueLink } from '../exercises'

const EQUIPMENT: Equipment[] = ['none', 'dumbbell', 'gym']
const DAYS = [1, 2, 3, 4, 5, 6]

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

  const equipment: Equipment = prefs?.equipment ?? 'none'
  const daysPerWeek = prefs?.daysPerWeek ?? 3
  const goal = profile?.goal ?? 'lose'

  const plan = useMemo(
    () => generatePlan(goal, daysPerWeek, equipment),
    [goal, daysPerWeek, equipment],
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
    none: t('health.wkEqNone'),
    dumbbell: t('health.wkEqDumbbell'),
    gym: t('health.wkEqGym'),
  }
  const goalLabel: Record<string, string> = {
    lose: t('health.wkGoalLose'),
    maintain: t('health.wkGoalMaintain'),
    gain: t('health.wkGoalGain'),
  }

  return (
    <div>
      {/* Управление */}
      <Card className="mb-4">
        <div className="mb-3">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
            {t('health.wkEquipment')}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {EQUIPMENT.map((eq) => (
              <button
                key={eq}
                onClick={() => setFitnessPrefs({ equipment: eq, daysPerWeek })}
                className="rounded-lg border px-2 py-2 text-sm transition-colors"
                style={{
                  borderColor: equipment === eq ? 'var(--accent)' : 'var(--border)',
                  background:
                    equipment === eq
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                  color: equipment === eq ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {eqLabel[eq]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
            {t('health.wkDays')}
          </span>
          <div className="grid grid-cols-6 gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => setFitnessPrefs({ equipment, daysPerWeek: d })}
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
