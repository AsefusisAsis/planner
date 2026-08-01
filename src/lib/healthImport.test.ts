import { describe, it, expect } from 'vitest'
import { planWeightImport, type HealthWeightSample } from './healthImport'

/** Замер в локальном времени — импорт группирует именно по локальной дате. */
const s = (time: string, kg: number): HealthWeightSample => ({ time, kg })

describe('planWeightImport / свои записи не трогаем', () => {
  it('день, где запись уже есть, пропускается', () => {
    const p = planWeightImport([{ date: '2026-03-10' }], [s('2026-03-10T08:00:00', 70)])
    expect(p.add).toEqual([])
    expect(p.skippedExisting).toBe(1)
  })

  it('ручная правка не переписывается значением из Health Connect', () => {
    // пользователь исправил опечатку — импорт не должен вернуть старое
    const p = planWeightImport(
      [{ date: '2026-03-10' }],
      [s('2026-03-10T23:59:00', 99.9)],
    )
    expect(p.add).toEqual([])
  })

  it('недостающие дни добавляются', () => {
    const p = planWeightImport(
      [{ date: '2026-03-10' }],
      [s('2026-03-10T08:00:00', 70), s('2026-03-11T08:00:00', 70.4)],
    )
    expect(p.add).toEqual([{ date: '2026-03-11', weight: 70.4 }])
    expect(p.skippedExisting).toBe(1)
  })
})

describe('planWeightImport / несколько замеров за день', () => {
  it('берётся последний по времени', () => {
    const p = planWeightImport(
      [],
      [s('2026-03-10T07:00:00', 70), s('2026-03-10T21:00:00', 71.2), s('2026-03-10T13:00:00', 70.8)],
    )
    expect(p.add).toEqual([{ date: '2026-03-10', weight: 71.2 }])
  })

  it('порядок замеров во входе не влияет на результат', () => {
    const asc = planWeightImport([], [s('2026-03-10T07:00:00', 70), s('2026-03-10T21:00:00', 71.2)])
    const desc = planWeightImport([], [s('2026-03-10T21:00:00', 71.2), s('2026-03-10T07:00:00', 70)])
    expect(asc.add).toEqual(desc.add)
  })
})

describe('planWeightImport / мусор не попадает в дневник', () => {
  it('ноль, отрицательные и нечисло отбрасываются', () => {
    const p = planWeightImport(
      [],
      [s('2026-03-10T08:00:00', 0), s('2026-03-11T08:00:00', -5), s('2026-03-12T08:00:00', NaN)],
    )
    expect(p.add).toEqual([])
    expect(p.skippedInvalid).toBe(3)
  })

  it('нечеловеческие значения отбрасываются (чужое приложение писало не то)', () => {
    const p = planWeightImport([], [s('2026-03-10T08:00:00', 900)])
    expect(p.add).toEqual([])
    expect(p.skippedInvalid).toBe(1)
  })

  it('битая дата замера отбрасывается, остальные проходят', () => {
    const p = planWeightImport([], [s('не дата', 70), s('2026-03-11T08:00:00', 70.5)])
    expect(p.add).toEqual([{ date: '2026-03-11', weight: 70.5 }])
    expect(p.skippedInvalid).toBe(1)
  })
})

describe('planWeightImport / точность и порядок', () => {
  it('округление до 0.1 кг', () => {
    const p = planWeightImport([], [s('2026-03-10T08:00:00', 70.44), s('2026-03-11T08:00:00', 70.46)])
    expect(p.add.map((x) => x.weight)).toEqual([70.4, 70.5])
  })

  it('добавления идут по возрастанию даты', () => {
    const p = planWeightImport(
      [],
      [s('2026-03-12T08:00:00', 71), s('2026-03-10T08:00:00', 70), s('2026-03-11T08:00:00', 70.5)],
    )
    expect(p.add.map((x) => x.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12'])
  })

  it('пустой вход — пустой план, без падения', () => {
    const p = planWeightImport([], [])
    expect(p).toEqual({ add: [], skippedExisting: 0, skippedInvalid: 0 })
  })
})
