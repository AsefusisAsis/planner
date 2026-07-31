import { describe, it, expect } from 'vitest'
import { analyzeSymptoms, computePms, type CycleLogDay } from './cycleSymptoms'
import { addDays } from './cycle'

const START = '2026-01-05'
const LEN = 28
const PERIOD_LEN = 4

/** Дата дня N (1-based) цикла с индексом ci при ровном цикле в 28 дней. */
const day = (ci: number, n: number) => addDays(START, ci * LEN + (n - 1))

/**
 * Собирает дневник: cycles ровных циклов по 28 дней с менструацией 1-4 день.
 * symptoms — карта «индекс цикла → день цикла → список симптомов».
 */
function log(
  cycles: number,
  symptoms: Record<number, Record<number, string[]>> = {},
): CycleLogDay[] {
  const out: CycleLogDay[] = []
  const push = (date: string, patch: Partial<CycleLogDay>) => {
    const found = out.find((e) => e.date === date)
    if (found) Object.assign(found, patch)
    else out.push({ date, ...patch })
  }
  for (let ci = 0; ci < cycles; ci++) {
    for (let d = 1; d <= PERIOD_LEN; d++) push(day(ci, d), { period: true, flow: 'medium' })
  }
  for (const [ci, byDay] of Object.entries(symptoms))
    for (const [d, list] of Object.entries(byDay))
      push(day(Number(ci), Number(d)), { symptoms: list })
  return out
}

describe('analyzeSymptoms / порог доказательности', () => {
  it('без истории паттернов нет и сказано, сколько циклов не хватает', () => {
    const a = analyzeSymptoms([])
    expect(a.patterns).toEqual([])
    expect(a.enoughData).toBe(false)
    expect(a.cyclesAnalyzed).toBe(0)
    expect(a.cyclesNeeded).toBe(3)
  })

  it('трёх стартов (= 2 завершённых цикла) ещё мало — нужен ещё один', () => {
    const a = analyzeSymptoms(log(3, { 0: { 2: ['cramps'] }, 1: { 2: ['cramps'] } }))
    expect(a.cyclesAnalyzed).toBe(2)
    expect(a.enoughData).toBe(false)
    expect(a.cyclesNeeded).toBe(1)
    expect(a.patterns).toEqual([])
  })

  it('одного совпадения мало: симптом в 1 цикле из 3 не паттерн', () => {
    const a = analyzeSymptoms(log(4, { 0: { 2: ['cramps'] } }))
    expect(a.enoughData).toBe(true)
    expect(a.cyclesAnalyzed).toBe(3)
    expect(a.patterns).toEqual([])
  })

  it('реже половины циклов — не «обычно» (2 из 5)', () => {
    const a = analyzeSymptoms(log(6, { 0: { 2: ['acne'] }, 1: { 2: ['acne'] } }))
    expect(a.cyclesAnalyzed).toBe(5)
    expect(a.patterns.map((p) => p.symptom)).toEqual([])
  })

  it('половина циклов — уже паттерн (3 из 6)', () => {
    const a = analyzeSymptoms(
      log(7, { 0: { 2: ['acne'] }, 1: { 2: ['acne'] }, 2: { 2: ['acne'] } }),
    )
    expect(a.cyclesAnalyzed).toBe(6)
    expect(a.patterns.map((p) => p.symptom)).toEqual(['acne'])
    expect(a.patterns[0].rate).toBeCloseTo(0.5)
  })
})

describe('analyzeSymptoms / привязка паттерна', () => {
  it('симптом в начале цикла описывается днями цикла', () => {
    const a = analyzeSymptoms(
      log(4, {
        0: { 1: ['cramps'], 2: ['cramps'] },
        1: { 2: ['cramps'], 3: ['cramps'] },
        2: { 1: ['cramps'] },
      }),
    )
    const p = a.patterns[0]
    expect(p.symptom).toBe('cramps')
    expect(p.anchor).toBe('cycleStart')
    expect(p.premenstrual).toBe(false)
    expect(p.typical).toBe(1) // медиана первых появлений: 1, 2, 1
    expect(p.from).toBe(1)
    expect(p.to).toBe(2)
    expect(p.cycles).toBe(3)
    expect(p.days).toBe(5)
  })

  it('симптом перед менструацией описывается обратным отсчётом', () => {
    // цикл 28 дней: день 27 = за 2 дня до следующей менструации, день 26 = за 3.
    // Симптом длится ОДИН день, поэтому и показать надо один день, а не
    // диапазон: 3 в одном цикле из трёх — это разброс между циклами, а не
    // «обычно тянется с 3-го по 2-й день».
    const a = analyzeSymptoms(
      log(4, { 0: { 27: ['headache'] }, 1: { 26: ['headache'] }, 2: { 27: ['headache'] } }),
    )
    const p = a.patterns[0]
    expect(p.anchor).toBe('beforePeriod')
    expect(p.premenstrual).toBe(true)
    expect(p.from).toBe(2)
    expect(p.to).toBe(2)
    expect(p.typical).toBe(2)
  })

  it('диапазон — это размах внутри цикла, а не разброс между циклами', () => {
    // усталость каждый цикл идёт два дня: за 3 и за 2 дня до менструации
    const a = analyzeSymptoms(
      log(4, {
        0: { 26: ['fatigue'], 27: ['fatigue'] },
        1: { 26: ['fatigue'], 27: ['fatigue'] },
        2: { 26: ['fatigue'], 27: ['fatigue'] },
      }),
    )
    const p = a.patterns[0]
    expect(p.from).toBe(3) // «за 3…2 дн. до менструации»
    expect(p.to).toBe(2)
    expect(p.typical).toBe(2) // назвать одним числом — ближайший к менструации
  })

  it('симптом длиной в несколько дней в начале цикла показывает свой размах', () => {
    const a = analyzeSymptoms(
      log(4, {
        0: { 1: ['cramps'], 2: ['cramps'], 3: ['cramps'] },
        1: { 1: ['cramps'], 2: ['cramps'], 3: ['cramps'] },
        2: { 1: ['cramps'], 2: ['cramps'], 3: ['cramps'] },
      }),
    )
    const p = a.patterns[0]
    expect(p.anchor).toBe('cycleStart')
    expect(p.from).toBe(1)
    expect(p.to).toBe(3)
    expect(p.typical).toBe(1)
  })

  it('середина цикла не считается предменструальной', () => {
    const a = analyzeSymptoms(
      log(4, { 0: { 14: ['bloating'] }, 1: { 14: ['bloating'] }, 2: { 15: ['bloating'] } }),
    )
    const p = a.patterns[0]
    expect(p.premenstrual).toBe(false)
    expect(p.anchor).toBe('cycleStart')
    expect(p.typical).toBe(14)
  })
})

describe('analyzeSymptoms / что в расчёт не идёт', () => {
  it('незавершённый (текущий) цикл не занижает частоту', () => {
    // симптом есть в 3 завершённых циклах из 3; в 4-м (текущем) его ещё нет
    const a = analyzeSymptoms(
      log(4, { 0: { 2: ['cramps'] }, 1: { 2: ['cramps'] }, 2: { 2: ['cramps'] } }),
    )
    expect(a.cyclesAnalyzed).toBe(3)
    expect(a.patterns[0].rate).toBe(1)
  })

  it('отметки текущего цикла не попадают в статистику', () => {
    const a = analyzeSymptoms(
      log(4, {
        0: { 2: ['cramps'] },
        1: { 2: ['cramps'] },
        2: { 2: ['cramps'] },
        3: { 2: ['cramps'], 3: ['cramps'] }, // текущий цикл
      }),
    )
    expect(a.patterns[0].days).toBe(3) // 4-й цикл не завершён — его дни не учтены
  })

  it('симптомы до первой менструации игнорируются (день цикла неизвестен)', () => {
    const entries = log(4, { 0: { 2: ['cramps'] }, 1: { 2: ['cramps'] }, 2: { 2: ['cramps'] } })
    entries.unshift({ date: addDays(START, -10), symptoms: ['cramps'] })
    const a = analyzeSymptoms(entries)
    expect(a.patterns[0].days).toBe(3)
  })

  it('несколько симптомов сортируются по устойчивости', () => {
    const a = analyzeSymptoms(
      log(5, {
        0: { 2: ['cramps', 'acne'] },
        1: { 2: ['cramps', 'acne'] },
        2: { 2: ['cramps'] },
        3: { 2: ['cramps'] },
      }),
    )
    // cramps в 4 циклах из 4, acne — в 2 из 4
    expect(a.patterns.map((p) => p.symptom)).toEqual(['cramps', 'acne'])
    expect(a.patterns[0].rate).toBe(1)
    expect(a.patterns[1].rate).toBe(0.5)
  })
})

describe('computePms', () => {
  const nextPeriod = '2026-06-01'

  it('без предменструальных паттернов прогноза нет', () => {
    const a = analyzeSymptoms(
      log(4, { 0: { 2: ['cramps'] }, 1: { 2: ['cramps'] }, 2: { 2: ['cramps'] } }),
    )
    expect(a.patterns[0].premenstrual).toBe(false)
    expect(computePms(a.patterns, nextPeriod, '2026-05-20')).toBeNull()
  })

  it('без прогноза менструации окна нет', () => {
    const a = analyzeSymptoms(
      log(4, { 0: { 27: ['headache'] }, 1: { 27: ['headache'] }, 2: { 27: ['headache'] } }),
    )
    expect(computePms(a.patterns, null, '2026-05-20')).toBeNull()
  })

  it('окно заканчивается за день до менструации и открывается ранним предвестником', () => {
    const a = analyzeSymptoms(
      log(4, {
        0: { 25: ['fatigue'], 27: ['headache'] },
        1: { 25: ['fatigue'], 27: ['headache'] },
        2: { 25: ['fatigue'], 27: ['headache'] },
      }),
    )
    const pms = computePms(a.patterns, nextPeriod, '2026-05-20')!
    expect(pms.end).toBe('2026-05-31')
    // fatigue появляется за 4 дня до менструации — окно открывает он
    expect(pms.length).toBe(4)
    expect(pms.start).toBe('2026-05-28')
    expect(pms.symptoms).toContain('fatigue')
    expect(pms.symptoms).toContain('headache')
  })

  it('считает, сколько дней до окна, и отмечает активное окно', () => {
    const a = analyzeSymptoms(
      log(4, { 0: { 27: ['headache'] }, 1: { 27: ['headache'] }, 2: { 27: ['headache'] } }),
    )
    const before = computePms(a.patterns, nextPeriod, '2026-05-20')!
    expect(before.active).toBe(false)
    expect(before.daysUntil).toBeGreaterThan(0)

    const inside = computePms(a.patterns, nextPeriod, before.start)!
    expect(inside.active).toBe(true)
    expect(inside.daysUntil).toBe(0)

    const late = computePms(a.patterns, nextPeriod, '2026-05-31')!
    expect(late.active).toBe(true)
    expect(late.daysUntil).toBeLessThan(0)
  })

  it('симптом, который бывает и в середине цикла, не растягивает окно', () => {
    // усталость и на 10-й день, и за 2 дня до менструации: окно должно
    // строиться по ближайшей к менструации отметке, иначе растянулось бы
    // на пол-цикла и перестало что-либо значить
    const a = analyzeSymptoms(
      log(4, {
        0: { 10: ['fatigue'], 27: ['fatigue'] },
        1: { 10: ['fatigue'], 27: ['fatigue'] },
        2: { 10: ['fatigue'], 27: ['fatigue'] },
      }),
    )
    const pms = computePms(a.patterns, nextPeriod, '2026-05-20')!
    expect(pms.length).toBe(2)
    expect(pms.start).toBe('2026-05-30')
  })
})
