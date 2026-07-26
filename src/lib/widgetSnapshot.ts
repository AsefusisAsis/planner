// Чистая сборка снимка дня для виджета рабочего стола. Вынесена из
// services/androidWidget, чтобы покрыть тестами без Capacitor-зависимостей.

import type { AppData } from '../types'
import { computeHealth } from '../modules/health/calc'

/** Что показывает виджет. Все поля — готовые строки для отрисовки нативом. */
export interface WidgetSnapshot {
  title: string
  count: number
  lines: string[]
  footer: string
  empty: string
}

/** Сколько строк дел помещается в виджет (см. widget_today.xml). */
export const MAX_WIDGET_LINES = 3

/**
 * Собрать снимок дня. Локализация здесь же: натив рисует готовые строки и
 * не дублирует ни бизнес-правила, ни переводы.
 */
export function buildWidgetSnapshot(data: AppData, today: string): WidgetSnapshot {
  const ru = data.settings.language !== 'en'

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
    const drunk = data.waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0)
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
