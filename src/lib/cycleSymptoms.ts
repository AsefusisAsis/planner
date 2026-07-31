// Персональные паттерны симптомов и прогноз ПМС — чистые функции (unit-тесты).
//
// Принцип раздела: никаких универсальных утверждений и диагнозов, только
// «по ВАШИМ записям обычно так». Отсюда пороги ниже: два совпадения подряд —
// это совпадение, а не закономерность, и подавать их как паттерн нечестно.
// Лучше показать «нужно ещё N циклов», чем уверенную ерунду.

import { addDays, diffDays, median, periodsFromDays } from './cycle'

/** Минимум ЗАВЕРШЁННЫХ циклов в истории, чтобы вообще искать паттерны. */
export const MIN_CYCLES_FOR_PATTERNS = 3
/** В скольких разных циклах симптом должен встретиться. */
const MIN_CYCLES_WITH_SYMPTOM = 2
/** Реже чем в половине циклов — это не «обычно». */
const MIN_RATE = 0.5
/** За сколько дней до менструации симптом считается предменструальным. */
const PMS_LOOKBACK = 7
/** Границы длины ПМС-окна, дней. */
const PMS_MIN_LEN = 2
const PMS_MAX_LEN = 10

/** Минимум записи дня цикла, который нужен этому модулю. */
export interface CycleLogDay {
  date: string
  period?: boolean
  flow?: string
  symptoms?: string[]
}

// ---------- Каталог симптомов (чистая часть; React-хуки — в modules/cycle/symptoms) ----------

/** Встроенный каталог. Порядок сохраняется в UI. */
export const BUILTIN_SYMPTOMS = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'backache',
  'tender',
  'acne',
  'nausea',
  'cravings',
]

/** Префикс id своего симптома — чтобы никогда не столкнуться со встроенным ключом. */
export const CUSTOM_PREFIX = 'c:'

export const isCustomSymptom = (id: string) => id.startsWith(CUSTOM_PREFIX)

/** id своего симптома делается из подписи: удаление и повторное добавление
 *  того же названия дают тот же id, и старые записи дневника не осиротеют. */
export const customSymptomId = (label: string) => CUSTOM_PREFIX + label.trim()

/** Ключ перевода встроенного симптома. */
export const builtinSymptomKey = (s: string) =>
  'health.cycSym' + s.charAt(0).toUpperCase() + s.slice(1)

/** Что показывать в списке отметок: встроенные минус скрытые, затем свои. */
export function symptomChoices(
  hidden: string[] | undefined,
  custom: { id: string }[] | undefined,
): string[] {
  const off = new Set(hidden ?? [])
  return [...BUILTIN_SYMPTOMS.filter((s) => !off.has(s)), ...(custom ?? []).map((c) => c.id)]
}

/** К чему привязан паттерн: к началу цикла или к следующей менструации. */
export type SymptomAnchor = 'cycleStart' | 'beforePeriod'

export interface SymptomPattern {
  symptom: string
  /** всего дней с отметкой (в завершённых циклах) */
  days: number
  /** в скольких завершённых циклах встречался */
  cycles: number
  /** доля циклов с этим симптомом, 0..1 */
  rate: number
  /** как описывать паттерн пользователю */
  anchor: SymptomAnchor
  /** одно число, когда нужно назвать момент: для 'cycleStart' — день
   *  появления, для 'beforePeriod' — ближайший к менструации день */
  typical: number
  /** типичный размах ВНУТРИ цикла (медиана начала и медиана конца).
   *  Для 'cycleStart' from ≤ to (дни цикла), для 'beforePeriod' from ≥ to
   *  (за 4…1 день до) — в обоих случаях from это «начиная с», to это «по». */
  from: number
  to: number
  /** появляется в последние дни перед менструацией */
  premenstrual: boolean
}

export interface SymptomAnalysis {
  patterns: SymptomPattern[]
  /** сколько завершённых циклов удалось проанализировать */
  cyclesAnalyzed: number
  /** хватает ли истории, чтобы говорить о закономерностях */
  enoughData: boolean
  /** сколько циклов не хватает до анализа (0 — хватает) */
  cyclesNeeded: number
}

/** Индекс цикла, которому принадлежит дата (последний старт ≤ даты); -1 до начала истории. */
function cycleIndexOf(starts: string[], date: string): number {
  let idx = -1
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= date) idx = i
    else break
  }
  return idx
}

/**
 * Ищет личные закономерности симптомов по дневнику.
 *
 * Считаем ТОЛЬКО по завершённым циклам: в текущем цикле симптом ещё может
 * появиться, и учитывать его наравне с прошлыми — занижать частоту.
 */
export function analyzeSymptoms(log: CycleLogDay[]): SymptomAnalysis {
  const periodDays = log.filter((e) => e.period).map((e) => ({ date: e.date, flow: e.flow }))
  const { starts } = periodsFromDays(periodDays)
  const cyclesAnalyzed = Math.max(0, starts.length - 1)
  const cyclesNeeded = Math.max(0, MIN_CYCLES_FOR_PATTERNS - cyclesAnalyzed)
  if (cyclesNeeded > 0) return { patterns: [], cyclesAnalyzed, enoughData: false, cyclesNeeded }

  /** Что известно про симптом внутри одного цикла. */
  interface InCycle {
    /** первый и последний день цикла с отметкой */
    firstDay: number
    lastDay: number
    /** ближайшая к менструации отметка, дней до неё */
    closest: number
    /** самая ранняя отметка ИЗ ПОПАВШИХ в предменструальное окно, дней до
     *  менструации; null — в это окно симптом в этом цикле не попадал */
    earliestBefore: number | null
  }

  const per = new Map<string, Map<number, InCycle>>()
  const totalDays = new Map<string, number>()

  for (const e of log) {
    if (!e.symptoms?.length) continue
    const ci = cycleIndexOf(starts, e.date)
    // вне истории (до первой менструации) или в ещё не завершённом цикле
    if (ci < 0 || ci >= starts.length - 1) continue
    const dayOfCycle = diffDays(starts[ci], e.date) + 1
    const beforeNext = diffDays(e.date, starts[ci + 1])
    const inPmsRange = beforeNext <= PMS_LOOKBACK ? beforeNext : null
    for (const s of e.symptoms) {
      totalDays.set(s, (totalDays.get(s) ?? 0) + 1)
      let byCycle = per.get(s)
      if (!byCycle) per.set(s, (byCycle = new Map()))
      const prev = byCycle.get(ci)
      byCycle.set(ci, {
        firstDay: prev ? Math.min(prev.firstDay, dayOfCycle) : dayOfCycle,
        lastDay: prev ? Math.max(prev.lastDay, dayOfCycle) : dayOfCycle,
        closest: prev ? Math.min(prev.closest, beforeNext) : beforeNext,
        earliestBefore:
          prev?.earliestBefore != null && inPmsRange != null
            ? Math.max(prev.earliestBefore, inPmsRange)
            : (prev?.earliestBefore ?? inPmsRange),
      })
    }
  }

  const patterns: SymptomPattern[] = []
  for (const [symptom, byCycle] of per) {
    const cycles = byCycle.size
    if (cycles < MIN_CYCLES_WITH_SYMPTOM) continue
    const rate = cycles / cyclesAnalyzed
    if (rate < MIN_RATE) continue

    const perCycle = [...byCycle.values()]
    // Привязку выбираем по тому, где отметки кучкуются. «Спазмы на 1-3 день»
    // понятнее как день цикла, «мигрень за 2 дня до» — как обратный отсчёт;
    // одна общая шкала для обоих случаев читалась бы плохо.
    const closests = perCycle.map((x) => x.closest)
    const premenstrual = median(closests)! <= PMS_LOOKBACK

    // Диапазон — это типичный размах ВНУТРИ цикла (медиана начала и медиана
    // конца), а не разброс одной точки между циклами: пользователю нужно
    // «с какого по какой день это обычно длится».
    let from: number
    let to: number
    if (premenstrual) {
      // Начало окна берём только по отметкам, попавшим в предменструальные
      // дни: если тот же симптом бывает ещё и в середине цикла, он не должен
      // растягивать окно на пол-цикла.
      const earliest = perCycle.map((x) => x.earliestBefore).filter((v): v is number => v != null)
      from = Math.round(median(earliest.length ? earliest : closests)!)
      to = Math.round(median(closests)!)
    } else {
      from = Math.round(median(perCycle.map((x) => x.firstDay))!)
      to = Math.round(median(perCycle.map((x) => x.lastDay))!)
    }

    patterns.push({
      symptom,
      days: totalDays.get(symptom) ?? 0,
      cycles,
      rate,
      anchor: premenstrual ? 'beforePeriod' : 'cycleStart',
      // одно число, если надо назвать момент: для «до менструации» это
      // ближайший к ней день, для дня цикла — день появления
      typical: premenstrual ? to : from,
      from,
      to,
      premenstrual,
    })
  }
  // самые устойчивые — первыми
  patterns.sort(
    (a, b) => b.rate - a.rate || b.days - a.days || a.symptom.localeCompare(b.symptom),
  )
  return { patterns, cyclesAnalyzed, enoughData: true, cyclesNeeded: 0 }
}

export interface PmsForecast {
  /** окно предменструальных дней, YYYY-MM-DD */
  start: string
  end: string
  /** длина окна в днях */
  length: number
  /** дней до начала окна: 0 — начинается сегодня, отрицательное — уже идёт */
  daysUntil: number
  active: boolean
  /** симптомы, которые обычно бывают в эти дни (по убыванию устойчивости) */
  symptoms: string[]
}

/**
 * Прогноз предменструального окна ПО ЛИЧНЫМ отметкам.
 *
 * Если предменструальных паттернов нет — возвращаем null и ничего не
 * показываем. Сказать «у вас будет ПМС», не имея ни одной вашей записи, —
 * это универсальное утверждение о людях, а не прогноз; такого в разделе нет.
 */
export function computePms(
  patterns: SymptomPattern[],
  nextPeriodDate: string | null,
  today: string,
): PmsForecast | null {
  if (!nextPeriodDate) return null
  const pms = patterns.filter((p) => p.premenstrual)
  if (!pms.length) return null

  // окно открывает самый ранний устойчивый предвестник
  const length = Math.min(PMS_MAX_LEN, Math.max(PMS_MIN_LEN, ...pms.map((p) => p.from)))
  const start = addDays(nextPeriodDate, -length)
  const end = addDays(nextPeriodDate, -1)
  return {
    start,
    end,
    length,
    daysUntil: diffDays(today, start),
    active: today >= start && today <= end,
    symptoms: pms.map((p) => p.symptom),
  }
}
