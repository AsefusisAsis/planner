// Проведение купленных позиций списка в трату — чистые функции (юнит-тесты).
//
// Раньше этот расчёт жил прямо в обработчике кнопки на странице покупок и
// проверялся только глазами. Это деньги: ошибка тут не «список выглядит
// криво», а неверная сумма в бюджете.
//
// ГЛАВНОЕ ПРАВИЛО, унаследованное от старого кода: позицию в чужой валюте
// без курса НЕ переводим один к одному и не считаем нулём. Она выпадает из
// суммы и попадает в отдельный счётчик, чтобы интерфейс мог о ней сказать.

import type { Currency, ShoppingItem } from '../types'

export interface ExportLine {
  id: string
  name: string
  qty: number
  /** цена за штуку в валюте позиции; null — не задана */
  price: number | null
  currency: Currency
  /** строка в базовой валюте: price × qty; null — цены нет или нет курса */
  base: number | null
  /** цена есть, но привести к базовой валюте нечем */
  noRate: boolean
}

export interface ExportPlan {
  lines: ExportLine[]
  /** сумма в базовой валюте по строкам, которые удалось посчитать */
  total: number
  /** сколько позиций без цены — их нужно спросить у человека */
  missingPrice: number
  /** сколько позиций с ценой, но без курса — в сумму не вошли */
  noRate: number
}

/**
 * Собирает план проведения по КУПЛЕННЫМ и ещё НЕ проведённым позициям.
 *
 * `toBase` приходит снаружи: курсы живут в сервисе, а модуль должен
 * оставаться чистым.
 */
export function buildExportPlan(
  items: ShoppingItem[],
  baseCurrency: Currency,
  toBase: (amount: number, from: Currency) => number | null,
): ExportPlan {
  const lines: ExportLine[] = []
  let total = 0
  let missingPrice = 0
  let noRate = 0

  for (const it of items) {
    if (!it.bought || it.exportedAt) continue
    const currency = it.currency ?? baseCurrency
    const price = it.price ?? null
    if (price == null) {
      missingPrice++
      lines.push({ id: it.id, name: it.name, qty: it.qty, price: null, currency, base: null, noRate: false })
      continue
    }
    const sum = price * it.qty
    const base = currency === baseCurrency ? sum : toBase(sum, currency)
    if (base == null) {
      noRate++
      lines.push({ id: it.id, name: it.name, qty: it.qty, price, currency, base: null, noRate: true })
      continue
    }
    total += base
    lines.push({ id: it.id, name: it.name, qty: it.qty, price, currency, base, noRate: false })
  }

  // Копейки округляем ОДИН раз на итоге, а не по строкам: построчное
  // округление на длинном чеке уводит сумму на несколько копеек.
  return { lines, total: Math.round(total * 100) / 100, missingPrice, noRate }
}
