import { describe, it, expect } from 'vitest'
import { convert, rateOf, formatMoney, amountInBase, quoteScale, type RateTable } from './rates'
import { amountStep } from '../types'

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

// ---------- Криптовалюты ----------
// Для расчётов крипта — обычная валюта в том же USD-пивоте: usdPerUnit[BTC]
// это просто цена монеты в долларах.
const withCrypto: RateTable = {
  usdPerUnit: { USD: 1, EUR: 1.1, BYN: 0.3, BTC: 60000, USDT: 1.0001 },
  fetchedAt: '2026-01-01T00:00:00.000Z',
  cryptoFetchedAt: '2026-01-01T00:00:00.000Z',
  source: 'er-api+nbrb+coingecko',
}

describe('крипта как валюта', () => {
  it('BTC → USD по цене монеты', () => {
    expect(convert(0.5, 'BTC', 'USD', withCrypto)).toBeCloseTo(30000)
  })
  it('кросс BTC → EUR идёт через тот же USD-пивот', () => {
    // 0.1 BTC = 6000 USD = 6000/1.1 EUR ≈ 5454.55
    expect(convert(0.1, 'BTC', 'EUR', withCrypto)).toBeCloseTo(5454.55, 1)
  })
  it('фиат → крипта: 30000 USD это 0.5 BTC', () => {
    expect(convert(30000, 'USD', 'BTC', withCrypto)).toBeCloseTo(0.5)
  })
  it('крипта → крипта через USD', () => {
    expect(convert(60000, 'USDT', 'BTC', withCrypto)).toBeCloseTo(1.0001)
  })
  it('нет крипто-курса (источник недоступен) — null, а не подстановка', () => {
    expect(convert(1, 'ETH', 'USD', table)).toBeNull()
    expect(convert(1, 'USD', 'ETH', table)).toBeNull()
  })
  it('снимок «курс на момент операции» работает и для крипты', () => {
    // трата 0.01 BTC со снимком в USD — берём снимок, а не текущий курс
    const e = { amount: 0.01, currency: 'BTC' as const, baseAmount: 450, baseCur: 'USD' as const }
    expect(amountInBase(e, 'USD', withCrypto)).toBe(450)
  })
})

describe('formatMoney: дробность по валюте', () => {
  it('мелкая сумма в BTC не округляется в ноль', () => {
    const s = formatMoney(0.00042, 'BTC')
    expect(s).toContain('₿')
    expect(s).not.toMatch(/^0,00\s/)
    expect(s.replace(/\s/g, '')).toContain('0,00042')
  })
  it('целое число BTC показывается с двумя знаками, а не восемью', () => {
    expect(formatMoney(2, 'BTC').replace(/\s/g, '')).toBe('2,00₿')
  })
  it('стейблкоину хватает двух знаков', () => {
    expect(formatMoney(12.3456, 'USDT').replace(/\s/g, '')).toBe('12,35USDT')
  })
  it('фиат по-прежнему с двумя знаками', () => {
    expect(formatMoney(12.3456, 'USD').replace(/\s/g, '')).toBe('12,35$')
  })
})

describe('вьетнамский донг (VND)', () => {
  // ~26 000 ₫ за доллар → 1 ₫ ≈ 0.0000385 USD
  const vnd: RateTable = { ...table, usdPerUnit: { ...table.usdPerUnit, VND: 1 / 26000 } }

  it('суммы без копеек: у донга нет разменной монеты', () => {
    expect(formatMoney(1250000, 'VND').replace(/\s/g, '')).toBe('1250000₫')
    expect(formatMoney(1250000.4, 'VND').replace(/\s/g, '')).toBe('1250000₫')
  })
  it('поле ввода суммы — целыми', () => {
    expect(amountStep('VND')).toBe('1')
    expect(amountStep('USD')).toBe('0.01')
  })
  it('конвертация через USD-пивот', () => {
    expect(convert(26000, 'VND', 'USD', vnd)).toBeCloseTo(1, 6)
    expect(convert(1, 'USD', 'VND', vnd)).toBeCloseTo(26000, 6)
  })
})

describe('quoteScale: за сколько единиц показывать курс', () => {
  it('крупные валюты — за 1', () => {
    expect(quoteScale(3.3)).toBe(1)
    expect(quoteScale(0.1)).toBe(1)
  })
  it('рубль/тенге — за 100, как было до донга', () => {
    expect(quoteScale(0.037)).toBe(100) // RUB к BYN
    expect(quoteScale(0.0063)).toBe(100) // KZT к BYN — 0.63 за 100, не трогаем
    expect(quoteScale(0.001)).toBe(100)
  })
  it('донг — за 10 000 к BYN и за 100 000 к USD, число читается', () => {
    const toByn = 1 / 26000 / 0.3 // ~0.000128 BYN за 1 ₫
    expect(quoteScale(toByn)).toBe(10000)
    expect(toByn * 10000).toBeGreaterThanOrEqual(1)
    expect(quoteScale(1 / 26000)).toBe(100000)
  })
})
