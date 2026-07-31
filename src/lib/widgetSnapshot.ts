// Чистая сборка снимка для виджетов рабочего стола. Вынесена из
// services/androidWidget, чтобы покрыть тестами без Capacitor-зависимостей.
//
// Снимок разбит на секции — по одной на виджет. Натив только рисует готовые
// строки и красит их по тону: вся логика и локализация остаются здесь, на
// Java ничего не дублируется. Цвета темы подмешивает services/androidWidget
// (их видно только в браузере, из CSS-переменных).

import type { AppData } from '../types'
import { computeHealth } from '../modules/health/calc'
import { computeCycle, diffDays } from './cycle'
import type { WidgetTheme } from './widgetTheme'

/** Смысловая окраска строки — натив подставит нужный цвет темы. */
export type WidgetTone = 'normal' | 'muted' | 'accent' | 'danger' | 'warning'

/** Строка списка: основной текст слева, приписка справа. */
export interface WidgetLine {
  text: string
  /** время события, срочность покупки и т.п. — рисуется справа мелким */
  meta: string
  tone: WidgetTone
}

export interface TodaySection {
  title: string
  count: number
  lines: WidgetLine[]
  footer: string
  empty: string
}

export interface WaterSection {
  title: string
  /** крупное число — сколько выпито */
  hero: string
  /** подпись под ним: «из 3411 мл» либо просто единицы */
  sub: string
  drunk: number
  goal: number
  pct: number
  done: boolean
  doneLabel: string
}

export interface CycleSection {
  title: string
  /** «14» — крупно, только цифра дня цикла; пусто, когда данных нет */
  dayNumber: string
  dayLabel: string
  phase: string
  next: string
  /** сообщение вместо данных (трекер выключен / нечего показать) */
  hint: string
  enabled: boolean
}

export interface ShoppingSection {
  title: string
  count: number
  lines: WidgetLine[]
  empty: string
}

export interface WidgetSnapshot {
  today: TodaySection
  water: WaterSection
  cycle: CycleSection
  shopping: ShoppingSection
  /** цвета текущей темы приложения; подмешиваются в браузере */
  theme?: WidgetTheme
}

/** Сколько строк списка помещается в виджет. */
export const MAX_WIDGET_LINES = 3

function waterToday(data: AppData, today: string): number {
  return data.waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0)
}

/** Обрезать список до трёх строк, заменив последнюю сводкой об остатке. */
function clampLines(lines: WidgetLine[], ru: boolean): WidgetLine[] {
  const shown = lines.slice(0, MAX_WIDGET_LINES)
  const hidden = lines.length - shown.length
  if (hidden > 0) {
    shown[MAX_WIDGET_LINES - 1] = {
      text: ru ? `…и ещё ${hidden + 1}` : `…and ${hidden + 1} more`,
      meta: '',
      tone: 'muted',
    }
  }
  return shown
}

function buildToday(data: AppData, today: string, ru: boolean): TodaySection {
  const overdue = data.homeTasks.filter((t) => !t.done && t.dueDate && t.dueDate < today)
  const dueToday = data.homeTasks.filter((t) => !t.done && t.dueDate === today)
  const events = data.calendarTasks
    .filter((e) => e.date === today && !e.done)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))

  // Порядок важности: просроченное → события по времени → задачи на сегодня
  const lines: WidgetLine[] = [
    ...overdue.map((t): WidgetLine => ({
      text: t.title,
      meta: ru ? 'просрочено' : 'overdue',
      tone: 'danger',
    })),
    ...events.map((e): WidgetLine => ({
      text: e.title,
      meta: e.time ?? (ru ? 'весь день' : 'all day'),
      tone: 'accent',
    })),
    ...dueToday.map((t): WidgetLine => ({ text: t.title, meta: '', tone: 'normal' })),
  ]

  let footer = ''
  if (data.healthProfile) {
    const goal = computeHealth(data.healthProfile).waterMl
    footer = `${ru ? 'Вода' : 'Water'} ${waterToday(data, today)} / ${goal} ${ru ? 'мл' : 'ml'}`
  }

  return {
    title: ru ? 'Сегодня' : 'Today',
    count: overdue.length + dueToday.length + events.length,
    lines: clampLines(lines, ru),
    footer,
    empty: ru ? 'На сегодня ничего' : 'Nothing for today',
  }
}

function buildWater(data: AppData, today: string, ru: boolean): WaterSection {
  const unit = ru ? 'мл' : 'ml'
  const drunk = waterToday(data, today)
  const goal = data.healthProfile ? computeHealth(data.healthProfile).waterMl : 0
  const pct = goal > 0 ? Math.min(100, Math.round((drunk / goal) * 100)) : 0
  return {
    title: ru ? 'Вода' : 'Water',
    hero: String(drunk),
    sub: goal > 0 ? (ru ? `из ${goal} ${unit}` : `of ${goal} ${unit}`) : unit,
    drunk,
    goal,
    pct,
    done: goal > 0 && drunk >= goal,
    doneLabel: ru ? 'Цель выполнена' : 'Goal reached',
  }
}

function buildCycle(data: AppData, today: string, ru: boolean): CycleSection {
  const title = ru ? 'Цикл' : 'Cycle'
  const base = { title, dayNumber: '', dayLabel: '', phase: '', next: '', hint: '' }
  if (!data.settings.cycleEnabled) {
    return {
      ...base,
      hint: ru ? 'Трекер выключен в настройках' : 'Tracker is off in settings',
      enabled: false,
    }
  }
  const info = computeCycle(
    data.cycleLog.filter((e) => e.period).map((e) => ({ date: e.date, flow: e.flow })),
    today,
  )
  if (info.dayOfCycle == null) {
    return {
      ...base,
      hint: ru ? 'Отметьте менструацию' : 'Log your period',
      enabled: true,
    }
  }
  const phases: Record<string, [string, string]> = {
    menstruation: ['Менструация', 'Menstruation'],
    follicular: ['Фолликулярная фаза', 'Follicular phase'],
    ovulation: ['Овуляция', 'Ovulation'],
    luteal: ['Лютеиновая фаза', 'Luteal phase'],
    unknown: ['', ''],
  }
  let next = ''
  if (info.daysLate != null) {
    next = ru ? `Задержка ${info.daysLate} дн.` : `${info.daysLate} days late`
  } else if (info.nextPeriodDate) {
    const d = diffDays(today, info.nextPeriodDate)
    next =
      d <= 0
        ? ru ? 'Ожидается сегодня' : 'Expected today'
        : ru ? `Следующая через ${d} дн.` : `Next in ${d} d`
  }
  return {
    title,
    dayNumber: String(info.dayOfCycle),
    dayLabel: ru ? 'день цикла' : 'cycle day',
    phase: phases[info.phase][ru ? 0 : 1],
    next,
    hint: '',
    enabled: true,
  }
}

function buildShopping(data: AppData, today: string, ru: boolean): ShoppingSection {
  const planned: { date: string; name: string }[] = []
  for (const l of data.shoppingLists)
    for (const it of l.items)
      if (it.plannedDate && !it.bought) planned.push({ date: it.plannedDate, name: it.name })
  planned.sort((a, b) => a.date.localeCompare(b.date))

  const lines = planned.map((p): WidgetLine => {
    const d = diffDays(today, p.date)
    if (d < 0) return { text: p.name, meta: ru ? 'просрочено' : 'overdue', tone: 'danger' }
    if (d === 0) return { text: p.name, meta: ru ? 'сегодня' : 'today', tone: 'warning' }
    if (d === 1) return { text: p.name, meta: ru ? 'завтра' : 'tomorrow', tone: 'normal' }
    return { text: p.name, meta: ru ? `через ${d} дн.` : `in ${d} d`, tone: 'muted' }
  })

  return {
    title: ru ? 'Покупки' : 'Shopping',
    count: planned.length,
    lines: clampLines(lines, ru),
    empty: ru ? 'Нет запланированных покупок' : 'No planned purchases',
  }
}

/**
 * Собрать снимок для всех виджетов. Локализация здесь же: натив рисует
 * готовые строки и не дублирует ни бизнес-правила, ни переводы.
 */
export function buildWidgetSnapshot(data: AppData, today: string): WidgetSnapshot {
  const ru = data.settings.language !== 'en'
  return {
    today: buildToday(data, today, ru),
    water: buildWater(data, today, ru),
    cycle: buildCycle(data, today, ru),
    shopping: buildShopping(data, today, ru),
  }
}
