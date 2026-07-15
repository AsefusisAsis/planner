import { describe, it, expect } from 'vitest'
import { computeCycle, periodsFromDays, addDays, diffDays } from './cycle'

// helper: диапазон дней менструации от старта
const period = (start: string, len: number) =>
  Array.from({ length: len }, (_, i) => addDays(start, i))

describe('date helpers', () => {
  it('addDays через границу месяца', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })
  it('diffDays', () => {
    expect(diffDays('2026-03-01', '2026-03-29')).toBe(28)
    expect(diffDays('2026-03-29', '2026-03-01')).toBe(-28)
  })
})

describe('periodsFromDays', () => {
  it('группирует непрерывные дни в один период', () => {
    const { starts, lengths } = periodsFromDays([
      ...period('2026-03-01', 5),
      ...period('2026-03-29', 4),
    ])
    expect(starts).toEqual(['2026-03-01', '2026-03-29'])
    expect(lengths).toEqual([5, 4])
  })
  it('дедуп и сортировка', () => {
    const { starts } = periodsFromDays(['2026-03-02', '2026-03-01', '2026-03-01'])
    expect(starts).toEqual(['2026-03-01'])
  })
})

describe('computeCycle', () => {
  it('нет данных → unknown, без прогноза, дефолты 28/5', () => {
    const c = computeCycle([], '2026-03-10')
    expect(c.phase).toBe('unknown')
    expect(c.hasPrediction).toBe(false)
    expect(c.avgCycle).toBe(28)
    expect(c.avgPeriod).toBe(5)
    expect(c.nextPeriodDate).toBeNull()
  })

  it('два цикла по 28 дней → avgCycle 28, прогноз следующей менструации', () => {
    const days = [...period('2026-01-01', 5), ...period('2026-01-29', 5)]
    // «сегодня» на 2-й день последнего цикла
    const c = computeCycle(days, '2026-01-30')
    expect(c.avgCycle).toBe(28)
    expect(c.avgPeriod).toBe(5)
    expect(c.hasPrediction).toBe(true)
    expect(c.dayOfCycle).toBe(2)
    expect(c.phase).toBe('menstruation')
    expect(c.nextPeriodDate).toBe('2026-02-26') // 2026-01-29 + 28
  })

  it('фазы по дню цикла (цикл 28, период 5)', () => {
    const days = [...period('2026-01-01', 5), ...period('2026-01-29', 5)]
    const start = '2026-01-29'
    // день 3 — менструация
    expect(computeCycle(days, addDays(start, 2)).phase).toBe('menstruation')
    // день 9 — фолликулярная (до овуляции)
    expect(computeCycle(days, addDays(start, 8)).phase).toBe('follicular')
    // овуляция ≈ следующий старт (28) − 14 = день 15 → проверяем окрестность
    expect(computeCycle(days, addDays(start, 13)).phase).toBe('ovulation') // день 14
    // день 22 — лютеиновая
    expect(computeCycle(days, addDays(start, 21)).phase).toBe('luteal')
  })

  it('фертильное окно вокруг овуляции, с дисклеймером-семантикой (окно = оценка)', () => {
    const days = [...period('2026-01-01', 5), ...period('2026-01-29', 5)]
    const c = computeCycle(days, '2026-02-05')
    // овуляция = nextPeriod(2026-02-26) − 14 = 2026-02-12
    expect(c.ovulationDate).toBe('2026-02-12')
    expect(c.fertileStart).toBe('2026-02-07') // ов − 5
    expect(c.fertileEnd).toBe('2026-02-13') // ов + 1
  })

  it('устаревшие данные (>1.5 цикла) → фаза unknown, но прогноз есть', () => {
    const days = [...period('2026-01-01', 5), ...period('2026-01-29', 5)]
    const c = computeCycle(days, '2026-04-01') // далеко после последнего старта
    expect(c.phase).toBe('unknown')
    expect(c.dayOfCycle).toBeNull()
    expect(c.nextPeriodDate).not.toBeNull()
    expect(diffDays('2026-04-01', c.nextPeriodDate!)).toBeGreaterThanOrEqual(0) // в будущем
  })

  it('РЕГРЕСС: фертильное окно/овуляция НЕ в прошлом (лютеиновая фаза)', () => {
    // старт 1 июля, сегодня 20 июля — овуляция ~15 июля уже прошла;
    // должно показывать СЛЕДУЮЩЕЕ фертильное окно (в будущем), а не прошлое
    const days = period('2026-07-01', 5)
    const c = computeCycle(days, '2026-07-20')
    expect(c.phase).toBe('luteal')
    // фертильное окно заканчивается не раньше сегодня
    expect(diffDays('2026-07-20', c.fertileEnd!)).toBeGreaterThanOrEqual(0)
    expect(diffDays('2026-07-20', c.ovulationDate!)).toBeGreaterThanOrEqual(-1)
  })

  it('РЕГРЕСС: отметка менструации в будущем не даёт фертильное окно в прошлом', () => {
    // «сегодня» 13 июля, менструация отмечена на 15 июля (как в баг-репорте)
    const c = computeCycle(['2026-07-15'], '2026-07-13')
    expect(diffDays('2026-07-13', c.fertileEnd!)).toBeGreaterThanOrEqual(0) // окно не в прошлом
    expect(diffDays('2026-07-13', c.ovulationDate!)).toBeGreaterThanOrEqual(-1)
  })

  it('нерегулярный цикл: avgCycle = среднее, клампится в [21,45]', () => {
    // старты: +26, +30 → среднее 28
    const days = [
      ...period('2026-01-01', 4),
      ...period('2026-01-27', 4),
      ...period('2026-02-26', 4),
    ]
    const c = computeCycle(days, '2026-02-27')
    expect(c.avgCycle).toBe(28)
  })
})
