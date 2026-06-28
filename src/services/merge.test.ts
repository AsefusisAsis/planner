import { describe, it, expect } from 'vitest'
import { merge3 } from './merge'
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
