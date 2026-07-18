// Мастер онбординга: имя → профиль здоровья → важные разделы → тема →
// уведомления → готово. Показывается на «чистом» устройстве (первый запуск)
// ИЛИ по кнопке «Пересмотреть профиль» из Настроек (onboardingOpen).
// Все поля префиллятся из текущих данных — из Настроек это «пересмотр», не сброс.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, ArrowRight, ArrowLeft, Check, Bell } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, SegmentedControl, Checkbox } from './ui'
import { applyTheme } from '../lib/theme'
import { useFocusTrap } from '../lib/focusTrap'
import { getNotifPermission, requestNotifPermission, type NotifPermission } from '../services/notifications'
import { PalettePicker } from './PalettePicker'
import { CurrencySelect } from './CurrencySelect'
import {
  ALL_WIDGETS,
  COUNTRIES,
  type ActivityLevel,
  type Currency,
  type Goal,
  type HealthProfile,
  type Language,
  type Palette,
  type Sex,
  type ThemeMode,
  type WidgetId,
} from '../types'

const STEPS = 6 // имя, профиль, разделы, тема, уведомления, готово

export function Onboarding() {
  const { t, i18n } = useTranslation()
  const settings = useStore((s) => s.data.settings)
  const hp = useStore((s) => s.data.healthProfile)
  const currentWidgets = useStore((s) => s.data.dashboardWidgets)
  const complete = useStore((s) => s.completeOnboarding)

  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.userName ?? '')

  // тема/язык/валюта (живой предпросмотр)
  const [lang, setLang] = useState<Language>(settings.language)
  const [cur, setCur] = useState<Currency>(settings.baseCurrency)
  const [country, setCountry] = useState<string>(settings.country ?? '')
  const [theme, setTheme] = useState<ThemeMode>(settings.theme)
  const [palette, setPalette] = useState<Palette>(settings.palette ?? 'classic')

  // профиль здоровья (префилл из существующего; числа — строками для полей)
  const [sex, setSex] = useState<Sex>(hp?.sex ?? 'female')
  const [age, setAge] = useState(hp ? String(hp.age) : '')
  const [height, setHeight] = useState(hp ? String(hp.height) : '')
  const [weight, setWeight] = useState(hp ? String(hp.weight) : '')
  const [goalWeight, setGoalWeight] = useState(hp ? String(hp.goalWeight) : '')
  const [activity, setActivity] = useState<ActivityLevel>(hp?.activity ?? 'moderate')
  const [goal, setGoal] = useState<Goal>(hp?.goal ?? 'maintain')
  const [cycle, setCycle] = useState(settings.cycleEnabled ?? false)

  // важные разделы (виджеты главного экрана)
  const [widgets, setWidgets] = useState<string[]>(currentWidgets)

  // разрешение на уведомления
  const [notifPerm, setNotifPerm] = useState<NotifPermission>('unsupported')
  useEffect(() => {
    let alive = true
    void getNotifPermission().then((p) => alive && setNotifPerm(p))
    return () => {
      alive = false
    }
  }, [])

  // фокус-ловушка (мастер поверх живого приложения); первый фокус — в панель
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, panelRef, 'first')
  // при смене шага фокус на заголовок (иначе падал бы на фоновое приложение)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const prevStep = useRef(-1)
  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step
    stepHeadingRef.current?.focus()
  }, [step])

  function previewTheme(v: ThemeMode) {
    setTheme(v)
    applyTheme(v, palette)
  }
  function previewPalette(v: Palette) {
    setPalette(v)
    applyTheme(theme, v)
  }
  function previewLang(v: Language) {
    setLang(v)
    void i18n.changeLanguage(v)
  }

  const widgetName: Record<WidgetId, string> = {
    reminders: t('dashboard.wReminders'),
    finance: t('dashboard.wFinance'),
    cards: t('dashboard.wCards'),
    tasks: t('dashboard.wTasks'),
    calendar: t('dashboard.wCalendar'),
    water: t('dashboard.wWater'),
    workout: t('dashboard.wWorkout'),
  }

  function toggleWidget(id: string) {
    setWidgets((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  }

  function finish() {
    const ageN = Number(age)
    const heightN = Number(height)
    const weightN = Number(weight)
    const goalN = Number(goalWeight)
    const profileValid =
      [ageN, heightN, weightN, goalN].every((n) => Number.isFinite(n) && n > 0)
    const healthProfile: HealthProfile | null = profileValid
      ? {
          sex,
          age: ageN,
          height: heightN,
          weight: weightN,
          goalWeight: goalN,
          activity,
          goal,
          pace: hp?.pace ?? 0.5,
          updatedAt: '', // проставит стор
        }
      : null
    complete({
      name,
      language: lang,
      baseCurrency: cur,
      country: country || undefined,
      theme,
      palette,
      healthProfile,
      dashboardWidgets: widgets,
      cycleEnabled: sex === 'female' && cycle,
    })
  }

  const heading = 'text-2xl font-bold tracking-tight outline-none'
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto outline-none"
      style={{ background: 'var(--bg)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.title')}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-8">
        {/* прогресс */}
        <div className="mb-8 flex gap-1.5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--accent)' : 'var(--bg-3)' }}
            />
          ))}
        </div>

        {/* Шаг 0 — приветствие + имя */}
        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
              {t('onboarding.title')}
            </h1>
            <p className="mt-3 text-[var(--text-2)]">{t('onboarding.subtitle')}</p>
            <div className="mt-8">
              <Field label={t('onboarding.nameLabel')}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(1)}
                  placeholder={t('onboarding.namePlaceholder')}
                  maxLength={40}
                />
              </Field>
            </div>
            <div className="mt-auto pt-8">
              <Button fullWidth disabled={!name.trim()} onClick={() => setStep(1)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 1 — профиль здоровья (опционально) */}
        {step === 1 && (
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.profileTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.profileSubtitle')}</p>
            </div>
            <Field label={t('health.calcSex')}>
              <SegmentedControl<Sex>
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'female', label: t('health.calcSexFemale') },
                  { value: 'male', label: t('health.calcSexMale') },
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('health.calcAge')}, ${t('health.calcAgeUnit')}`}>
                <input type="number" inputMode="numeric" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
              </Field>
              <Field label={`${t('health.calcHeight')}, ${t('health.calcHeightUnit')}`}>
                <input type="number" inputMode="decimal" min={0} value={height} onChange={(e) => setHeight(e.target.value)} />
              </Field>
              <Field label={`${t('health.calcWeight')}, ${t('health.calcWeightUnit')}`}>
                <input type="number" inputMode="decimal" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
              </Field>
              <Field label={`${t('health.calcGoalWeight')}, ${t('health.calcWeightUnit')}`}>
                <input type="number" inputMode="decimal" min={0} value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
              </Field>
            </div>
            <Field label={t('health.calcGoal')}>
              <SegmentedControl<Goal>
                value={goal}
                onChange={setGoal}
                options={[
                  { value: 'lose', label: t('health.calcGoalLose') },
                  { value: 'maintain', label: t('health.calcGoalMaintain') },
                  { value: 'gain', label: t('health.calcGoalGain') },
                ]}
              />
            </Field>
            <Field label={t('health.calcActivity')}>
              <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
                <option value="sedentary">{t('health.calcActivitySedentary')}</option>
                <option value="light">{t('health.calcActivityLight')}</option>
                <option value="moderate">{t('health.calcActivityModerate')}</option>
                <option value="active">{t('health.calcActivityActive')}</option>
                <option value="very_active">{t('health.calcActivityVeryActive')}</option>
              </select>
            </Field>
            {sex === 'female' && (
              <label className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <Checkbox checked={cycle} onChange={setCycle} label={t('onboarding.cycleLabel')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t('onboarding.cycleLabel')}</span>
                  <span className="block text-xs text-[var(--text-3)]">{t('onboarding.cycleHint')}</span>
                </span>
              </label>
            )}
            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button fullWidth onClick={() => setStep(2)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 2 — важные разделы (виджеты главного) */}
        {step === 2 && (
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.sectionsTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.sectionsSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-1">
              {ALL_WIDGETS.map((id) => (
                <label
                  key={id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Checkbox checked={widgets.includes(id)} onChange={() => toggleWidget(id)} label={widgetName[id]} />
                  <span className="flex-1 text-sm">{widgetName[id]}</span>
                </label>
              ))}
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button fullWidth onClick={() => setStep(3)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 3 — язык, валюта, тема */}
        {step === 3 && (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.prefsTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.prefsSubtitle')}</p>
            </div>
            <Field label={t('settings.language')}>
              <SegmentedControl<Language>
                value={lang}
                onChange={previewLang}
                options={[
                  { value: 'ru', label: 'Русский' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </Field>
            <Field label={t('onboarding.countryLabel')} hint={t('onboarding.countryHint')}>
              <select
                value={country}
                onChange={(e) => {
                  const code = e.target.value
                  setCountry(code)
                  // страна подставляет базовую валюту (с ручным оверрайдом ниже)
                  const c = COUNTRIES.find((x) => x.code === code)
                  if (c) setCur(c.currency)
                }}
              >
                <option value="">—</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {lang === 'ru' ? c.ru : c.en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('settings.baseCurrency')}>
              <CurrencySelect value={cur} onChange={setCur} />
            </Field>
            <Field label={t('settings.theme')}>
              <SegmentedControl<ThemeMode>
                value={theme}
                onChange={previewTheme}
                options={[
                  { value: 'light', label: t('settings.themeLight'), icon: <Sun size={15} /> },
                  { value: 'dark', label: t('settings.themeDark'), icon: <Moon size={15} /> },
                  { value: 'system', label: t('settings.themeSystem'), icon: <Monitor size={15} /> },
                ]}
              />
            </Field>
            <Field label={t('settings.palette')}>
              {/* карточки-превью с описанием характера (живой предпросмотр темы) */}
              <PalettePicker value={palette} onChange={previewPalette} />
            </Field>
            <div className="mt-auto flex gap-2 pt-6">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button fullWidth onClick={() => setStep(4)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 4 — уведомления */}
        {step === 4 && (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.notifyTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.notifySubtitle')}</p>
            </div>
            <div
              className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
            >
              <Bell size={30} />
            </div>
            <div className="text-center text-sm">
              {notifPerm === 'granted' && (
                <p style={{ color: 'var(--success-text)' }}>✓ {t('onboarding.notifyOn')}</p>
              )}
              {notifPerm === 'denied' && <p className="text-[var(--text-3)]">{t('onboarding.notifyBlocked')}</p>}
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              {notifPerm === 'default' && (
                <Button
                  fullWidth
                  onClick={async () => {
                    const ok = await requestNotifPermission()
                    setNotifPerm(ok ? 'granted' : 'denied')
                  }}
                >
                  {t('onboarding.notifyEnable')}
                </Button>
              )}
              <Button fullWidth onClick={() => setStep(5)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 5 — готово */}
        {step === 5 && (
          <div className="flex flex-1 flex-col text-center">
            <div
              className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
            >
              <Check size={32} />
            </div>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="mt-6 text-2xl font-bold tracking-tight text-balance outline-none">
              {t('onboarding.finishTitle', { name: name.trim() })}
            </h1>
            <p className="mt-3 text-[var(--text-2)]">{t('onboarding.finishText')}</p>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <Button fullWidth onClick={finish}>{t('onboarding.start')}</Button>
              <Button variant="ghost" onClick={() => setStep(4)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            </div>
          </div>
        )}

        {/* пропустить весь мастер — кроме финального шага */}
        {step < 5 && (
          <button
            onClick={finish}
            className="mt-4 text-center text-xs text-[var(--text-3)] underline underline-offset-2"
          >
            {t('onboarding.skip')}
          </button>
        )}
      </div>
    </div>
  )
}
