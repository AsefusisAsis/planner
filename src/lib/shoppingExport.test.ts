import { describe, it, expect } from 'vitest'
import { buildExportPlan } from './shoppingExport'
import type { Currency, ShoppingItem } from '../types'

const item = (p: Partial<ShoppingItem> & { id: string }): ShoppingItem => ({
  name: p.id,
  qty: 1,
  bought: true,
  ...p,
})

/** Курс: 1 USD = 3 BYN, остальное неизвестно. */
const toBase = (amount: number, from: Currency): number | null =>
  from === 'USD' ? amount * 3 : null

describe('buildExportPlan', () => {
  it('считает строку как цена × количество', () => {
    const plan = buildExportPlan([item({ id: 'a', qty: 3, price: 2.5 })], 'BYN', toBase)
    expect(plan.total).toBe(7.5)
    expect(plan.lines[0].base).toBe(7.5)
  })

  it('не проводит некупленное и уже проведённое', () => {
    const plan = buildExportPlan(
      [
        item({ id: 'некуплено', price: 10, bought: false }),
        item({ id: 'проведено', price: 10, exportedAt: '2026-08-01T10:00:00Z' }),
        item({ id: 'годится', price: 10 }),
      ],
      'BYN',
      toBase,
    )
    expect(plan.lines.map((l) => l.id)).toEqual(['годится'])
    expect(plan.total).toBe(10)
  })

  it('позиция без цены не теряется: она в строках и в счётчике', () => {
    const plan = buildExportPlan(
      [item({ id: 'молоко' }), item({ id: 'хлеб', price: 2 })],
      'BYN',
      toBase,
    )
    expect(plan.missingPrice).toBe(1)
    expect(plan.total).toBe(2)
    expect(plan.lines).toHaveLength(2)
  })

  it('переводит по курсу, когда валюта позиции чужая', () => {
    const plan = buildExportPlan([item({ id: 'a', price: 4, currency: 'USD' })], 'BYN', toBase)
    expect(plan.total).toBe(12)
  })

  /**
   * Главное правило: без курса позиция НЕ идёт в сумму ни как ноль, ни как
   * один к одному. И то и другое молча исказило бы бюджет.
   */
  it('позиция без курса выпадает из суммы, а не считается один к одному', () => {
    const plan = buildExportPlan(
      [item({ id: 'евро', price: 100, currency: 'EUR' }), item({ id: 'своё', price: 5 })],
      'BYN',
      toBase,
    )
    expect(plan.total).toBe(5)
    expect(plan.noRate).toBe(1)
    expect(plan.lines.find((l) => l.id === 'евро')?.base).toBeNull()
  })

  it('нулевая цена — это цена, а не «не задана»', () => {
    const plan = buildExportPlan([item({ id: 'акция', price: 0 })], 'BYN', toBase)
    expect(plan.missingPrice).toBe(0)
    expect(plan.total).toBe(0)
  })

  /** Округление на итоге, а не по строкам: иначе длинный чек «уплывает». */
  it('копейки округляются один раз на итоге', () => {
    const plan = buildExportPlan(
      [
        item({ id: 'a', price: 0.335 }),
        item({ id: 'b', price: 0.335 }),
        item({ id: 'c', price: 0.335 }),
      ],
      'BYN',
      toBase,
    )
    // построчное округление дало бы 0.33×3 = 0.99
    expect(plan.total).toBe(1.01)
  })

  it('пустой список — пустой план, а не ошибка', () => {
    const plan = buildExportPlan([], 'BYN', toBase)
    expect(plan).toEqual({ lines: [], total: 0, missingPrice: 0, noRate: 0 })
  })
})
