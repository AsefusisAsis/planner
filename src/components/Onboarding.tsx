// Мастер первого запуска: имя → язык/валюта/тема → приветствие.
// Показывается только на «чистом» устройстве (нет данных и не пройден).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, SegmentedControl } from './ui'
import { applyTheme } from '../lib/theme'
import { CURRENCIES, type Currency, type Language, type ThemeMode } from '../types'

export function Onboarding() {
  const { t, i18n } = useTranslation()
  const settings = useStore((s) => s.data.settings)
  const complete = useStore((s) => s.completeOnboarding)

  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.userName ?? '')
  const [lang, setLang] = useState<Language>(settings.language)
  const [cur, setCur] = useState<Currency>(settings.baseCurrency)
  const [theme, setTheme] = useState<ThemeMode>(settings.theme)

  // живой предпросмотр без записи в стор
  function previewTheme(v: ThemeMode) {
    setTheme(v)
    applyTheme(v)
  }
  function previewLang(v: Language) {
    setLang(v)
    void i18n.changeLanguage(v)
  }

  function finish() {
    complete({ name, language: lang, baseCurrency: cur, theme })
  }

  const total = 3
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
      style={{ background: 'var(--bg)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.title')}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-8">
        {/* прогресс */}
        <div className="mb-8 flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--accent)' : 'var(--bg-3)' }}
            />
          ))}
        </div>

        {/* Шаг 1 — приветствие + имя */}
        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-3xl font-bold tracking-tight">{t('onboarding.title')}</h1>
            <p className="mt-3 text-[var(--text-2)]">{t('onboarding.subtitle')}</p>
            <div className="mt-8">
              <Field label={t('onboarding.nameLabel')}>
                <input
                  autoFocus
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

        {/* Шаг 2 — язык, валюта, тема */}
        {step === 1 && (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.prefsTitle')}</h1>
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
            <Field label={t('settings.baseCurrency')}>
              <SegmentedControl<Currency>
                value={cur}
                onChange={setCur}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
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
            <div className="mt-auto flex gap-2 pt-6">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
              <Button fullWidth onClick={() => setStep(2)}>
                {t('onboarding.next')} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 3 — готово */}
        {step === 2 && (
          <div className="flex flex-1 flex-col text-center">
            <div
              className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
            >
              <Check size={32} />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">
              {t('onboarding.finishTitle', { name: name.trim() })}
            </h1>
            <p className="mt-3 text-[var(--text-2)]">{t('onboarding.finishText')}</p>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <Button fullWidth onClick={finish}>{t('onboarding.start')}</Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> {t('onboarding.back')}
              </Button>
            </div>
          </div>
        )}

        {/* пропустить — на любом шаге, кроме финального */}
        {step < 2 && (
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
