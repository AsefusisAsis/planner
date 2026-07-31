import { describe, it, expect } from 'vitest'
import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  FIAT_CURRENCIES,
  CRYPTO_CURRENCIES,
  amountStep,
  createEmptyData,
  fractionDigits,
  isCrypto,
  usesCrypto,
  type AppData,
  type Currency,
} from './types'

const data = (over: Partial<AppData> = {}): AppData => ({ ...createEmptyData(), ...over })

describe('каталог валют', () => {
  it('общий список — это фиат плюс крипта, без дублей', () => {
    expect(CURRENCIES).toEqual([...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES])
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length)
  })
  it('у каждой валюты есть символ или тикер', () => {
    for (const c of CURRENCIES) expect(CURRENCY_SYMBOLS[c]).toBeTruthy()
  })
  it('isCrypto различает фиат и крипту', () => {
    expect(isCrypto('BTC')).toBe(true)
    expect(isCrypto('USDT')).toBe(true)
    expect(isCrypto('USD')).toBe(false)
    expect(isCrypto('BYN')).toBe(false)
  })
})

describe('дробность и шаг ввода', () => {
  it('фиату — два знака и шаг 0.01', () => {
    expect(fractionDigits('USD')).toEqual({ min: 2, max: 2 })
    expect(amountStep('USD')).toBe('0.01')
  })
  it('BTC — до восьми знаков, иначе мелкую сумму не ввести и не показать', () => {
    expect(fractionDigits('BTC').max).toBe(8)
    expect(amountStep('BTC')).toBe('0.00000001')
  })
  it('стейблкоины ведут себя как доллар', () => {
    expect(fractionDigits('USDT')).toEqual({ min: 2, max: 2 })
    expect(amountStep('USDC')).toBe('0.01')
  })
})

describe('usesCrypto — нужно ли дёргать крипто-источник курсов', () => {
  it('пустые данные — не нужно', () => {
    expect(usesCrypto(data())).toBe(false)
  })
  it('базовая валюта — крипта', () => {
    const d = data()
    d.settings.baseCurrency = 'USDT'
    expect(usesCrypto(d)).toBe(true)
  })
  it('крипта в тикере курсов', () => {
    const d = data()
    d.settings.displayCurrencies = ['USD', 'BTC']
    expect(usesCrypto(d)).toBe(true)
  })
  it('крипта в трате', () => {
    const d = data({
      expenses: [
        {
          id: 'e1',
          amount: 0.01,
          currency: 'BTC' as Currency,
          date: '2026-01-01',
          type: 'expense',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ] as AppData['expenses'],
    })
    expect(usesCrypto(d)).toBe(true)
  })
  it('крипта в повторяющемся платеже', () => {
    const d = data({
      recurringExpenses: [
        {
          id: 'r1',
          label: 'VPN',
          amount: 5,
          currency: 'USDT' as Currency,
          dayOfMonth: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ] as AppData['recurringExpenses'],
    })
    expect(usesCrypto(d)).toBe(true)
  })
  it('только фиат — не нужно', () => {
    const d = data({
      expenses: [
        {
          id: 'e1',
          amount: 10,
          currency: 'EUR' as Currency,
          date: '2026-01-01',
          type: 'expense',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ] as AppData['expenses'],
    })
    d.settings.displayCurrencies = ['USD', 'EUR']
    expect(usesCrypto(d)).toBe(false)
  })
})
