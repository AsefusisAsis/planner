// ============================================================
// Курсы валют. Источник — агрегатор open.er-api.com (160+ валют, без ключа),
// пивот — USD. Официальный курс BYN дополнительно уточняется по НБРБ
// (осознанное исключение: для Беларуси важен официальный курс, а не рыночный
// агрегатора). Храним usdPerUnit[ABBR] = сколько USD за 1 единицу валюты,
// USD == 1. Конвертация всегда через USD.
// ============================================================

import type { Currency } from '../types'
import { CURRENCY_SYMBOLS } from '../types'

export interface RateTable {
  /** USD за 1 единицу валюты; USD == 1 */
  usdPerUnit: Record<string, number>
  fetchedAt: string
  /** источники, поучаствовавшие в таблице (для подписи в UI) */
  source: string
}

const CACHE_KEY = 'planner.rates.v2'
const ERAPI_URL = 'https://open.er-api.com/v6/latest/USD'
const NBRB_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0'

interface ErApiResponse {
  result: string
  rates: Record<string, number> // единиц валюты за 1 USD
}
interface NbrbRate {
  Cur_Abbreviation: string
  Cur_Scale: number
  Cur_OfficialRate: number
}

function readCache(): RateTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as RateTable
    return t.usdPerUnit ? t : null // старый формат (bynPerUnit) игнорируем
  } catch {
    return null
  }
}

function writeCache(t: RateTable) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(t))
}

function isFresh(t: RateTable | null): boolean {
  if (!t) return false
  const age = Date.now() - new Date(t.fetchedAt).getTime()
  return age < 1000 * 60 * 60 * 4 // 4 часа
}

/** Официальный курс BYN от НБРБ: возвращает USD за 1 BYN (для пивота), или null. */
async function fetchNbrbUsdPerByn(): Promise<number | null> {
  try {
    const res = await fetch(NBRB_URL, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const rows = (await res.json()) as NbrbRate[]
    const usd = rows.find((r) => r.Cur_Abbreviation === 'USD')
    if (!usd) return null
    const bynPerUsd = usd.Cur_OfficialRate / usd.Cur_Scale // BYN за 1 USD
    return bynPerUsd > 0 ? 1 / bynPerUsd : null // USD за 1 BYN
  } catch {
    return null
  }
}

/**
 * Возвращает таблицу курсов. Сначала сеть (агрегатор + НБРБ для BYN), при
 * ошибке — последний кэш (оффлайн). USD всегда = 1.
 */
export async function getRates(force = false): Promise<RateTable> {
  const cached = readCache()
  if (!force && isFresh(cached)) return cached!

  try {
    const res = await fetch(ERAPI_URL, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`rates ${res.status}`)
    const data = (await res.json()) as ErApiResponse
    if (data.result !== 'success' || !data.rates) throw new Error('rates: bad response')

    const usdPerUnit: Record<string, number> = { USD: 1 }
    for (const [cur, perUsd] of Object.entries(data.rates)) {
      if (perUsd > 0) usdPerUnit[cur] = 1 / perUsd // USD за 1 единицу
    }

    // Официальный BYN от НБРБ поверх агрегатора (если доступен)
    let source = 'er-api'
    const bynUsd = await fetchNbrbUsdPerByn()
    if (bynUsd != null) {
      usdPerUnit.BYN = bynUsd
      source = 'er-api+nbrb'
    }

    const table: RateTable = { usdPerUnit, fetchedAt: new Date().toISOString(), source }
    writeCache(table)
    return table
  } catch (e) {
    // тихий фолбэк на кэш уместен для автозагрузки/оффлайна, но не для явного
    // «Обновить курсы» (force): там сбой должен дойти до пользователя
    if (cached && !force) return cached
    throw e
  }
}

/**
 * Конвертация между валютами через USD-пивот.
 * Возвращает null, если нужного курса нет в таблице (частичный/устаревший
 * ответ): молчаливая подстановка 1:1 искажала бы итоги — вызывающий код
 * должен трактовать такую запись как неконвертируемую и пропустить.
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  table: RateTable,
): number | null {
  if (from === to) return amount
  const fromRate = table.usdPerUnit[from]
  const toRate = table.usdPerUnit[to]
  if (fromRate == null || toRate == null) return null
  return (amount * fromRate) / toRate
}

/** Курс: сколько единиц `quote` за 1 единицу `base` (для тикера/панели). */
export function rateOf(base: Currency, quote: Currency, table: RateTable): number | null {
  return convert(1, base, quote, table)
}

/**
 * Значение траты в валюте отображения с учётом «курса на момент траты».
 * Приоритет: та же валюта → сумма как есть; снимок baseAmount (если он в той
 * же базовой валюте, что отображаем) → фиксированное значение; иначе — live
 * пересчёт по текущему курсу (fallback для старых записей / смены базы).
 * null — курс недоступен и валюта не совпадает (запись пропускается в итогах).
 */
export function amountInBase(
  e: { amount: number; currency: Currency; baseAmount?: number; baseCur?: Currency },
  displayBase: Currency,
  rates: RateTable | null,
): number | null {
  if (e.currency === displayBase) return e.amount
  if (e.baseAmount != null && e.baseCur === displayBase) return e.baseAmount
  return rates ? convert(e.amount, e.currency, displayBase, rates) : null
}

export function formatMoney(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const v = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${v} ${symbol}`
}
