// Мастер онбординга: имя → здоровье → финансы → защита данных → разделы →
// язык/тема/погода → уведомления → готово. Показывается на «чистом»
// устройстве (первый запуск) ИЛИ по кнопке «Пересмотреть профиль» из
// Настроек (onboardingOpen).
//
// Каждый блок приложения участвует в первичной настройке, но мастер остаётся
// МАСТЕРОМ НАСТРОЙКИ: он ничего не создаёт за пользователя (ни задач, ни
// списков, ни карт), только конфигурирует. Решение 02.08.
//
// Все поля префиллятся из текущих данных — из Настроек это «пересмотр», не сброс.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, ArrowRight, ArrowLeft, Check, Bell, UserRound, ShieldCheck, Search } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, SegmentedControl, Checkbox } from './ui'
import { applyTheme } from '../lib/theme'
import { todayISO } from '../lib/id'
import { useFocusTrap } from '../lib/focusTrap'
import { getNotifPermission, requestNotifPermission, type NotifPermission } from '../services/notifications'
import { PalettePicker } from './PalettePicker'
import { CurrencySelect } from './CurrencySelect'
import { AccountSheet } from './AccountSheet'
import { InstallAppCard } from './InstallAppCard'
import { VaultSecretModal } from './VaultSecretModal'
import { geocodeCity } from '../services/weather'
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
  CURRENCIES,
  MAX_TICKER_CURRENCIES,
} from '../types'

/**
 * Шаги по именам, а не по номерам. Вставка шага в середину раньше означала
 * ручную перенумерацию всех переходов «вперёд/назад» — ровно тот случай,
 * когда опечатка тихо уводит не на тот экран.
 */
const S = {
  name: 0,
  health: 1,
  finance: 2,
  vault: 3,
  widgets: 4,
  prefs: 5,
  notify: 6,
  done: 7,
} as const
const STEPS = Object.keys(S).length

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
  // до 3 последних дат старта менструации — чтобы прогноз появился сразу
  const [cycleStarts, setCycleStarts] = useState<string[]>(['', '', ''])
  const today = todayISO()
  // аккаунт (опционально) прямо из онбординга
  const account = useStore((s) => s.account)
  const [accountOpen, setAccountOpen] = useState(false)

  // важные разделы (виджеты главного экрана)
  const [widgets, setWidgets] = useState<string[]>(currentWidgets)

  // ---- финансы ----
  const categories = useStore((s) => s.data.expenseCategories)
  const [ticker, setTicker] = useState<Currency[]>(
    settings.displayCurrencies?.length ? settings.displayCurrencies : (['USD', 'EUR', 'RUB'] as Currency[]),
  )
  // бюджеты строками: пустое поле должно означать «лимита нет», а не ноль
  const [budgets, setBudgets] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.budget ? String(c.budget) : ''])),
  )
  const [taxOn, setTaxOn] = useState(!!settings.taxEnabled)
  const [taxPercent, setTaxPercent] = useState(settings.taxPercent ? String(settings.taxPercent) : '')
  const [taxDay, setTaxDay] = useState(String(settings.taxDayOfMonth ?? 5))

  function toggleTicker(c: Currency) {
    setTicker((list) =>
      list.includes(c)
        ? list.filter((x) => x !== c)
        // молча игнорировать лишний выбор нельзя — потолок общий с тикером,
        // и человек не поймёт, почему валюта не появилась
        : list.length >= MAX_TICKER_CURRENCIES
          ? list
          : [...list, c],
    )
  }

  // ---- защита данных ----
  const vault = useStore((s) => s.data.vault)
  const setupVault = useStore((s) => s.setupVault)
  const [vaultReveal, setVaultReveal] = useState<{ secret: string; uri: string } | null>(null)
  const [vaultBusy, setVaultBusy] = useState(false)
  const [vaultErr, setVaultErr] = useState<string | null>(null)
  async function enableVault() {
    setVaultBusy(true)
    setVaultErr(null)
    try {
      setVaultReveal(await setupVault())
    } catch (e) {
      // причину показываем как есть: «не удалось» без текста бесполезно
      setVaultErr(e instanceof Error ? e.message : 'error')
    } finally {
      setVaultBusy(false)
    }
  }

  // ---- погода ----
  const weatherLocation = useStore((s) => s.data.settings.weatherLocation)
  const setWeatherLocation = useStore((s) => s.setWeatherLocation)
  const [cityQuery, setCityQuery] = useState('')
  const [cityBusy, setCityBusy] = useState(false)
  const [cityErr, setCityErr] = useState<string | null>(null)
  async function findCity() {
    const q = cityQuery.trim()
    if (!q) return
    setCityBusy(true)
    setCityErr(null)
    try {
      const loc = await geocodeCity(q, lang)
      if (!loc) setCityErr(t('settings.weatherNotFound'))
      else {
        await setWeatherLocation(loc)
        setCityQuery('')
      }
    } catch {
      setCityErr(t('settings.weatherError'))
    } finally {
      setCityBusy(false)
    }
  }

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
    nownext: t('dashboard.nowNext'),
    finance: t('dashboard.wFinance'),
    cards: t('dashboard.wCards'),
    tasks: t('dashboard.wTasks'),
    calendar: t('dashboard.wCalendar'),
    shopping: t('dashboard.wShopping'),
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
      cycleStarts:
        sex === 'female' && cycle ? cycleStarts.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : undefined,
      displayCurrencies: ticker,
      // пустое поле — «лимита нет»: отсеиваем до стора, чтобы туда не ехали
      // нули, которые он потом всё равно отбросит
      categoryBudgets: Object.fromEntries(
        Object.entries(budgets)
          .map(([id, v]) => [id, Number(v)] as const)
          .filter(([, n]) => Number.isFinite(n) && n > 0),
      ),
      tax: { enabled: taxOn, percent: Number(taxPercent), dayOfMonth: Number(taxDay) },
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
        {step === S.name && (
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
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(S.health)}
                  placeholder={t('onboarding.namePlaceholder')}
                  maxLength={40}
                />
              </Field>
            </div>
            {/* аккаунт — опционально: войти сразу или позже из шапки */}
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="mt-4 flex min-h-11 items-center gap-2 self-start text-sm text-[var(--accent)]"
            >
              <UserRound size={16} />
              {account ? account.email : t('onboarding.accountCta')}
            </button>
            <p className="mt-1 text-xs text-[var(--text-3)]">{t('onboarding.accountHint')}</p>
            <div className="mt-auto pt-8">
              <Button fullWidth disabled={!name.trim()} onClick={() => setStep(S.health)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 1 — профиль здоровья (опционально) */}
        {step === S.health && (
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
            {/* последние старты менструации — прогноз появится сразу */}
            {sex === 'female' && cycle && (
              <Field label={t('onboarding.cycleStartsLabel')} hint={t('onboarding.cycleStartsHint')}>
                <div className="flex flex-col gap-2">
                  {cycleStarts.map((v, i) => (
                    <input
                      key={i}
                      type="date"
                      value={v}
                      max={today}
                      onChange={(e) =>
                        setCycleStarts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                  ))}
                </div>
              </Field>
            )}
            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setStep(S.name)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button className="flex-1" onClick={() => setStep(S.finance)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг «Финансы» — настройки раздела (не создаём записи за пользователя) */}
        {step === S.finance && (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.financeTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.financeSubtitle')}</p>
            </div>

            <Field label={t('onboarding.tickerLabel')} hint={t('onboarding.tickerHint')}>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCIES.filter((c) => c !== cur).map((c) => {
                  const on = ticker.includes(c)
                  const full = !on && ticker.length >= MAX_TICKER_CURRENCIES
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleTicker(c)}
                      aria-pressed={on}
                      disabled={full}
                      className="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{
                        borderColor: on ? 'var(--accent)' : 'var(--border)',
                        background: on ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--text-2)',
                      }}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label={t('onboarding.budgetsLabel')} hint={t('onboarding.budgetsHint')}>
              <div className="flex flex-col gap-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={budgets[c.id] ?? ''}
                      aria-label={`${t('onboarding.budgetsLabel')}: ${c.name}`}
                      onChange={(e) => setBudgets((b) => ({ ...b, [c.id]: e.target.value }))}
                      className="w-28 shrink-0"
                    />
                    <span className="shrink-0 text-xs text-[var(--text-3)]">{cur}</span>
                  </div>
                ))}
              </div>
            </Field>

            {/* налог показываем свёрнутым: нужен меньшинству, а поля пугают */}
            <label className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
              <Checkbox checked={taxOn} onChange={setTaxOn} label={t('onboarding.taxLabel')} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t('onboarding.taxLabel')}</span>
                <span className="block text-xs text-[var(--text-3)]">{t('onboarding.taxHint')}</span>
              </span>
            </label>
            {taxOn && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('onboarding.taxPercentLabel')}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                  />
                </Field>
                <Field label={t('onboarding.taxDayLabel')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={taxDay}
                    onChange={(e) => setTaxDay(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setStep(S.health)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button className="flex-1" onClick={() => setStep(S.vault)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг «Защита данных» — включение vault прямо здесь */}
        {step === S.vault && (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 ref={stepHeadingRef} tabIndex={-1} className={heading}>
                {t('onboarding.vaultTitle')}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-2)]">{t('onboarding.vaultSubtitle')}</p>
            </div>

            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
                color: 'var(--accent)',
              }}
            >
              <ShieldCheck size={30} />
            </div>

            <ul className="flex flex-col gap-2 text-sm text-[var(--text-2)]">
              {[t('onboarding.vaultWhy1'), t('onboarding.vaultWhy2'), t('onboarding.vaultWhy3')].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {vault ? (
              <p className="text-center text-sm font-medium" style={{ color: 'var(--success-text)' }}>
                ✓ {t('onboarding.vaultOn')}
              </p>
            ) : (
              <>
                <Button fullWidth loading={vaultBusy} onClick={() => void enableVault()}>
                  <ShieldCheck size={16} /> {t('onboarding.vaultEnable')}
                </Button>
                {vaultErr && (
                  <p className="text-center text-xs" style={{ color: 'var(--danger-text)' }}>
                    {vaultErr}
                  </p>
                )}
                <p className="text-center text-xs text-[var(--text-3)]">{t('onboarding.vaultLater')}</p>
              </>
            )}

            <div className="mt-auto flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setStep(S.finance)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button className="flex-1" onClick={() => setStep(S.widgets)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 2 — важные разделы (виджеты главного) */}
        {step === S.widgets && (
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
              <Button variant="ghost" onClick={() => setStep(S.vault)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button className="flex-1" onClick={() => setStep(S.prefs)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 3 — язык, валюта, тема */}
        {step === S.prefs && (
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
            <Field label={t('onboarding.weatherLabel')} hint={t('onboarding.weatherHint')}>
              {weatherLocation ? (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{weatherLocation.name}</span>
                  <Button variant="ghost" onClick={() => void setWeatherLocation(null)}>
                    {t('onboarding.skip')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void findCity()}
                      placeholder={t('settings.weatherCityPlaceholder')}
                      aria-label={t('onboarding.weatherLabel')}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      variant="subtle"
                      loading={cityBusy}
                      disabled={!cityQuery.trim()}
                      onClick={() => void findCity()}
                      className="shrink-0"
                    >
                      <Search size={15} /> {t('onboarding.weatherFind')}
                    </Button>
                  </div>
                  {cityErr && (
                    <span className="mt-1 block text-xs" style={{ color: 'var(--danger-text)' }}>
                      {cityErr}
                    </span>
                  )}
                </>
              )}
            </Field>
            <div className="mt-auto flex gap-2 pt-6">
              <Button variant="ghost" onClick={() => setStep(S.widgets)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button className="flex-1" onClick={() => setStep(S.notify)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 4 — уведомления */}
        {step === S.notify && (
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
              <Button fullWidth onClick={() => setStep(S.done)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
              <Button variant="ghost" onClick={() => setStep(S.prefs)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 5 — готово */}
        {step === S.done && (
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
            {/* предложение установить веб-версию как приложение; в APK и в уже
                установленном PWA компонент сам ничего не рисует */}
            <div className="mt-6 text-left">
              <InstallAppCard />
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <Button fullWidth onClick={finish}>{t('onboarding.start')}</Button>
              <Button variant="ghost" onClick={() => setStep(S.notify)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            </div>
          </div>
        )}

        {/* пропустить весь мастер — кроме финального шага */}
        {step < S.done && (
          <button
            onClick={finish}
            className="mt-4 text-center text-xs text-[var(--text-3)] underline underline-offset-2"
          >
            {t('onboarding.skip')}
          </button>
        )}
      </div>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
      {/* тот же показ секрета, что и в Настройках: секрет нужно сохранить,
          и второй раз он просто так не покажется */}
      <VaultSecretModal value={vaultReveal} onClose={() => setVaultReveal(null)} />
    </div>
  )
}
