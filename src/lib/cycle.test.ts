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

  it('регулярность: <2 промежутков → unknown', () => {
    const c = computeCycle([...period('2026-01-01', 4), ...period('2026-01-29', 4)], '2026-01-30')
    expect(c.regularity).toBe('unknown') // только 1 промежуток
    expect(c.loggedCycles).toBe(1)
  })

  it('регулярность: ровные циклы (28/28) → regular, но диапазон всё равно есть', () => {
    const days = [...period('2026-01-01', 4), ...period('2026-01-29', 4), ...period('2026-02-26', 4)]
    const c = computeCycle(days, '2026-02-27')
    expect(c.regularity).toBe('regular')
    expect(c.minCycle).toBe(28)
    expect(c.maxCycle).toBe(28)
    // прогноз ВСЕГДА диапазоном: 2 цикла → минимум ±4 (не 0)
    expect(c.predictSpread).toBe(4)
    expect(c.loggedCycles).toBe(2)
  })

  it('диапазон сужается с ростом истории: 6+ циклов → ±2', () => {
    // 7 стартов подряд по 28 дней → 6 промежутков, все ровные
    const starts = Array.from({ length: 7 }, (_, i) => addDays('2026-01-01', i * 28))
    const days = starts.flatMap((s) => period(s, 4))
    const c = computeCycle(days, addDays(starts[6], 1))
    expect(c.loggedCycles).toBe(6)
    expect(c.regularity).toBe('regular')
    expect(c.predictSpread).toBe(2) // 6+ циклов → минимум ±2
  })

  it('уверенность: нет данных → unknown; много ровных циклов → high', () => {
    expect(computeCycle([], '2026-03-10').confidence).toBe('unknown')
    const starts = Array.from({ length: 7 }, (_, i) => addDays('2026-01-01', i * 28))
    const days = starts.flatMap((s) => period(s, 4))
    const c = computeCycle(days, addDays(starts[6], 1))
    expect(c.confidence).toBe('high')
    expect(c.confidenceScore).toBeGreaterThanOrEqual(75)
  })

  it('уверенность: один залогированный цикл → low (тонкая история)', () => {
    const days = [...period('2026-01-01', 4), ...period('2026-01-29', 4)]
    const c = computeCycle(days, '2026-01-30')
    expect(c.loggedCycles).toBe(1)
    expect(c.confidence).toBe('medium') // 1 цикл: не low (прогноз есть), но и не high
    expect(c.hasPrediction).toBe(true)
  })

  it('диапазон учитывает реальный разброс даже у «регулярного» цикла (без скачка на границе)', () => {
    // 7 стартов, разброс 6 дней (≤7 → regular), но окно должно быть ±3, не ±2
    const gaps = [28, 28, 28, 28, 28, 34]
    let acc = 0
    const startsAt = [0, ...gaps.map((g) => (acc += g))]
    const days = startsAt.flatMap((off) => period(addDays('2026-01-01', off), 4))
    const last = addDays('2026-01-01', startsAt[startsAt.length - 1])
    const c = computeCycle(days, addDays(last, 1))
    expect(c.regularity).toBe('regular')
    expect(c.loggedCycles).toBe(6)
    expect(c.predictSpread).toBe(3) // round(6/2)=3 > minWidth(2)
  })

  it('уверенность: устаревший (заброшенный) лог НЕ показывает «высокую»', () => {
    const starts = Array.from({ length: 7 }, (_, i) => addDays('2026-01-01', i * 28))
    const days = starts.flatMap((s) => period(s, 4))
    // «сегодня» через 60 дней после последнего старта (>1.5×28 → устарело)
    const c = computeCycle(days, addDays(starts[6], 60))
    expect(c.phase).toBe('unknown')
    expect(c.confidence).toBe('low') // сильная история, но данные старые
    expect(c.nextPeriodDate).not.toBeNull()
  })

  it('уверенность: нерегулярные циклы снижают уровень', () => {
    // разброс 24..34 → высокая вариативность → не high даже при свежести
    const days = [...period('2026-01-01', 4), ...period('2026-01-25', 4), ...period('2026-02-28', 4)]
    const c = computeCycle(days, '2026-03-01')
    expect(c.regularity).toBe('irregular')
    expect(c.confidence).not.toBe('high')
  })

  it('регулярность: разброс >7 дней → irregular, есть ± разброс прогноза', () => {
    // промежутки 24 и 34 → разброс 10 (>7)
    const days = [...period('2026-01-01', 4), ...period('2026-01-25', 4), ...period('2026-02-28', 4)]
    const c = computeCycle(days, '2026-03-01')
    expect(c.regularity).toBe('irregular')
    expect(c.minCycle).toBe(24)
    expect(c.maxCycle).toBe(34)
    expect(c.predictSpread).toBe(5) // round(10/2)
  })

  it('задержка считается от КОНЦА окна прогноза, а не от точечной даты', () => {
    // Цикл 28, один залогированный промежуток → окно ±4 (мало истории).
    // Ожидаемая 2026-02-26, конец окна 2026-03-02. Сегодня 2026-03-03 → +1.
    // Раньше считалось от точки (было бы 5) — но мы сами обещали диапазон,
    // и называть задержкой день внутри обещанного окна нечестно.
    const days = [...period('2026-01-01', 4), ...period('2026-01-29', 4)]
    const c = computeCycle(days, '2026-03-03')
    expect(c.predictSpread).toBe(4)
    expect(c.daysLate).toBe(1)
  })

  it('внутри окна прогноза задержки нет, даже если точечная дата прошла', () => {
    const days = [...period('2026-01-01', 4), ...period('2026-01-29', 4)]
    // 2026-02-28: точка (26-е) прошла, но окно ±4 ещё не кончилось
    expect(computeCycle(days, '2026-02-28').daysLate).toBeNull()
  })

  it('нет задержки, когда цикл в норме', () => {
    const days = [...period('2026-01-01', 4), ...period('2026-01-29', 4)]
    expect(computeCycle(days, '2026-02-10').daysLate).toBeNull()
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

// ---------------------------------------------------------------------------
// Цикл P1: точность движка — медиана вместо среднего, отсев нетипичных
// циклов, spotting и пропущенные дни внутри периода.
// ---------------------------------------------------------------------------
describe('computeCycle / P1: устойчивость оценки', () => {
  /** Собирает дни менструации по списку промежутков между стартами. */
  const fromGaps = (gaps: number[], len = 4, from = '2026-01-01') => {
    let acc = 0
    const offsets = [0, ...gaps.map((g) => (acc += g))]
    return {
      days: offsets.flatMap((o) => period(addDays(from, o), len)),
      last: addDays(from, offsets[offsets.length - 1]),
    }
  }

  it('нетипичный цикл не утаскивает оценку за собой (медиана, не среднее)', () => {
    // пять ровных по 28 и один сбойный 60: среднее дало бы ~33, медиана 28
    const { days, last } = fromGaps([28, 28, 28, 28, 60])
    const c = computeCycle(days, addDays(last, 1))
    expect(c.avgCycle).toBe(28)
  })

  it('нетипичный цикл исключён из оценки, но остаётся в истории', () => {
    const { days, last } = fromGaps([28, 28, 28, 28, 60])
    const c = computeCycle(days, addDays(last, 1))
    // история честная: разброс виден, число циклов не урезано
    expect(c.loggedCycles).toBe(5)
    expect(c.minCycle).toBe(28)
    expect(c.maxCycle).toBe(60)
    // но окно прогноза не раздуто выбросом
    expect(c.predictSpread).toBe(3)
  })

  it('свежие циклы весомее старых при смене паттерна', () => {
    // цикл был 26, стал 32; медиана без весов дала бы 29
    const { days, last } = fromGaps([26, 26, 26, 32, 32, 32])
    const c = computeCycle(days, addDays(last, 1))
    expect(c.avgCycle).toBe(32)
  })

  it('пропущенный день внутри менструации не разрывает её на два цикла', () => {
    // 1,2, (пропуск 3), 4 — это ОДИН период, а не два старта
    const days = ['2026-01-01', '2026-01-02', '2026-01-04']
    const { starts, lengths } = periodsFromDays(days)
    expect(starts).toEqual(['2026-01-01'])
    expect(lengths).toEqual([4])
  })

  it('две отметки ближе 10 дней — один период, а не новый цикл', () => {
    const { starts } = periodsFromDays([...period('2026-01-01', 3), '2026-01-08'])
    expect(starts).toEqual(['2026-01-01'])
  })

  it('мазня не открывает менструацию, старт — по первому настоящему дню', () => {
    const days = [
      { date: '2026-01-01', flow: 'spotting' },
      { date: '2026-01-02', flow: 'medium' },
      { date: '2026-01-03', flow: 'medium' },
    ]
    const { starts, lengths } = periodsFromDays(days)
    expect(starts).toEqual(['2026-01-02'])
    expect(lengths).toEqual([2])
  })

  it('мазня внутри уже идущей менструации её продолжает', () => {
    const days = [
      { date: '2026-01-01', flow: 'medium' },
      { date: '2026-01-02', flow: 'medium' },
      { date: '2026-01-03', flow: 'spotting' },
    ]
    const { starts, lengths } = periodsFromDays(days)
    expect(starts).toEqual(['2026-01-01'])
    expect(lengths).toEqual([3])
  })

  it('мазня перед циклом не сдвигает прогноз назад', () => {
    // старты 01-02 и 01-30 (цикл 28); перед вторым — мазня 01-29
    const days = [
      ...period('2026-01-02', 4).map((d) => ({ date: d, flow: 'medium' })),
      { date: '2026-01-29', flow: 'spotting' },
      ...period('2026-01-30', 4).map((d) => ({ date: d, flow: 'medium' })),
    ]
    const c = computeCycle(days, '2026-02-01')
    expect(c.avgCycle).toBe(28) // а не 27, как было бы со стартом на мазне
  })

  it('длина менструации — медиана: один затяжной период не растягивает оценку', () => {
    const days = [
      ...period('2026-01-01', 4),
      ...period('2026-01-29', 4),
      ...period('2026-02-26', 10),
    ]
    expect(computeCycle(days, '2026-02-27').avgPeriod).toBe(4)
  })
})
