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
  /** регулярность по последним циклам: 'unknown' пока мало данных (<3 стартов) */
  regularity: 'regular' | 'irregular' | 'unknown'
  /** самый короткий/длинный цикл по последним данным, дн.; null если нет */
  minCycle: number | null
  maxCycle: number | null
  /** ± дней вокруг nextPeriodDate. Прогноз ВСЕГДА показывается диапазоном:
   *  минимальная ширина зависит от числа циклов (мало данных → шире),
   *  для нерегулярного цикла расширяется до половины разброса. */
  predictSpread: number
  /** задержка в днях (сегодня позже ожидаемой менструации, а её нет); null если нет */
  daysLate: number | null
  /** сколько полных циклов залогировано (= число промежутков между стартами) */
  loggedCycles: number
  /** уровень уверенности прогноза (история + вариативность + свежесть) */
  confidence: 'low' | 'medium' | 'high' | 'unknown'
  /** числовой балл уверенности 0..100 (для отладки/градаций) */
  confidenceScore: number
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
  // считаем по последним ~6 циклам — отзывчивее к текущему паттерну
  const recent = gaps.slice(-6)
  const avgCycle = recent.length ? clamp(Math.round(mean(recent)!), 21, 45) : DEFAULT_CYCLE
  const avgPeriod = lengths.length ? clamp(Math.round(mean(lengths)!), 2, 10) : DEFAULT_PERIOD
  const hasPrediction = starts.length >= 2
  const loggedCycles = gaps.length
  const minCycle = recent.length ? Math.min(...recent) : null
  const maxCycle = recent.length ? Math.max(...recent) : null
  // регулярность: нужно ≥2 промежутков (≥3 старта); разброс >7 дней = нерегулярный
  const spreadDays = minCycle != null && maxCycle != null ? maxCycle - minCycle : 0
  const regularity: CycleInfo['regularity'] =
    recent.length < 2 ? 'unknown' : spreadDays > 7 ? 'irregular' : 'regular'
  // Диапазон прогноза ВСЕГДА (даже для регулярного) — честнее одной «точной»
  // даты. Минимальная ширина падает с ростом истории (мало циклов → шире):
  // 1–2 цикла → ±4, 3–5 → ±3, 6+ → ±2; для нерегулярного расширяем до
  // половины разброса. Кап 10.
  const minWidth = loggedCycles <= 2 ? 4 : loggedCycles <= 5 ? 3 : 2
  const variabilityWidth = regularity === 'irregular' ? Math.round(spreadDays / 2) : 0
  const predictSpread = loggedCycles >= 1 ? Math.min(10, Math.max(minWidth, variabilityWidth)) : 0

  if (!starts.length) {
    return {
      phase: 'unknown', dayOfCycle: null, avgCycle, avgPeriod,
      nextPeriodDate: null, ovulationDate: null, fertileStart: null, fertileEnd: null, hasPrediction: false,
      regularity: 'unknown', minCycle: null, maxCycle: null, predictSpread: 0, daysLate: null, loggedCycles: 0,
      confidence: 'unknown', confidenceScore: 0,
    }
  }

  const lastStart = starts[starts.length - 1]

  // --- Прогноз: всегда БЛИЖАЙШИЙ актуальный, не в прошлом ---
  // Следующая менструация — первый старт строго после «сегодня».
  let nextPeriodDate = lastStart
  while (diffDays(today, nextPeriodDate) <= 0) nextPeriodDate = addDays(nextPeriodDate, avgCycle)
  // Овуляция ~ за 14 дней до менструации. Овуляции повторяются каждые avgCycle;
  // берём ближайшую, чьё фертильное окно ещё НЕ прошло (fertileEnd = ов+1 ≥ сегодня),
  // иначе окно показывалось бы в прошлом (напр. в лютеиновой фазе или при
  // будущей отметке менструации).
  let ovulationDate = addDays(lastStart, -14)
  while (diffDays(today, addDays(ovulationDate, 1)) < 0) ovulationDate = addDays(ovulationDate, avgCycle)
  const fertileStart = addDays(ovulationDate, -5) // выживаемость сперматозоидов ~5 дней
  const fertileEnd = addDays(ovulationDate, 1) // яйцеклетка ~1 день

  // задержка: сегодня позже ожидаемой менструации (lastStart + avgCycle), а новой нет.
  // Только при реальном прогнозе (≥2 старта) и не для давно заброшенного лога.
  const daysSinceLast = diffDays(lastStart, today)
  const daysLate =
    hasPrediction && daysSinceLast > avgCycle && daysSinceLast <= avgCycle * 2
      ? daysSinceLast - avgCycle
      : null

  // --- Уверенность прогноза: история (0.4) + вариативность (0.4) + свежесть
  // (0.2). Формула из исследовательского документа без data-quality (не
  // трекаем). <2 циклов → всегда low; <3 циклов не бывает high. ---
  const historyScore = Math.min(loggedCycles / 6, 1)
  const variabilityScore = Math.max(0, 1 - spreadDays / 14)
  const recencyScore = Math.max(0, 1 - Math.abs(daysSinceLast) / 90)
  const confidenceScore = Math.round(
    100 * (0.4 * historyScore + 0.4 * variabilityScore + 0.2 * recencyScore),
  )
  let confidence: CycleInfo['confidence']
  if (!hasPrediction) confidence = 'low'
  else if (confidenceScore >= 75) confidence = 'high'
  else if (confidenceScore >= 45) confidence = 'medium'
  else confidence = 'low'
  if (confidence === 'high' && loggedCycles < 3) confidence = 'medium' // тонкая история

  // --- Текущая фаза: только если последний старт в прошлом и не устарел ---
  if (daysSinceLast < 0 || daysSinceLast > avgCycle * 1.5) {
    return {
      phase: 'unknown', dayOfCycle: null, avgCycle, avgPeriod,
      nextPeriodDate, ovulationDate, fertileStart, fertileEnd, hasPrediction,
      regularity, minCycle, maxCycle, predictSpread, daysLate, loggedCycles,
      confidence, confidenceScore,
    }
  }
  const cyclesPassed = Math.floor(daysSinceLast / avgCycle)
  const cycleStart = addDays(lastStart, cyclesPassed * avgCycle)
  const dayOfCycle = diffDays(cycleStart, today) + 1
  const ovDay = avgCycle - 14 // день цикла овуляции (≈ длина − лютеиновая фаза 14)

  let phase: CyclePhase
  if (dayOfCycle <= avgPeriod) phase = 'menstruation'
  else if (dayOfCycle >= ovDay - 1 && dayOfCycle <= ovDay + 1) phase = 'ovulation'
  else if (dayOfCycle < ovDay - 1) phase = 'follicular'
  else phase = 'luteal'

  return {
    phase, dayOfCycle, avgCycle, avgPeriod,
    nextPeriodDate, ovulationDate, fertileStart, fertileEnd, hasPrediction,
    regularity, minCycle, maxCycle, predictSpread, daysLate, loggedCycles,
    confidence, confidenceScore,
  }
}
