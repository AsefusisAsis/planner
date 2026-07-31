// Проверка криптоадресов — чистые функции (unit-тесты).
//
// ЗАЧЕМ ЭТО ВООБЩЕ ЕСТЬ. Один и тот же USDT живёт в TRC20, ERC20 и BEP20 —
// это РАЗНЫЕ адреса, и перевод не в ту сеть уходит безвозвратно. Самая
// частая ошибка — сохранить адрес одной сети, подписав его другой, а потом
// продиктовать его отправителю. Поэтому сеть у адреса обязательна, а формат
// сверяется с выбранной сетью.
//
// Проверка ПРЕДУПРЕЖДАЕТ, а не запрещает: форматы адресов со временем
// меняются и появляются новые, и отказ сохранить валидный адрес был бы
// хуже, чем предупреждение. Поэтому «не похоже» мы говорим только там, где
// уверены, а на всё незнакомое молчим.

import type { CryptoNetwork } from '../types'

export type { CryptoNetwork }

export const CRYPTO_NETWORKS: CryptoNetwork[] = [
  'BTC', 'ETH', 'BSC', 'TRON', 'TON', 'SOL', 'XRP', 'LTC', 'DOGE', 'OTHER',
]

/** Человеческая подпись сети: показываем и техническое имя стандарта —
 *  отправителю обычно называют именно «TRC20», а не «Tron». */
export const NETWORK_LABEL: Record<CryptoNetwork, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum (ERC20)',
  BSC: 'BNB Smart Chain (BEP20)',
  TRON: 'Tron (TRC20)',
  TON: 'TON',
  SOL: 'Solana',
  XRP: 'XRP Ledger',
  LTC: 'Litecoin',
  DOGE: 'Dogecoin',
  OTHER: '—',
}

/**
 * Семейство формата адреса. ETH и BSC (и прочие EVM-сети) используют один и
 * тот же вид адреса, поэтому они в одном семействе: отличить их по строке
 * невозможно, и предупреждать об «ошибке» тут было бы враньём.
 */
export type AddressFamily = 'evm' | 'tron' | 'btc' | 'ton' | 'sol' | 'xrp' | 'ltc' | 'doge'

const NETWORK_FAMILY: Record<CryptoNetwork, AddressFamily | null> = {
  BTC: 'btc',
  ETH: 'evm',
  BSC: 'evm',
  TRON: 'tron',
  TON: 'ton',
  SOL: 'sol',
  XRP: 'xrp',
  LTC: 'ltc',
  DOGE: 'doge',
  OTHER: null,
}

const BASE58 = '[1-9A-HJ-NP-Za-km-z]'

/**
 * Определяет семейство по виду адреса — ТОЛЬКО когда уверены.
 * null означает «не знаю», а не «неверно»: например, base58-строка без
 * характерного префикса может быть и Solana, и чем-то ещё, и придумывать
 * ответ значило бы выдавать ложные предупреждения.
 */
export function addressFamily(raw: string): AddressFamily | null {
  const a = raw.trim()
  if (!a) return null
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'evm'
  if (new RegExp(`^T${BASE58}{33}$`).test(a)) return 'tron'
  if (/^(UQ|EQ|kQ|0Q|Ef|0:)/.test(a)) return 'ton'
  if (/^(bc1)[a-z0-9]{20,}$/i.test(a)) return 'btc'
  if (/^(ltc1)[a-z0-9]{20,}$/i.test(a)) return 'ltc'
  if (new RegExp(`^1${BASE58}{25,34}$`).test(a)) return 'btc'
  if (new RegExp(`^[LM]${BASE58}{25,34}$`).test(a)) return 'ltc'
  if (new RegExp(`^D${BASE58}{25,34}$`).test(a)) return 'doge'
  if (new RegExp(`^r${BASE58}{24,34}$`).test(a)) return 'xrp'
  // Намеренно НЕ определяем: адреса, начинающиеся с «3» (P2SH — бывают и у
  // Bitcoin, и у Litecoin), и голый base58 без префикса (Solana и другие).
  return null
}

export type AddressCheck =
  /** формат совпал с выбранной сетью */
  | { status: 'ok' }
  /** пусто — проверять нечего */
  | { status: 'empty' }
  /** формат незнаком либо сеть «другая» — молчим, но и не подтверждаем */
  | { status: 'unknown' }
  /** формат уверенно принадлежит другой сети — это и есть потеря денег */
  | { status: 'mismatch'; looksLike: AddressFamily }

/** Сверяет адрес с выбранной сетью. */
export function checkAddress(raw: string, network: CryptoNetwork): AddressCheck {
  const a = raw.trim()
  if (!a) return { status: 'empty' }
  const want = NETWORK_FAMILY[network]
  if (!want) return { status: 'unknown' } // сеть «Другая» — сверять не с чем
  const got = addressFamily(a)
  if (got == null) return { status: 'unknown' }
  return got === want ? { status: 'ok' } : { status: 'mismatch', looksLike: got }
}

/** Сети, в которых обычно встречается монета (для подсказки в форме). */
export const NETWORKS_FOR_COIN: Record<string, CryptoNetwork[]> = {
  BTC: ['BTC'],
  ETH: ['ETH'],
  // стейблкоины и есть главный источник ошибок с сетью
  USDT: ['TRON', 'ETH', 'BSC', 'TON', 'SOL'],
  USDC: ['ETH', 'BSC', 'SOL', 'TRON'],
  TON: ['TON'],
  TRX: ['TRON'],
  BNB: ['BSC'],
  SOL: ['SOL'],
  XRP: ['XRP'],
  LTC: ['LTC'],
  DOGE: ['DOGE'],
}

/** Короткий вид адреса для списка: начало…конец. */
export function shortAddress(a: string, edge = 6): string {
  const s = a.trim()
  return s.length <= edge * 2 + 3 ? s : `${s.slice(0, edge)}…${s.slice(-edge)}`
}
