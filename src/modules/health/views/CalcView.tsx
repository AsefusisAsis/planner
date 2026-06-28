import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Droplet, Flame, HeartPulse, Scale } from 'lucide-react'
import type { ActivityLevel, Goal, HealthProfile, Sex } from '../../../types'
import { useStore } from '../../../store'
import { Button, Card, Field } from '../../../components/ui'
import { Donut, type DonutSegment } from '../../../components/Donut'
import {
  computeHealth,
  PACES,
  ACTIVITY_RECOMMENDATION,
  type BmiCategory,
  type HealthWarning,
} from '../calc'

interface ProfileForm {
  sex: Sex
  age: string
  height: string
  weight: string
  goalWeight: string
  activity: ActivityLevel
  goal: Goal
  pace: number
}

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

const ACTIVITY_LABEL_KEY: Record<ActivityLevel, string> = {
  sedentary: 'calcActivitySedentary',
  light: 'calcActivityLight',
  moderate: 'calcActivityModerate',
  active: 'calcActivityActive',
  very_active: 'calcActivityVeryActive',
}

const GOAL_LABEL_KEY: Record<Goal, string> = {
  lose: 'calcGoalLoseLabel',
  maintain: 'calcGoalMaintainLabel',
  gain: 'calcGoalGainLabel',
}

const BMI_LABEL_KEY: Record<BmiCategory, string> = {
  underweight: 'calcBmiUnderweight',
  normal: 'calcBmiNormal',
  overweight: 'calcBmiOverweight',
  obese: 'calcBmiObese',
}

const BMI_COLOR: Record<BmiCategory, string> = {
  underweight: 'var(--warning)',
  normal: 'var(--success)',
  overweight: 'var(--warning)',
  obese: 'var(--danger)',
}

const WARN_KEY: Record<HealthWarning, string> = {
  kcal_floor: 'calcWarnKcalFloor',
  pace_too_fast: 'calcWarnPaceTooFast',
  underweight_lose: 'calcWarnUnderweightLose',
  goal_direction: 'calcWarnGoalDirection',
}

function formFromProfile(p: HealthProfile | null): ProfileForm {
  if (!p) {
    return {
      sex: 'male',
      age: '',
      height: '',
      weight: '',
      goalWeight: '',
      activity: 'moderate',
      goal: 'lose',
      pace: 0.5,
    }
  }
  return {
    sex: p.sex,
    age: String(p.age),
    height: String(p.height),
    weight: String(p.weight),
    goalWeight: String(p.goalWeight),
    activity: p.activity,
    goal: p.goal,
    pace: p.pace,
  }
}

export default function CalcView() {
  const { t } = useTranslation()
  const profile = useStore((s) => s.data.healthProfile)
  const setHealthProfile = useStore((s) => s.setHealthProfile)

  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile))

  const age = Number(form.age)
  const height = Number(form.height)
  const weight = Number(form.weight)
  const goalWeight = Number(form.goalWeight)

  const valid =
    Number.isFinite(age) && age > 0 &&
    Number.isFinite(height) && height > 0 &&
    Number.isFinite(weight) && weight > 0 &&
    Number.isFinite(goalWeight) && goalWeight > 0

  function submit() {
    if (!valid) return
    setHealthProfile({
      sex: form.sex,
      age,
      height,
      weight,
      goalWeight,
      activity: form.activity,
      goal: form.goal,
      pace: form.pace,
      updatedAt: new Date().toISOString(),
    })
  }

  const result = useMemo(() => (profile ? computeHealth(profile) : null), [profile])

  const macroSegments = useMemo<DonutSegment[]>(() => {
    if (!result) return []
    const { protein, fat, carbs } = result.macros
    return [
      { label: t('health.calcProtein'), value: protein * 4, color: 'var(--success)' },
      { label: t('health.calcFat'), value: fat * 9, color: 'var(--warning)' },
      { label: t('health.calcCarbs'), value: carbs * 4, color: 'var(--accent)' },
    ]
  }, [result, t])

  return (
    <div className="space-y-4">
      {/* ---- Форма профиля ---- */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <HeartPulse size={16} /> {t('health.calcFormTitle')}
        </h2>

        <Field label={t('health.calcSex')}>
          <Segment
            value={form.sex}
            options={[
              { value: 'male', label: t('health.calcSexMale') },
              { value: 'female', label: t('health.calcSexFemale') },
            ]}
            onChange={(sex) => setForm((f) => ({ ...f, sex }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('health.calcAge')}, ${t('health.calcAgeUnit')}`}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            />
          </Field>
          <Field label={`${t('health.calcHeight')}, ${t('health.calcHeightUnit')}`}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.height}
              onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
            />
          </Field>
          <Field label={`${t('health.calcWeight')}, ${t('health.calcWeightUnit')}`}>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="0.1"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            />
          </Field>
          <Field label={`${t('health.calcGoalWeight')}, ${t('health.calcWeightUnit')}`}>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step="0.1"
              value={form.goalWeight}
              onChange={(e) => setForm((f) => ({ ...f, goalWeight: e.target.value }))}
            />
          </Field>
        </div>

        <Field label={t('health.calcActivity')}>
          <select
            value={form.activity}
            onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value as ActivityLevel }))}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a} value={a}>
                {t(`health.${ACTIVITY_LABEL_KEY[a]}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('health.calcGoal')}>
          <Segment
            value={form.goal}
            options={[
              { value: 'lose', label: t('health.calcGoalLose') },
              { value: 'maintain', label: t('health.calcGoalMaintain') },
              { value: 'gain', label: t('health.calcGoalGain') },
            ]}
            onChange={(goal) => setForm((f) => ({ ...f, goal }))}
          />
        </Field>

        {form.goal !== 'maintain' && (
          <Field label={`${t('health.calcPace')}, ${t('health.calcPaceUnit')}`}>
            <select
              value={form.pace}
              onChange={(e) => setForm((f) => ({ ...f, pace: Number(e.target.value) }))}
            >
              {PACES.map((p) => (
                <option key={p} value={p}>
                  {p.toFixed(2)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button className="mt-1 w-full" onClick={submit} disabled={!valid}>
          <Flame size={16} /> {profile ? t('health.calcRecompute') : t('health.calcCompute')}
        </Button>
      </Card>

      {/* ---- Результат / приглашение ---- */}
      {!profile || !result ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <HeartPulse size={28} className="text-[var(--text-3)]" />
            <p className="text-sm font-medium">{t('health.calcInviteTitle')}</p>
            <p className="max-w-sm text-sm text-[var(--text-3)]">{t('health.calcInvite')}</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Главное число */}
          <Card>
            <div className="flex flex-col items-center py-2 text-center">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {t('health.calcResultTitle')}
              </span>
              <span className="mt-1 text-4xl font-bold" style={{ color: 'var(--accent)' }}>
                {result.targetKcal}
              </span>
              <span className="text-sm text-[var(--text-2)]">{t('health.calcTargetUnit')}</span>
              <span className="mt-1 text-xs text-[var(--text-3)]">
                {t(`health.${GOAL_LABEL_KEY[profile.goal]}`)}
              </span>
            </div>
          </Card>

          {/* Метрики */}
          <Card>
            <div className="space-y-2.5">
              <StatRow
                icon={<Flame size={15} />}
                label={t('health.calcBmr')}
                value={`${result.bmr} ${t('health.calcTargetUnit')}`}
              />
              <StatRow
                icon={<Activity size={15} />}
                label={t('health.calcTdee')}
                value={`${result.tdee} ${t('health.calcTargetUnit')}`}
              />
              {result.appliedDelta !== 0 && (
                <StatRow
                  icon={<Scale size={15} />}
                  label={result.appliedDelta < 0 ? t('health.calcDeficit') : t('health.calcSurplus')}
                  value={`${result.appliedDelta > 0 ? '+' : ''}${result.appliedDelta} ${t('health.calcDeltaUnit')}`}
                  valueColor={result.appliedDelta < 0 ? 'var(--success)' : 'var(--accent)'}
                />
              )}
              <StatRow
                icon={<Droplet size={15} />}
                label={t('health.calcWater')}
                value={`${(result.waterMl / 1000).toFixed(1)} ${t('health.calcWaterUnit')}`}
              />
              <StatRow
                icon={<Scale size={15} />}
                label={t('health.calcBmi')}
                value={
                  <span>
                    {result.bmi}{' '}
                    <span style={{ color: BMI_COLOR[result.bmiCategory] }}>
                      ({t(`health.${BMI_LABEL_KEY[result.bmiCategory]}`)})
                    </span>
                  </span>
                }
              />
              {result.weeksToGoal != null && (
                <StatRow
                  icon={<HeartPulse size={15} />}
                  label={t('health.calcWeeks')}
                  value={`${result.weeksToGoal} ${t('health.calcWeeksUnit')}`}
                />
              )}
            </div>
          </Card>

          {/* БЖУ */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">
              {t('health.calcMacrosTitle')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <MacroBox
                label={t('health.calcProtein')}
                value={result.macros.protein}
                unit={t('health.calcGramsUnit')}
                color="var(--success)"
              />
              <MacroBox
                label={t('health.calcFat')}
                value={result.macros.fat}
                unit={t('health.calcGramsUnit')}
                color="var(--warning)"
              />
              <MacroBox
                label={t('health.calcCarbs')}
                value={result.macros.carbs}
                unit={t('health.calcGramsUnit')}
                color="var(--accent)"
              />
            </div>

            {/* Кольцевая диаграмма: доли БЖУ по вкладу в калории */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-3 text-xs font-medium text-[var(--text-3)]">
                {t('health.calcMacrosDonutTitle')}
              </h3>
              <Donut
                segments={macroSegments}
                centerTop={String(result.targetKcal)}
                centerBottom={t('health.calcTargetUnit')}
              />
            </div>
          </Card>

          {/* Рекомендация по активности */}
          <Card>
            <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
              <Activity size={16} /> {t('health.calcActivityRecTitle')}
            </h2>
            <p className="text-sm text-[var(--text-2)]">
              {t('health.calcActivityRec', {
                min: ACTIVITY_RECOMMENDATION.aerobicMinPerWeek[0],
                max: ACTIVITY_RECOMMENDATION.aerobicMinPerWeek[1],
                days: ACTIVITY_RECOMMENDATION.strengthDaysPerWeek,
              })}
            </p>
          </Card>

          {/* Предупреждения */}
          {result.warnings.length > 0 && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-[var(--text-2)]">
                {t('health.calcWarnings')}
              </h2>
              <div className="space-y-2">
                {result.warnings.map((w) => {
                  const color = w === 'underweight_lose' ? 'var(--danger)' : 'var(--warning)'
                  return (
                    <div
                      key={w}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{
                        color,
                        borderColor: color,
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                      }}
                    >
                      {t(`health.${WARN_KEY[w]}`)}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Сегмент-кнопки ----------
function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      className="flex gap-1 rounded-lg p-1"
      style={{ background: 'var(--bg-3)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
            style={
              active
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-2)' }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Строка метрики ----------
function StatRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-[var(--text-2)]">
        <span className="text-[var(--text-3)]">{icon}</span>
        {label}
      </span>
      <span className="font-medium" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  )
}

// ---------- Карточка БЖУ ----------
function MacroBox({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div
      className="flex flex-col items-center rounded-lg border px-2 py-3 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="mt-1.5 text-lg font-semibold">{value}</span>
      <span className="text-xs text-[var(--text-3)]">{unit}</span>
      <span className="mt-0.5 text-xs text-[var(--text-2)]">{label}</span>
    </div>
  )
}
