import { describe, it, expect } from 'vitest'
import { convert, rateOf, formatMoney, amountInBase, type RateTable } from './rates'

// usdPerUnit: USD за 1 единицу. USD=1, EUR=1.1 (1 EUR = 1.1 USD),
// BYN=0.3 (1 BYN = 0.3 USD → ~3.33 BYN за USD, официальный НБРБ-оверрайд)
const table: RateTable = {
  usdPerUnit: { USD: 1, EUR: 1.1, BYN: 0.3 },
  fetchedAt: '2026-01-01T00:00:00.000Z',
  source: 'er-api+nbrb',
}

describe('convert (пивот USD)', () => {
  it('та же валюта — без изменений (даже без курса в таблице)', () => {
    expect(convert(10, 'USD', 'USD', table)).toBe(10)
    expect(convert(5, 'PLN', 'PLN', table)).toBe(5)
  })
  it('нет курса — null, а не молчаливое 1:1', () => {
    expect(convert(10, 'PLN', 'USD', table)).toBeNull()
    expect(convert(10, 'USD', 'PLN', table)).toBeNull()
  })
  it('EUR → USD по курсу', () => {
    expect(convert(10, 'EUR', 'USD', table)).toBeCloseTo(11)
  })
  it('USD → BYN (официальный оверрайд)', () => {
    // 1 USD = 1/0.3 BYN ≈ 3.333
    expect(convert(1, 'USD', 'BYN', table)).toBeCloseTo(3.3333, 3)
  })
  it('кросс EUR → BYN через USD-пивот', () => {
    // 10 EUR = 11 USD = 11/0.3 BYN ≈ 36.667
    expect(convert(10, 'EUR', 'BYN', table)).toBeCloseTo(36.667, 2)
  })
  it('туда-обратно даёт исходное', () => {
    const there = convert(100, 'BYN', 'EUR', table)!
    expect(convert(there, 'EUR', 'BYN', table)).toBeCloseTo(100, 6)
  })
})

describe('rateOf', () => {
  it('единиц quote за 1 base', () => {
    expect(rateOf('USD', 'BYN', table)).toBeCloseTo(3.3333, 3)
    expect(rateOf('EUR', 'USD', table)).toBeCloseTo(1.1, 6)
  })
})

describe('amountInBase (курс на момент траты)', () => {
  it('та же валюта — сумма как есть, курс не нужен', () => {
    expect(amountInBase({ amount: 50, currency: 'BYN' }, 'BYN', null)).toBe(50)
  })
  it('снимок в той же базе — фиксированное значение (не пересчёт по текущему)', () => {
    // трата 10 EUR со снимком 33 BYN; текущий курс дал бы 36.67 — берём снимок
    const e = { amount: 10, currency: 'EUR' as const, baseAmount: 33, baseCur: 'BYN' as const }
    expect(amountInBase(e, 'BYN', table)).toBe(33)
  })
  it('снимок в другой базе — игнор, live-пересчёт по текущему курсу', () => {
    const e = { amount: 10, currency: 'EUR' as const, baseAmount: 33, baseCur: 'USD' as const }
    // отображаем в BYN: снимок был в USD → fallback: 10 EUR → BYN ≈ 36.667
    expect(amountInBase(e, 'BYN', table)).toBeCloseTo(36.667, 2)
  })
  it('старая запись без снимка — live-пересчёт', () => {
    expect(amountInBase({ amount: 10, currency: 'EUR' }, 'USD', table)).toBeCloseTo(11)
  })
  it('нет курса и валюта иная — null (пропуск в итогах)', () => {
    expect(amountInBase({ amount: 10, currency: 'EUR' }, 'BYN', null)).toBeNull()
  })
})

describe('formatMoney', () => {
  it('символ известной валюты', () => {
    expect(formatMoney(10, 'USD')).toContain('$')
    expect(formatMoney(10, 'BYN')).toContain('Br')
    expect(formatMoney(10, 'PLN')).toContain('zł')
  })
  it('сумма присутствует', () => {
    expect(formatMoney(1234.5, 'EUR')).toContain('€')
    expect(formatMoney(1234.5, 'EUR').replace(/\s/g, '')).toMatch(/1234[.,]50/)
  })
})
