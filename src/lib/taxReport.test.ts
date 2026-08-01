import { describe, it, expect } from 'vitest'
import { buildTaxReport, taxReportToCsv } from './taxReport'
import type { Expense, ExpenseCategory } from '../types'

const CATS: ExpenseCategory[] = [
  { id: 'c1', name: 'Услуги', color: '#111' },
  { id: 'c2', name: 'Оборудование', color: '#222' },
]

function e(over: Partial<Expense> & { id: string; amount: number }): Expense {
  return {
    currency: 'USD',
    categoryId: null,
    note: '',
    date: '2026-03-10',
    createdAt: '2026-03-10T00:00:00.000Z',
    type: 'expense',
    ...over,
  } as Expense
}

/** По умолчанию считаем 1:1 — курс проверяется отдельными тестами. */
const asIs = (x: Expense) => x.amount

const LABELS = {
  date: 'Дата',
  type: 'Тип',
  income: 'Доход',
  expense: 'Расход',
  category: 'Категория',
  note: 'Заметка',
  amount: 'Сумма',
  currency: 'Валюта',
  inBase: 'В базовой',
}

describe('buildTaxReport / отбор записей', () => {
  it('берёт только помеченные', () => {
    const r = buildTaxReport(
      [
        e({ id: '1', amount: 100, taxRelevant: true }),
        e({ id: '2', amount: 200 }), // без пометки
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.rows.map((x) => x.id)).toEqual(['1'])
    expect(r.expense).toBe(100)
  })

  it('границы периода включительные', () => {
    const r = buildTaxReport(
      [
        e({ id: 'a', amount: 1, taxRelevant: true, date: '2026-03-01' }),
        e({ id: 'b', amount: 1, taxRelevant: true, date: '2026-03-31' }),
        e({ id: 'c', amount: 1, taxRelevant: true, date: '2026-02-28' }),
        e({ id: 'd', amount: 1, taxRelevant: true, date: '2026-04-01' }),
      ],
      CATS,
      '2026-03-01',
      '2026-03-31',
      asIs,
    )
    expect(r.rows.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('строки идут по дате', () => {
    const r = buildTaxReport(
      [
        e({ id: 'late', amount: 1, taxRelevant: true, date: '2026-03-20' }),
        e({ id: 'early', amount: 1, taxRelevant: true, date: '2026-03-02' }),
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.rows.map((x) => x.id)).toEqual(['early', 'late'])
  })
})

describe('buildTaxReport / итоги', () => {
  it('доходы и расходы считаются раздельно', () => {
    const r = buildTaxReport(
      [
        e({ id: '1', amount: 1000, taxRelevant: true, type: 'income' }),
        e({ id: '2', amount: 250, taxRelevant: true, type: 'expense' }),
        e({ id: '3', amount: 150, taxRelevant: true, type: 'expense' }),
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.income).toBe(1000)
    expect(r.expense).toBe(400)
  })

  it('запись без типа считается расходом (обратная совместимость)', () => {
    const r = buildTaxReport(
      [{ ...e({ id: '1', amount: 50, taxRelevant: true }), type: undefined } as Expense],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.expense).toBe(50)
    expect(r.rows[0].type).toBe('expense')
  })

  it('неконвертируемая запись НЕ попадает в итог и видна счётчиком', () => {
    // молчаливый ноль или счёт по номиналу исказили бы отчёт для налоговой
    const r = buildTaxReport(
      [
        e({ id: 'ok', amount: 100, taxRelevant: true }),
        e({ id: 'bad', amount: 999, taxRelevant: true, currency: 'THB' }),
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      (x) => (x.currency === 'THB' ? null : x.amount),
    )
    expect(r.expense).toBe(100)
    expect(r.unconvertible).toBe(1)
    expect(r.rows).toHaveLength(2) // в списке она есть — просто без суммы
    expect(r.rows.find((x) => x.id === 'bad')!.base).toBeNull()
  })

  it('используется переданный пересчёт в базовую, а не номинал', () => {
    const r = buildTaxReport(
      [e({ id: '1', amount: 10, taxRelevant: true, currency: 'EUR' })],
      CATS,
      '2026-01-01',
      '2026-12-31',
      () => 11.5,
    )
    expect(r.expense).toBeCloseTo(11.5)
  })
})

describe('buildTaxReport / группировки', () => {
  it('по категориям, самые крупные первыми; без категории — пустой ключ', () => {
    const r = buildTaxReport(
      [
        e({ id: '1', amount: 100, taxRelevant: true, categoryId: 'c1' }),
        e({ id: '2', amount: 500, taxRelevant: true, categoryId: 'c2' }),
        e({ id: '3', amount: 20, taxRelevant: true }),
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.byCategory.map((g) => g.key)).toEqual(['Оборудование', 'Услуги', ''])
    expect(r.byCategory[0].expense).toBe(500)
  })

  it('по месяцам в хронологии', () => {
    const r = buildTaxReport(
      [
        e({ id: '1', amount: 10, taxRelevant: true, date: '2026-05-04', type: 'income' }),
        e({ id: '2', amount: 20, taxRelevant: true, date: '2026-03-04' }),
        e({ id: '3', amount: 30, taxRelevant: true, date: '2026-03-25' }),
      ],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(r.byMonth.map((g) => g.key)).toEqual(['2026-03', '2026-05'])
    expect(r.byMonth[0].expense).toBe(50)
    expect(r.byMonth[1].income).toBe(10)
  })

  it('пустой период — нули, а не падение', () => {
    const r = buildTaxReport([], CATS, '2026-01-01', '2026-12-31', asIs)
    expect(r.rows).toEqual([])
    expect(r.income).toBe(0)
    expect(r.expense).toBe(0)
    expect(r.byCategory).toEqual([])
  })
})

describe('taxReportToCsv', () => {
  const report = buildTaxReport(
    [
      e({ id: '1', amount: 1234.5, taxRelevant: true, categoryId: 'c1', note: 'Аренда', type: 'income' }),
      e({ id: '2', amount: 10, taxRelevant: true, currency: 'THB' }),
    ],
    CATS,
    '2026-01-01',
    '2026-12-31',
    (x) => (x.currency === 'THB' ? null : x.amount),
  )
  const csv = taxReportToCsv(report, 'USD', LABELS)

  it('начинается с BOM — иначе Excel показывает кириллицу кашей', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
  it('разделитель — точка с запятой (в ru-локали Excel запятая десятичная)', () => {
    expect(csv.split('\r\n')[0]).toContain('";"')
  })
  it('дробная часть через запятую — иначе Excel примет число за текст', () => {
    expect(csv).toContain('"1234,50"')
  })
  it('заголовок содержит базовую валюту', () => {
    expect(csv).toContain('В базовой (USD)')
  })
  it('неконвертируемая строка есть, но колонка базовой пуста', () => {
    const line = csv.split('\r\n').find((l) => l.includes('THB'))!
    expect(line.endsWith('""')).toBe(true)
  })
  it('кавычки в тексте экранируются удвоением', () => {
    const r = buildTaxReport(
      [e({ id: '1', amount: 1, taxRelevant: true, note: 'ООО "Ромашка"' })],
      CATS,
      '2026-01-01',
      '2026-12-31',
      asIs,
    )
    expect(taxReportToCsv(r, 'USD', LABELS)).toContain('"ООО ""Ромашка"""')
  })
})
