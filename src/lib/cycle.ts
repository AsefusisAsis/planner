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

/** День менструации: только дата или дата с интенсивностью. */
export type PeriodDay = string | { date: string; flow?: string }

/** Минимальный промежуток между НАЧАЛАМИ менструаций, дней.
 *  Физиологически цикл короче 10 дней не бывает: если отмеченный день ближе
 *  к текущему старту — это тот же период (например, пропустили день в
 *  середине), а не новый цикл. Без этого правила один незалогированный день
 *  разрывал период надвое и рушил всю статистику. */
const MIN_CYCLE_GAP = 10

function normalizeDays(days: PeriodDay[]): { date: string; flow?: string }[] {
  const byDate = new Map<string, { date: string; flow?: string }>()
  for (const d of days) {
    const e = typeof d === 'string' ? { date: d } : d
    // при дубле даты оставляем запись с интенсивностью — она информативнее
    const prev = byDate.get(e.date)
    if (!prev || (!prev.flow && e.flow)) byDate.set(e.date, e)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Группирует дни менструации в периоды; возвращает старты и длины.
 *
 * Два правила, без которых статистика врёт:
 *  • мазня (spotting) не ОТКРЫВАЕТ период — она часто идёт за день-два до
 *    настоящего начала, и приняв её за старт, мы сдвигали бы весь прогноз
 *    назад; продолжить уже идущий период она может;
 *  • новый период начинается только если прошло ≥ MIN_CYCLE_GAP дней от
 *    текущего старта — иначе это тот же период с пропущенным днём.
 */
export function periodsFromDays(days: PeriodDay[]): { starts: string[]; lengths: number[] } {
  const sorted = normalizeDays(days)
  const starts: string[] = []
  const lengths: number[] = []
  // конец текущего периода — по последнему ОТМЕЧЕННОМУ дню, а не по длине:
  // внутри периода бывают пропуски, и длина их не отражает
  let lastDay: string | null = null

  for (const { date, flow } of sorted) {
    const curStart = starts.length ? starts[starts.length - 1] : null
    const isSpotting = flow === 'spotting'

    if (curStart !== null && diffDays(curStart, date) < MIN_CYCLE_GAP) {
      // тот же период: продлеваем до этого дня (пропуски внутри закрываются)
      lengths[lengths.length - 1] = diffDays(curStart, date) + 1
      lastDay = date
      continue
    }
    if (isSpotting) {
      // мазня вне идущего периода — новый цикл ею не открываем и в длины
      // не считаем; настоящий старт придёт следующим отмеченным днём
      continue
    }
    starts.push(date)
    lengths.push(1)
    lastDay = date
  }
  void lastDay
  return { starts, lengths }
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Взвешенная медиана: свежие циклы весомее старых (вес растёт линейно).
 * Медиана вместо среднего — один нетипичный цикл не утаскивает прогноз за
 * собой; вес по свежести — тело меняется, и прошлый месяц важнее прошлогоднего.
 */
function weightedMedian(values: number[]): number | null {
  if (!values.length) return null
  // На двух точках взвешенная медиана вырождается в «взять последнюю» —
  // оценка скакала бы за каждым циклом. Пока истории мало, берём обычную
  // медиану (на двух точках это их среднее).
  if (values.length < 3) return median(values)
  const weighted = values.map((v, i) => ({ v, w: i + 1 })) // последний — самый тяжёлый
  weighted.sort((a, b) => a.v - b.v)
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let acc = 0
  for (const { v, w } of weighted) {
    acc += w
    if (acc >= total / 2) return v
  }
  return weighted[weighted.length - 1].v
}

/** Робастный разброс: медиана абсолютных отклонений → приближение сигмы. */
function robustSigma(values: number[], center: number): number {
  const mad = median(values.map((v) => Math.abs(v - center)))
  return mad == null ? 0 : mad * 1.4826
}

/**
 * Отбрасывает нетипичные циклы из ОЦЕНКИ (в истории они остаются).
 * Порог — не меньше 7 дней: обычные биологические колебания исключать нельзя,
 * иначе на ровных данных «нетипичным» станет любое отличие.
 */
function withoutOutliers(gaps: number[]): number[] {
  if (gaps.length < 3) return gaps // на двух точках выброс не определить
  const center = median(gaps)!
  const threshold = Math.max(2.5 * robustSigma(gaps, center), 7)
  const kept = gaps.filter((g) => Math.abs(g - center) <= threshold)
  return kept.length >= 2 ? kept : gaps
}

/**
 * Рассчитывает фазу/прогноз по дням менструации и «сегодня».
 * periodDays — даты (YYYY-MM-DD), помеченные как менструация.
 */
export function computeCycle(periodDays: PeriodDay[], today: string): CycleInfo {
  const { starts, lengths } = periodsFromDays(periodDays)

  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) gaps.push(diffDays(starts[i - 1], starts[i]))
  // считаем по последним ~6 циклам — отзывчивее к текущему паттерну
  const recent = gaps.slice(-6)
  // Оценку строим по циклам БЕЗ нетипичных (болезнь, стресс, сбой), но в
  // истории они остаются: min/max/loggedCycles ниже считаются по полным
  // данным — прятать от пользователя реальный разброс нечестно.
  const usable = withoutOutliers(recent)
  const avgCycle = usable.length
    ? clamp(Math.round(weightedMedian(usable)!), 21, 45)
    : DEFAULT_CYCLE
  // длина менструации — тоже медиана: один затяжной период не должен
  // растягивать оценку фазы для всех остальных
  const avgPeriod = lengths.length ? clamp(Math.round(median(lengths)!), 2, 10) : DEFAULT_PERIOD
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
  // Ширина — по фактическому разбросу, но уже БЕЗ нетипичных циклов: раньше
  // один сбойный месяц раздувал окно на всё время вперёд. По MAD ширину не
  // считаем: на данных вроде «пять раз 28 и один раз 34» MAD равен нулю, и
  // окно сузилось бы до минимума, хотя разброс реальный. MAD работает там,
  // где он силён — на отсеве выбросов и центре оценки.
  const usableSpread = usable.length ? Math.max(...usable) - Math.min(...usable) : 0
  const variabilityWidth = Math.round(usableSpread / 2)
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

  // Задержка считается от КОНЦА окна прогноза, а не от точечной даты.
  // Мы сами обещали диапазон «±N дней» — называть задержкой день внутри
  // обещанного окна нечестно и лишний раз пугает. Только при реальном
  // прогнозе (≥2 старта) и не для давно заброшенного лога.
  const daysSinceLast = diffDays(lastStart, today)
  const overdueBy = daysSinceLast - (avgCycle + predictSpread)
  const daysLate =
    hasPrediction && overdueBy > 0 && daysSinceLast <= avgCycle * 2 ? overdueBy : null

  // --- Уверенность прогноза: история (0.4) + вариативность (0.4) + свежесть
  // (0.2). Формула из исследовательского документа без data-quality (не
  // трекаем). <2 циклов → всегда low; <3 циклов не бывает high. ---
  const historyScore = Math.min(loggedCycles / 6, 1)
  // вариативность считаем только когда есть ≥2 промежутков (иначе spread
  // структурно 0 и «идеальная регулярность» ложно завышала бы балл) —
  // при недостатке даём нейтральные 0.5, а не максимум
  const variabilityScore = loggedCycles >= 2 ? Math.max(0, 1 - spreadDays / 14) : 0.5
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
    // данные устарели/заброшены → прогноз ненадёжен, не показываем «высокую»
    return {
      phase: 'unknown', dayOfCycle: null, avgCycle, avgPeriod,
      nextPeriodDate, ovulationDate, fertileStart, fertileEnd, hasPrediction,
      regularity, minCycle, maxCycle, predictSpread, daysLate, loggedCycles,
      confidence: hasPrediction ? 'low' : 'unknown', confidenceScore: Math.min(confidenceScore, 44),
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
