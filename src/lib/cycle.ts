// Расчёт менструального цикла — чистые функции (покрыты unit-тестами).
// Всё детерминировано: «сегодня» передаётся аргументом, без Date.now.
//
// ВАЖНО: фертильное окно и овуляция — статистическая ОЦЕНКА по средней длине
// цикла, а НЕ метод контрацепции и не медицинская рекомендация. Дисклеймер
// обязателен в UI.

export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | 'unknown'

export interface CycleInfo {
  phase: CyclePhase
  /** день текущего цикла (1-based); null если данных мало/устарели */
  dayOfCycle: number | null
  /** средняя длина цикла в днях (по логу; дефолт 28) */
  avgCycle: number
  /** средняя длина менструации в днях (по логу; дефолт 5) */
  avgPeriod: number
  /** прогноз старта следующей менструации, YYYY-MM-DD; null если нет данных */
  nextPeriodDate: string | null
  /** оценка овуляции, YYYY-MM-DD; null если нет данных */
  ovulationDate: string | null
  /** фертильное окно (оценка), YYYY-MM-DD…YYYY-MM-DD; null если нет данных */
  fertileStart: string | null
  fertileEnd: string | null
  /** достаточно ли истории для прогноза (≥2 залогированных старта) */
  hasPrediction: boolean
}

const DAY = 86400000
const DEFAULT_CYCLE = 28
const DEFAULT_PERIOD = 5

/** Парсит 'YYYY-MM-DD' как локальную полночь (без сдвига по TZ). */
function parse(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
function toISO(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function addDays(iso: string, n: number): string {
  return toISO(parse(iso) + n * DAY)
}
export function diffDays(a: string, b: string): number {
  return Math.round((parse(b) - parse(a)) / DAY)
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Группирует дни менструации в непрерывные периоды; возвращает старты и длины. */
export function periodsFromDays(periodDays: string[]): { starts: string[]; lengths: number[] } {
  const sorted = [...new Set(periodDays)].sort()
  const starts: string[] = []
  const lengths: number[] = []
  for (const day of sorted) {
    const prev = starts.length ? addDays(starts[starts.length - 1], lengths[lengths.length - 1] - 1) : null
    if (prev !== null && diffDays(prev, day) === 1) {
      lengths[lengths.length - 1] += 1 // продолжение текущего периода
    } else {
      starts.push(day)
      lengths.push(1)
    }
  }
  return { starts, lengths }
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/**
 * Рассчитывает фазу/прогноз по дням менструации и «сегодня».
 * periodDays — даты (YYYY-MM-DD), помеченные как менструация.
 */
export function computeCycle(periodDays: string[], today: string): CycleInfo {
  const { starts, lengths } = periodsFromDays(periodDays)

  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) gaps.push(diffDays(starts[i - 1], starts[i]))
  const avgCycle = gaps.length ? clamp(Math.round(mean(gaps)!), 21, 45) : DEFAULT_CYCLE
  const avgPeriod = lengths.length ? clamp(Math.round(mean(lengths)!), 2, 10) : DEFAULT_PERIOD
  const hasPrediction = starts.length >= 2

  if (!starts.length) {
    return {
      phase: 'unknown', dayOfCycle: null, avgCycle, avgPeriod,
      nextPeriodDate: null, ovulationDate: null, fertileStart: null, fertileEnd: null, hasPrediction: false,
    }
  }

  const lastStart = starts[starts.length - 1]
  const daysSinceLast = diffDays(lastStart, today)

  // данные слишком старые (>1.5 цикла без новой записи) — не выдаём фазу
  if (daysSinceLast < 0 || daysSinceLast > avgCycle * 1.5) {
    // прогноз следующей менструации всё же считаем (ближайшая будущая)
    let next = lastStart
    while (diffDays(today, next) < 0) next = addDays(next, avgCycle)
    const ov = addDays(next, -14)
    return {
      phase: 'unknown', dayOfCycle: null, avgCycle, avgPeriod,
      nextPeriodDate: next, ovulationDate: ov,
      fertileStart: addDays(ov, -5), fertileEnd: addDays(ov, 1), hasPrediction,
    }
  }

  // текущий цикл (мог «прокрутиться» без новой записи)
  const cyclesPassed = Math.floor(daysSinceLast / avgCycle)
  const cycleStart = addDays(lastStart, cyclesPassed * avgCycle)
  const dayOfCycle = diffDays(cycleStart, today) + 1

  const nextPeriodDate = addDays(cycleStart, avgCycle)
  const ovulationDate = addDays(nextPeriodDate, -14) // лютеиновая фаза ~14 дней
  const ovDay = diffDays(cycleStart, ovulationDate) + 1

  let phase: CyclePhase
  if (dayOfCycle <= avgPeriod) phase = 'menstruation'
  else if (dayOfCycle >= ovDay - 1 && dayOfCycle <= ovDay + 1) phase = 'ovulation'
  else if (dayOfCycle < ovDay - 1) phase = 'follicular'
  else phase = 'luteal'

  return {
    phase, dayOfCycle, avgCycle, avgPeriod,
    nextPeriodDate, ovulationDate,
    fertileStart: addDays(ovulationDate, -5), // выживаемость сперматозоидов ~5 дней
    fertileEnd: addDays(ovulationDate, 1), // яйцеклетка ~1 день
    hasPrediction,
  }
}
