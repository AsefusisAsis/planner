// Чистая сборка снимка для виджетов рабочего стола. Вынесена из
// services/androidWidget, чтобы покрыть тестами без Capacitor-зависимостей.
//
// Снимок разбит на секции — по одной на виджет. Натив только рисует готовые
// строки: вся логика и локализация остаются здесь, на Java ничего не
// дублируется.

import type { AppData } from '../types'
import { computeHealth } from '../modules/health/calc'
import { computeCycle, diffDays } from './cycle'

/** Секция виджета «Сегодня». */
export interface TodaySection {
  title: string
  count: number
  lines: string[]
  footer: string
  empty: string
}

/** Секция виджета «Вода». */
export interface WaterSection {
  title: string
  /** выпито за сегодня, мл */
  drunk: number
  /** дневная цель, мл (0 — профиль здоровья не заполнен) */
  goal: number
  /** «750 / 2000 мл» или приглашение заполнить профиль */
  text: string
  /** 0..100 для полосы прогресса */
  pct: number
  done: string
}

/** Секция виджета «Цикл». Намеренно скупая: виджет виден всем, кто
 *  посмотрит на телефон. */
export interface CycleSection {
  title: string
  /** «День цикла 14» либо приглашение отметить */
  day: string
  /** фаза словами */
  phase: string
  /** «через 5 дн.» до следующей менструации или задержка */
  next: string
  enabled: boolean
}

/** Секция виджета «Покупки». */
export interface ShoppingSection {
  title: string
  count: number
  lines: string[]
  empty: string
}

export interface WidgetSnapshot {
  today: TodaySection
  water: WaterSection
  cycle: CycleSection
  shopping: ShoppingSection
}

/** Сколько строк дел помещается в виджет (см. widget_today.xml). */
export const MAX_WIDGET_LINES = 3

function buildToday(data: AppData, today: string, ru: boolean): TodaySection {
  const overdue = data.homeTasks.filter((t) => !t.done && t.dueDate && t.dueDate < today)
  const dueToday = data.homeTasks.filter((t) => !t.done && t.dueDate === today)
  const events = data.calendarTasks
    .filter((e) => e.date === today && !e.done)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))

  // Порядок важности: просроченное → события по времени → задачи на сегодня.
  // Пометки текстом, без иконок: RemoteViews рисует обычный TextView.
  const lines: string[] = [
    ...overdue.map((t) => `! ${t.title}`),
    ...events.map((e) =>
      e.time ? `${e.time}  ${e.title}` : `${ru ? 'весь день' : 'all day'}  ${e.title}`,
    ),
    ...dueToday.map((t) => `• ${t.title}`),
  ]

  const count = overdue.length + dueToday.length + events.length
  const shown = lines.slice(0, MAX_WIDGET_LINES)
  // последняя строка превращается в «…и ещё N», поэтому в скрытые попадает и она
  const hidden = lines.length - shown.length
  if (hidden > 0) shown[MAX_WIDGET_LINES - 1] = ru ? `…и ещё ${hidden + 1}` : `…and ${hidden + 1} more`

  // Подвал — вода за сегодня (только если заполнен профиль здоровья)
  let footer = ''
  if (data.healthProfile) {
    const goal = computeHealth(data.healthProfile).waterMl
    const drunk = waterToday(data, today)
    footer = `${ru ? 'Вода' : 'Water'} ${drunk} / ${goal} ${ru ? 'мл' : 'ml'}`
  }

  return {
    title: ru ? 'Сегодня' : 'Today',
    count,
    lines: shown,
    footer,
    empty: ru ? 'На сегодня ничего' : 'Nothing for today',
  }
}

function waterToday(data: AppData, today: string): number {
  return data.waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0)
}

function buildWater(data: AppData, today: string, ru: boolean): WaterSection {
  const unit = ru ? 'мл' : 'ml'
  const drunk = waterToday(data, today)
  const goal = data.healthProfile ? computeHealth(data.healthProfile).waterMl : 0
  return {
    title: ru ? 'Вода' : 'Water',
    drunk,
    goal,
    text: goal > 0 ? `${drunk} / ${goal} ${unit}` : `${drunk} ${unit}`,
    pct: goal > 0 ? Math.min(100, Math.round((drunk / goal) * 100)) : 0,
    done: ru ? 'Цель выполнена' : 'Goal reached',
  }
}

function buildCycle(data: AppData, today: string, ru: boolean): CycleSection {
  const title = ru ? 'Цикл' : 'Cycle'
  if (!data.settings.cycleEnabled) {
    return { title, day: '', phase: '', next: '', enabled: false }
  }
  const info = computeCycle(
    data.cycleLog.filter((e) => e.period).map((e) => e.date),
    today,
  )
  if (info.dayOfCycle == null) {
    return {
      title,
      day: ru ? 'Отметьте менструацию' : 'Log your period',
      phase: '',
      next: '',
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
        ? ru
          ? 'Ожидается сегодня'
          : 'Expected today'
        : ru
          ? `Через ${d} дн.`
          : `In ${d} d`
  }
  return {
    title,
    day: ru ? `День цикла ${info.dayOfCycle}` : `Cycle day ${info.dayOfCycle}`,
    phase: phases[info.phase][ru ? 0 : 1],
    next,
    enabled: true,
  }
}

function buildShopping(data: AppData, today: string, ru: boolean): ShoppingSection {
  const planned: { date: string; name: string }[] = []
  for (const l of data.shoppingLists)
    for (const it of l.items)
      if (it.plannedDate && !it.bought) planned.push({ date: it.plannedDate, name: it.name })
  planned.sort((a, b) => a.date.localeCompare(b.date))

  const rel = (date: string) => {
    const d = diffDays(today, date)
    if (d < 0) return ru ? 'просрочено' : 'overdue'
    if (d === 0) return ru ? 'сегодня' : 'today'
    if (d === 1) return ru ? 'завтра' : 'tomorrow'
    return ru ? `через ${d} дн.` : `in ${d} d`
  }

  const lines = planned.map((p) => `${p.name} — ${rel(p.date)}`)
  const shown = lines.slice(0, MAX_WIDGET_LINES)
  const hidden = lines.length - shown.length
  if (hidden > 0) shown[MAX_WIDGET_LINES - 1] = ru ? `…и ещё ${hidden + 1}` : `…and ${hidden + 1} more`

  return {
    title: ru ? 'Покупки' : 'Shopping',
    count: planned.length,
    lines: shown,
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
