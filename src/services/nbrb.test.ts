import { describe, it, expect } from 'vitest'
import { convert, formatMoney, type RateTable } from './nbrb'

const table: RateTable = {
  bynPerUnit: { BYN: 1, USD: 3, RUB: 0.04 },
  fetchedAt: '2026-01-01T00:00:00.000Z',
}

describe('convert', () => {
  it('та же валюта — без изменений', () => {
    expect(convert(10, 'USD', 'USD', table)).toBe(10)
  })
  it('нет курса — null, а не молчаливое 1:1', () => {
    expect(convert(10, 'EUR', 'BYN', table)).toBeNull()
    expect(convert(10, 'BYN', 'EUR', table)).toBeNull()
  })
  it('та же валюта без курса в таблице — всё равно без изменений', () => {
    expect(convert(5, 'EUR', 'EUR', table)).toBe(5)
  })
  it('USD → BYN по курсу', () => {
    expect(convert(10, 'USD', 'BYN', table)).toBe(30)
  })
  it('BYN → USD обратно', () => {
    expect(convert(30, 'BYN', 'USD', table)).toBe(10)
  })
  it('RUB → BYN', () => {
    expect(convert(100, 'RUB', 'BYN', table)).toBeCloseTo(4)
  })
})

describe('formatMoney', () => {
  it('содержит сумму и символ валюты', () => {
    const s = formatMoney(10, 'USD')
    expect(s).toContain('$')
    expect(s).toContain('10')
  })
})
