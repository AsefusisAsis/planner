import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { rateOf } from '../../services/rates'
import { describeWeather } from '../../services/weather'
import { CURRENCY_SYMBOLS, MAX_TICKER_CURRENCIES, type Currency } from '../../types'

/**
 * Шапка Главной. Иерархия: приветствие + дата/время — главное; погода и
 * курсы — вторичный ряд компактных чипов, а не равновесные карточки.
 *
 * `now` приходит пропом: те же часы нужны виджету «Сейчас/Далее» и правилу
 * «поздно ли для воды». Один интервал на страницу, а не три.
 */
export function Header({ now }: { now: Date }) {
  const { t, i18n } = useTranslation()
  const vt = useVoice()
  const settings = useStore((s) => s.data.settings)
  const rates = useStore((s) => s.rates)
  const weather = useStore((s) => s.weather)
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US'
  const base = settings.baseCurrency

  // валюты тикера: настроенные пользователем или дефолт, минус базовая.
  // Потолок общий с настройками (MAX_TICKER_CURRENCIES): раньше здесь стояло
  // своё число 8, и лишние выбранные валюты просто молча не показывались.
  const tickerCurrencies: Currency[] = (
    settings.displayCurrencies?.length ? settings.displayCurrencies : (['USD', 'EUR', 'RUB'] as Currency[])
  )
    .filter((c) => c !== base)
    .slice(0, MAX_TICKER_CURRENCIES)

  const dateStr = now.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString(locale, { hour12: false })
  const tzShort =
    new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value ?? ''

  const greeting = (() => {
    const h = now.getHours()
    // слово-приветствие звучит в тоне темы (у «Спокойной» — свои варианты)
    const word =
      h < 6 ? vt('dashboard.night') : h < 12 ? vt('dashboard.morning') : h < 18 ? vt('dashboard.day') : vt('dashboard.evening')
    const nm = settings.userName
    const g = nm ? `${word}, ${nm}` : word
    // тёплая — персонаж-солнце/месяц по времени суток (характер темы);
    // деловая и спокойная — без эмодзи
    if ((settings.palette ?? 'classic') !== 'warm') return g
    const glyph = h < 6 ? '🌙' : h < 12 ? '🌅' : h < 18 ? '☀️' : '🌇'
    return `${g} ${glyph}`
  })()

  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
      <p className="mt-0.5 text-sm text-[var(--text-2)] tabular-nums">
        {dateStr} · {timeStr} · {tzShort}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {weather && settings.weatherLocation && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <span className="text-base leading-none">{describeWeather(weather.code).emoji}</span>
            <span className="tnum font-semibold">{weather.tempC}°C</span>
            <span className="text-[var(--text-3)]">{settings.weatherLocation.name.split(',')[0]}</span>
          </span>
        )}
        {rates && tickerCurrencies.length > 0 && (
          <span
            className="tnum inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-3 py-1.5 text-xs"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            title={t('dashboard.ratesTitle')}
          >
            {tickerCurrencies.map((q) => {
              // сколько базовой валюты за 1 единицу q; для «мелких» курсов
              // (напр. RUB) показываем за 100 единиц — читабельнее
              const r = rateOf(q, base, rates)
              if (r == null) return null
              const per100 = r < 0.1
              const sym = CURRENCY_SYMBOLS[q] ?? q
              return (
                <span key={q}>
                  <span className="text-[var(--text-3)]">{per100 ? `100${sym}` : sym}</span>{' '}
                  {(per100 ? r * 100 : r).toFixed(2)}
                </span>
              )
            })}
          </span>
        )}
      </div>
    </div>
  )
}
