// Правила импорта веса из Health Connect — чистые функции (unit-тесты).
//
// Главное правило: СВОИ записи пользователя не трогаем. Он мог взвеситься
// на других весах, поправить опечатку или ввести значение вручную — молча
// переписать это тем, что лежит в Health Connect, значит потерять правку,
// которую он сделал осознанно. Импорт только добавляет недостающие дни.

/** Замер веса из Health Connect: момент времени и килограммы. */
export interface HealthWeightSample {
  /** ISO-datetime замера (локальное время устройства) */
  time: string
  kg: number
}

export interface WeightMergePlan {
  /** что добавить в дневник веса */
  add: { date: string; weight: number }[]
  /** сколько дней пропущено, потому что запись уже есть */
  skippedExisting: number
  /** сколько замеров отброшено как мусор (ноль, отрицательные, нечисло) */
  skippedInvalid: number
}

/** Локальная дата замера, YYYY-MM-DD. */
function localDate(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Правдоподобный вес человека. Мусор из чужих приложений в дневник не пускаем. */
function plausible(kg: number): boolean {
  return Number.isFinite(kg) && kg > 2 && kg < 500
}

/**
 * Что нужно добавить в дневник веса по замерам из Health Connect.
 *
 * За день берётся ПОСЛЕДНИЙ замер: утренние и вечерние взвешивания
 * различаются, и брать случайное из них хуже, чем выбрать одно правило.
 */
export function planWeightImport(
  existing: { date: string }[],
  samples: HealthWeightSample[],
): WeightMergePlan {
  const have = new Set(existing.map((e) => e.date))
  const latestPerDay = new Map<string, { time: string; kg: number }>()
  let skippedInvalid = 0

  for (const s of samples) {
    const date = localDate(s.time)
    if (!date || !plausible(s.kg)) {
      skippedInvalid++
      continue
    }
    const prev = latestPerDay.get(date)
    if (!prev || s.time > prev.time) latestPerDay.set(date, { time: s.time, kg: s.kg })
  }

  const add: { date: string; weight: number }[] = []
  let skippedExisting = 0
  for (const [date, v] of [...latestPerDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (have.has(date)) {
      skippedExisting++
      continue
    }
    // 0.1 кг — предел осмысленной точности бытовых весов
    add.push({ date, weight: Math.round(v.kg * 10) / 10 })
  }
  return { add, skippedExisting, skippedInvalid }
}
