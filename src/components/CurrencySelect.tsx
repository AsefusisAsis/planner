import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from '../types'

/**
 * Выбор валюты из полного набора (нативный select — компактен, доступен,
 * нормально работает на мобильном). Подпись: «USD $», «BYN Br» и т.п.
 */
export function CurrencySelect({
  value,
  onChange,
  id,
  ariaLabel,
}: {
  value: Currency
  onChange: (c: Currency) => void
  id?: string
  ariaLabel?: string
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
          {CURRENCY_SYMBOLS[c] && CURRENCY_SYMBOLS[c] !== c ? ` ${CURRENCY_SYMBOLS[c]}` : ''}
        </option>
      ))}
    </select>
  )
}
