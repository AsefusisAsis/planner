// ============================================================
// Курсы Национального банка РБ (api.nbrb.by).
// BYN — базовая валюта. Официальный курс задаётся как
// Cur_OfficialRate белорусских рублей за Cur_Scale единиц валюты.
// Храним bynPerUnit[ABBR] = Cur_OfficialRate / Cur_Scale.
// ============================================================

import type { Currency } from '../types'

interface NbrbRate {
  Cur_ID: number
  Cur_Abbreviation: string
  Cur_Scale: number
  Cur_OfficialRate: number
}

export interface RateTable {
  /** белорусских рублей за 1 единицу валюты */
  bynPerUnit: Record<string, number>
  fetchedAt: string
}

const CACHE_KEY = 'planner.rates'
const RATES_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0'

function readCache(): RateTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as RateTable) : null
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

/**
 * Возвращает таблицу курсов. Сначала пытается сеть, при ошибке —
 * последний кэш (важно для оффлайна). BYN всегда = 1.
 */
export async function getRates(force = false): Promise<RateTable> {
  const cached = readCache()
  if (!force && isFresh(cached)) return cached!

  try {
    const res = await fetch(RATES_URL)
    if (!res.ok) throw new Error(`NBRB ${res.status}`)
    const rows = (await res.json()) as NbrbRate[]

    const bynPerUnit: Record<string, number> = { BYN: 1 }
    for (const r of rows) {
      bynPerUnit[r.Cur_Abbreviation] = r.Cur_OfficialRate / r.Cur_Scale
    }
    const table: RateTable = { bynPerUnit, fetchedAt: new Date().toISOString() }
    writeCache(table)
    return table
  } catch (e) {
    if (cached) return cached
    throw e
  }
}

/**
 * Конвертация между валютами через BYN.
 * Возвращает null, если нужного курса нет в таблице (например, частичный или
 * устаревший ответ API): молчаливая подстановка 1:1 искажала бы итоги —
 * вызывающий код должен трактовать такую запись как неконвертируемую.
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  table: RateTable,
): number | null {
  if (from === to) return amount
  const fromRate = table.bynPerUnit[from]
  const toRate = table.bynPerUnit[to]
  if (fromRate == null || toRate == null) return null
  return (amount * fromRate) / toRate
}

export function formatMoney(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = { BYN: 'Br', USD: '$', RUB: '₽', EUR: '€' }
  const v = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${v} ${symbols[currency]}`
}
