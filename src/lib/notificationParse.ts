// Разбор банковского уведомления в черновик траты — чистые функции (тесты).
//
// Это ядро фичи «не вбивать трату руками». Оно НЕ зависит от того, откуда
// пришёл текст: из системного доступа к уведомлениям, из «Поделиться» или
// из буфера. Поэтому логика лежит отдельно и проверяется юнит-тестами, а
// способ доставки текста — вопрос отдельный (и, в отличие от этого модуля,
// упирается в политику Google Play).
//
// ГЛАВНОЕ ПРАВИЛО: не угадывать. Если сумму или её смысл понять нельзя —
// возвращаем null. Молча создать трату с неверной суммой хуже, чем не
// создать ничего: пользователь заметит пропущенную запись, а неверную —
// далеко не всегда.

import type { Currency, TxnType } from '../types'

export interface ParsedTxn {
  amount: number
  /** null — валюту в тексте не нашли, подставит базовую сам пользователь */
  currency: Currency | null
  type: TxnType
  /** магазин/описание, если удалось выделить */
  merchant: string | null
  /** последние цифры карты — помогает узнать, с какой карты списано */
  last4: string | null
  /** насколько уверенно разобрано: low → показывать форму с пустыми полями */
  confidence: 'high' | 'medium' | 'low'
}

/** Слова, после которых число — это ОСТАТОК, а не сумма операции.
 *  Самая частая ловушка: в одном уведомлении есть и то и другое. */
const BALANCE_WORDS =
  /(баланс|доступно|остаток|available|balance|на счете|на счёте|достpupно)/i

const INCOME_WORDS = /(зачисл|пополнен|поступл|перевод от|возврат|refund|credited|received)/i
const EXPENSE_WORDS =
  /(оплат|покупк|списан|снятие|перевод в|перевод на|withdraw|payment|purchase|debited)/i

/**
 * Токен валюты → код. Порядок важен: «бел. руб» должен победить «руб».
 *
 * Границы слова заданы через `[^\p{L}]`, а НЕ через `\b`. В JS `\b`
 * определяется по `\w` = `[A-Za-z0-9_]`, то есть кириллица для него не
 * буква: выражение `\bруб` не совпадает НИКОГДА. Валюта не определялась бы
 * ровно в тех уведомлениях, ради которых всё и делается. Лукбехайнд не
 * используем — обходимся группами, чтобы не зависеть от версии WebView.
 */
const CURRENCY_ALTS: [string, Currency][] = [
  ['BYN|бел\\.?\\s?руб\\.?|Br', 'BYN'],
  ['RUB|руб\\.?|р\\.|₽', 'RUB'],
  ['USD|долл\\.?|\\$', 'USD'],
  ['EUR|евро|€', 'EUR'],
  ['PLN|zł|зл\\.?', 'PLN'],
  ['UAH|грн\\.?|₴', 'UAH'],
  ['KZT|тенге|₸', 'KZT'],
]

const CURRENCY_TOKENS: [RegExp, Currency][] = CURRENCY_ALTS.map(([alts, code]) => [
  new RegExp(`(?:^|[^\\p{L}])(?:${alts})(?:[^\\p{L}]|$)`, 'iu'),
  code,
])

/** Число вида 1 234,56 / 1234.56 / 45 — с разделителями разрядов. */
const NUMBER = /\d{1,3}(?:[  ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/

interface Found {
  value: number
  index: number
  end: number
}

/** Все числа текста с позициями. */
function findNumbers(text: string): Found[] {
  const re = new RegExp(NUMBER.source, 'g')
  const out: Found[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[0].replace(/[  ]/g, '').replace(',', '.')
    const value = Number(raw)
    if (Number.isFinite(value)) out.push({ value, index: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Похоже ли, что это число — остаток по счёту, а не сумма операции. */
function looksLikeBalance(text: string, n: Found): boolean {
  // смотрим 24 символа перед числом: «Баланс 1200.00», «Доступно: 500»
  const before = text.slice(Math.max(0, n.index - 24), n.index)
  return BALANCE_WORDS.test(before)
}

function detectCurrency(text: string): Currency | null {
  for (const [re, code] of CURRENCY_TOKENS) if (re.test(text)) return code
  return null
}

function detectType(text: string): TxnType | null {
  // расход проверяем первым: «перевод» встречается в обоих наборах, и
  // уточняющие «в/на» должны победить общее «перевод от»
  if (EXPENSE_WORDS.test(text)) return 'expense'
  if (INCOME_WORDS.test(text)) return 'income'
  return null
}

/** Последние 4 цифры карты: *1234, ****1234, карта 1234. */
function detectLast4(text: string): string | null {
  const m = text.match(/(?:\*+|карт[аы]\s*|card\s*)(\d{4})\b/i)
  return m ? m[1] : null
}

/**
 * Название магазина. Берём кусок после запятой или после слова-маркера,
 * очищаем от служебного. Ошибиться здесь не страшно — это подпись, а не
 * сумма, и пользователь видит её в форме перед сохранением.
 */
function detectMerchant(text: string): string | null {
  const marker = text.match(/(?:магазин|мерчант|получатель|в\s+магазине|merchant|at)\s+([^,.;\n]{2,40})/i)
  if (marker) return marker[1].trim()
  // латиница капсом длиной ≥3 — типичное имя терминала (EUROPT, YANDEX TAXI)
  const caps = text.match(/\b[A-Z][A-Z0-9]{2,}(?:[ -][A-Z0-9]{2,}){0,3}\b/g)
  if (caps) {
    // Служебные коды выкидываем ПОСЛОВНО: «BYN EUROPT» приходит одним
    // совпадением, и проверка целой строки оставила бы валюту в названии.
    const skip = /^(BYN|RUB|USD|EUR|PLN|UAH|KZT|SMS|OTP|PIN|VISA|MIR|MC)$/
    for (const chunk of caps) {
      const words = chunk.trim().split(/[ -]+/).filter((w) => !skip.test(w))
      if (words.length) return words.join(' ')
    }
  }
  return null
}

/**
 * Разбирает текст уведомления в черновик операции.
 * null — понять сумму нельзя; выдумывать её нельзя тем более.
 */
export function parseNotification(text: string): ParsedTxn | null {
  if (!text || !text.trim()) return null
  const numbers = findNumbers(text)
  if (!numbers.length) return null

  const currency = detectCurrency(text)
  const type = detectType(text)

  // Кандидаты на сумму операции: всё, что не помечено как остаток.
  const candidates = numbers.filter((n) => !looksLikeBalance(text, n))
  if (!candidates.length) return null

  // Из оставшихся берём ПЕРВОЕ число: в уведомлениях сумма операции идёт
  // раньше остатка и раньше номера карты. Числа-обрывки вроде «*1234»
  // отсеиваем — четыре цифры подряд без дробной части рядом со звёздочкой
  // это карта, а не деньги.
  const last4 = detectLast4(text)
  const amountCand = candidates.filter((n) => {
    if (last4 && String(n.value) === last4) {
      const before = text.slice(Math.max(0, n.index - 8), n.index)
      if (/\*|карт|card/i.test(before)) return false
    }
    return true
  })
  if (!amountCand.length) return null

  const amount = amountCand[0].value
  if (!(amount > 0)) return null

  // Уверенность: сумма без валюты и без типа — почти догадка, и об этом
  // нужно сказать интерфейсу, а не делать вид, что всё разобрано.
  const confidence: ParsedTxn['confidence'] =
    currency && type ? 'high' : currency || type ? 'medium' : 'low'

  return {
    amount,
    currency,
    type: type ?? 'expense',
    merchant: detectMerchant(text),
    last4,
    confidence,
  }
}
