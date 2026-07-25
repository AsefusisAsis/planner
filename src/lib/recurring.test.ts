import { describe, it, expect } from 'vitest'
import { isEnded, amountForMonth } from './recurring'

describe('recurring / кредит с датой окончания', () => {
  it('бессрочный платёж никогда не завершён', () => {
    const r = { amount: 100 }
    expect(isEnded(r, '2026-01')).toBe(false)
    expect(isEnded(r, '2030-12')).toBe(false)
    expect(amountForMonth(r, '2026-05')).toBe(100)
  })

  it('не завершён до и в месяц окончания, завершён после', () => {
    const r = { amount: 300, endMonth: '2026-08' }
    expect(isEnded(r, '2026-07')).toBe(false) // до
    expect(isEnded(r, '2026-08')).toBe(false) // последний месяц — ещё платим
    expect(isEnded(r, '2026-09')).toBe(true) // после
    expect(isEnded(r, '2027-01')).toBe(true)
  })

  it('в последний месяц берётся lastAmount, в остальные — обычная сумма', () => {
    const r = { amount: 300, endMonth: '2026-08', lastAmount: 125.5 }
    expect(amountForMonth(r, '2026-06')).toBe(300)
    expect(amountForMonth(r, '2026-07')).toBe(300)
    expect(amountForMonth(r, '2026-08')).toBe(125.5) // остаток
  })

  it('без lastAmount последний месяц = обычная сумма', () => {
    const r = { amount: 300, endMonth: '2026-08' }
    expect(amountForMonth(r, '2026-08')).toBe(300)
  })

  it('lastAmount = 0 (закрыт досрочно, символический платёж) не путается с undefined', () => {
    const r = { amount: 300, endMonth: '2026-08', lastAmount: 0 }
    expect(amountForMonth(r, '2026-08')).toBe(0)
  })
})
