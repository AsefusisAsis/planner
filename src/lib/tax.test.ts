import { describe, it, expect } from 'vitest'
import { computeTax, prevMonthKey } from './tax'

describe('tax / расчёт налога с доходов', () => {
  it('процент от дохода с округлением до 2 знаков', () => {
    expect(computeTax(1000, 6)).toBe(60)
    expect(computeTax(1234.56, 13)).toBe(160.49) // 160.4928 → 160.49
    expect(computeTax(100, 6.5)).toBe(6.5)
  })

  it('нулевой/отрицательный доход или ставка → 0', () => {
    expect(computeTax(0, 6)).toBe(0)
    expect(computeTax(-500, 6)).toBe(0)
    expect(computeTax(1000, 0)).toBe(0)
    expect(computeTax(1000, -1)).toBe(0)
  })

  it('предыдущий месяц, в т.ч. переход через год', () => {
    expect(prevMonthKey('2026-07')).toBe('2026-06')
    expect(prevMonthKey('2026-01')).toBe('2025-12')
    expect(prevMonthKey('2026-12')).toBe('2026-11')
  })
})
