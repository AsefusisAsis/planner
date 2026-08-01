// Отчёт по записям, помеченным «для налоговой» — чистые функции (unit-тесты).
//
// ГРАНИЦА ОТВЕТСТВЕННОСТИ. Здесь считаются только суммы по вашим отметкам:
// сколько прошло доходов и расходов за период. Сумму налога к уплате по
// местному закону приложение не считает и считать не будет — это работа
// бухгалтера, а ошибка в ней стоит дороже, чем удобство.

import type { Currency, Expense, ExpenseCategory, TxnType } from '../types'

export interface TaxReportRow {
  id: string
  date: string
  type: TxnType
  /** имя категории; пусто — без категории */
  category: string
  note: string
  amount: number
  currency: Currency
  /** сумма в базовой валюте; null — курса нет и привести нельзя */
  base: number | null
}

export interface TaxGroup {
  key: string
  income: number
  expense: number
}

export interface TaxReport {
  from: string
  to: string
  rows: TaxReportRow[]
  /** итоги в базовой валюте (только по конвертируемым записям) */
  income: number
  expense: number
  /** сколько записей не удалось привести к базовой валюте — их НЕТ в итогах */
  unconvertible: number
  byCategory: TaxGroup[]
  byMonth: TaxGroup[]
}

const typeOf = (e: Expense): TxnType => e.type ?? 'expense'

/**
 * Собирает отчёт за период по записям с пометкой «для налоговой».
 *
 * `toBase` передаётся снаружи: курс живёт в сервисе, а этот модуль должен
 * оставаться чистым и проверяемым.
 */
export function buildTaxReport(
  expenses: Expense[],
  categories: ExpenseCategory[],
  from: string,
  to: string,
  toBase: (e: Expense) => number | null,
): TaxReport {
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const picked = expenses
    .filter((e) => e.taxRelevant && e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const rows: TaxReportRow[] = picked.map((e) => ({
    id: e.id,
    date: e.date,
    type: typeOf(e),
    category: (e.categoryId && catName.get(e.categoryId)) || '',
    note: e.note ?? '',
    amount: e.amount,
    currency: e.currency,
    base: toBase(e),
  }))

  let income = 0
  let expense = 0
  let unconvertible = 0
  const byCategory = new Map<string, TaxGroup>()
  const byMonth = new Map<string, TaxGroup>()

  const bump = (m: Map<string, TaxGroup>, key: string, type: TxnType, v: number) => {
    const g = m.get(key) ?? { key, income: 0, expense: 0 }
    if (type === 'income') g.income += v
    else g.expense += v
    m.set(key, g)
  }

  for (const r of rows) {
    // Неконвертируемую запись НЕ подставляем нулём и не считаем по номиналу:
    // и то и другое молча исказило бы итог. Её видно отдельным счётчиком.
    if (r.base == null) {
      unconvertible++
      continue
    }
    if (r.type === 'income') income += r.base
    else expense += r.base
    bump(byCategory, r.category, r.type, r.base)
    bump(byMonth, r.date.slice(0, 7), r.type, r.base)
  }

  return {
    from,
    to,
    rows,
    income,
    expense,
    unconvertible,
    byCategory: [...byCategory.values()].sort(
      (a, b) => b.income + b.expense - (a.income + a.expense),
    ),
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
  }
}

/** Экранирование поля CSV: кавычки удваиваются, поле берётся в кавычки. */
function csvCell(v: string | number): string {
  const s = String(v)
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * CSV отчёта.
 *
 * Разделитель — точка с запятой, а не запятая: в русской локали Excel
 * запятая это десятичный разделитель, и файл с запятыми открывается одной
 * склеенной колонкой. Числа тоже пишутся с запятой в дробной части — иначе
 * тот же Excel примет их за текст.
 */
export function taxReportToCsv(
  report: TaxReport,
  baseCurrency: Currency,
  labels: {
    date: string
    type: string
    income: string
    expense: string
    category: string
    note: string
    amount: string
    currency: string
    inBase: string
  },
): string {
  const num = (n: number) => n.toFixed(2).replace('.', ',')
  const head = [
    labels.date,
    labels.type,
    labels.category,
    labels.note,
    labels.amount,
    labels.currency,
    `${labels.inBase} (${baseCurrency})`,
  ]
  const lines = [head.map(csvCell).join(';')]
  for (const r of report.rows) {
    lines.push(
      [
        csvCell(r.date),
        csvCell(r.type === 'income' ? labels.income : labels.expense),
        csvCell(r.category),
        csvCell(r.note),
        csvCell(num(r.amount)),
        csvCell(r.currency),
        csvCell(r.base == null ? '' : num(r.base)),
      ].join(';'),
    )
  }
  // BOM: без него Excel читает UTF-8 как ANSI и кириллица превращается в кашу
  return '﻿' + lines.join('\r\n') + '\r\n'
}
