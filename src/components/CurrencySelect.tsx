import { useTranslation } from 'react-i18next'
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from '../types'

const label = (c: Currency) =>
  CURRENCY_SYMBOLS[c] && CURRENCY_SYMBOLS[c] !== c ? `${c} ${CURRENCY_SYMBOLS[c]}` : c

/**
 * Выбор валюты (нативный select — компактен, доступен, работает на мобильном).
 * Если задан `preferred` (валюты пользователя из настроек), они идут первой
 * группой «Ваши валюты», остальные — во второй; так частые под рукой, но
 * доступен весь список. Без `preferred` — плоский полный список.
 */
export function CurrencySelect({
  value,
  onChange,
  id,
  ariaLabel,
  preferred,
}: {
  value: Currency
  onChange: (c: Currency) => void
  id?: string
  ariaLabel?: string
  preferred?: Currency[]
}) {
  const { t } = useTranslation()
  const pref = preferred ? preferred.filter((c) => CURRENCIES.includes(c)) : []
  const rest = pref.length ? CURRENCIES.filter((c) => !pref.includes(c)) : CURRENCIES
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
    >
      {pref.length > 0 ? (
        <>
          <optgroup label={t('settings.currencyMine')}>
            {pref.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('settings.currencyAll')}>
            {rest.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        rest.map((c) => (
          <option key={c} value={c}>
            {label(c)}
          </option>
        ))
      )}
    </select>
  )
}
