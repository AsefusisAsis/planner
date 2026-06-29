import { describe, it, expect } from 'vitest'
import { merge3, sameContent } from './merge'
import { createEmptyData } from '../types'
import type { AppData, Expense } from '../types'

const exp = (id: string, note = 'n'): Expense => ({
  id,
  amount: 1,
  currency: 'BYN',
  categoryId: null,
  note,
  date: '2026-01-01',
  createdAt: '',
})
const expAt = (id: string, createdAt: string): Expense => ({ ...exp(id), createdAt })
const withExp = (list: Expense[]): AppData => ({ ...createEmptyData(), expenses: list })

describe('merge3', () => {
  it('сохраняет локальную правку, если remote не менялся', () => {
    const m = merge3(withExp([exp('a', 'old')]), withExp([exp('a', 'new')]), withExp([exp('a', 'old')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('new')
  })

  it('берёт правку remote, если локально не менялось', () => {
    const m = merge3(withExp([exp('a', 'old')]), withExp([exp('a', 'old')]), withExp([exp('a', 'remote')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('remote')
  })

  it('применяет удаление: локально убрали, remote не трогал', () => {
    const m = merge3(withExp([exp('a')]), withExp([]), withExp([exp('a')]))
    expect(m.expenses.length).toBe(0)
  })

  it('объединяет новые записи с обеих сторон', () => {
    const m = merge3(withExp([]), withExp([exp('b')]), withExp([exp('c')]))
    expect(m.expenses.map((e) => e.id).sort()).toEqual(['b', 'c'])
  })

  it('при конфликте (правили обе стороны) побеждает локальная', () => {
    const m = merge3(withExp([exp('a', 'base')]), withExp([exp('a', 'local')]), withExp([exp('a', 'remote')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('local')
  })
})

describe('детерминизм и сходимость', () => {
  it('порядок результата не зависит от порядка входа (новые сверху)', () => {
    const a = expAt('a', '2026-01-01T00:00:00Z')
    const b = expAt('b', '2026-01-02T00:00:00Z')
    const c = expAt('c', '2026-01-03T00:00:00Z')
    const m1 = merge3(withExp([]), withExp([a, b, c]), withExp([]))
    const m2 = merge3(withExp([]), withExp([c, a, b]), withExp([]))
    expect(m1.expenses.map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(m1.expenses.map((e) => e.id)).toEqual(m2.expenses.map((e) => e.id))
  })

  it('идемпотентно: повторное слияние не меняет содержимое', () => {
    const d = withExp([expAt('a', '2026-01-01T00:00:00Z'), expAt('b', '2026-01-02T00:00:00Z')])
    const m1 = merge3(d, d, d)
    const m2 = merge3(m1, m1, m1)
    expect(sameContent(m1, m2)).toBe(true)
  })
})

describe('sameContent', () => {
  it('игнорирует updatedAt', () => {
    const a = { ...withExp([exp('x')]), updatedAt: '2026-01-01T00:00:00Z' }
    const b = { ...withExp([exp('x')]), updatedAt: '2030-12-31T00:00:00Z' }
    expect(sameContent(a, b)).toBe(true)
  })
  it('видит разницу в данных', () => {
    expect(sameContent(withExp([exp('x')]), withExp([exp('y')]))).toBe(false)
  })
})
