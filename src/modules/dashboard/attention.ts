// «Требует внимания»: единственный расчёт того, что просрочено, просажено
// по бюджету и скоро спишется.
//
// Живёт отдельно от виджета намеренно: этими же цифрами пользуются маскот
// на Главной (`allDone`) и отправка уведомлений. Если посчитать их внутри
// RemindersWidget, странице пришлось бы считать второй раз — и две копии
// правила «что считается тревогой» неизбежно разъехались бы.
//
// Гранулярность useMemo сохранена от исходного Page: `now` тикает каждую
// секунду, поэтому в зависимости тяжёлых расчётов (бюджеты по всем тратам,
// ближайший платёж) он НЕ входит — иначе они пересчитывались бы ежесекундно.

import { useMemo } from 'react'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { todayISO } from '../../lib/id'
import { convert } from '../../services/rates'
import { computeHealth } from '../health/calc'
import type { CalendarTask, Currency, HomeTask, RecurringExpense } from '../../types'

export interface BudgetAlert {
  name: string
  spent: number
  budget: number
}

export interface Attention {
  overdueTasks: HomeTask[]
  dueTodayTasks: HomeTask[]
  calendarToday: CalendarTask[]
  budgetAlerts: BudgetAlert[]
  nextRecurring: { rec: RecurringExpense; nextMonth: boolean } | null
  waterLow: boolean
  waterToday: number
  waterGoal: number | null
  /** Сколько всего строк-тревог — счётчик в шапке виджета и «всё чисто» у маскота. */
  count: number
  /** Готовые строки для системного уведомления (локализованные). */
  reminderLines: string[]
  /** Только задачи/события: без бюджетов, платежей и воды. */
  totalDue: number
  /**
   * Отпечаток содержимого для дедупликации уведомлений. Строится из СЫРЫХ
   * данных, а не из локализованных строк: смена языка не должна повторно
   * отправлять то же самое уведомление.
   */
  remindersSig: string
}

export function useAttention(now: Date): Attention {
  const data = useStore((s) => s.data)
  const rates = useStore((s) => s.rates)
  const vt = useVoice()
  const base = data.settings.baseCurrency
  const today = todayISO()
  const monthPrefix = today.slice(0, 7)

  // null — нет курса, запись неконвертируема: такие пропускаем в суммах, а не считаем как 0
  const toBase = (amount: number, currency: Currency): number | null =>
    rates ? convert(amount, currency, base, rates) : currency === base ? amount : null

  const overdueTasks = data.homeTasks.filter((x) => !x.done && x.dueDate && x.dueDate < today)
  const dueTodayTasks = data.homeTasks.filter((x) => !x.done && x.dueDate === today)
  const calendarToday = data.calendarTasks.filter((x) => x.date === today && !x.done)

  const budgetAlerts = useMemo(() => {
    const spend = new Map<string, number>()
    for (const e of data.expenses) {
      if (e.type === 'income' || !e.categoryId || !e.date.startsWith(monthPrefix)) continue
      const v = toBase(e.amount, e.currency)
      if (v == null) continue
      spend.set(e.categoryId, (spend.get(e.categoryId) ?? 0) + v)
    }
    // бюджет хранится в своей валюте (budgetCurrency) — сравниваем в базовой;
    // без курса сравнение невозможно — алерт не показываем
    return data.expenseCategories.flatMap((c) => {
      if (!c.budget) return []
      const budgetBase = toBase(c.budget, c.budgetCurrency ?? base)
      if (budgetBase == null) return []
      const spent = spend.get(c.id) ?? 0
      return spent > budgetBase ? [{ name: c.name, spent, budget: budgetBase }] : []
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.expenses, data.expenseCategories, rates, base, monthPrefix])

  const dayOfMonth = Number(today.slice(8, 10))
  // Циклический выбор: в ЭТОМ месяце кандидаты — ещё не применённые платежи с днём
  // впереди; если таких нет — самый ранний день из ВСЕХ платежей как платёж
  // следующего месяца (применённость этого месяца там уже не имеет значения)
  const nextRecurring = useMemo(() => {
    if (data.recurringExpenses.length === 0) return null
    const byDay = [...data.recurringExpenses].sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    // следующий месяц 'YYYY-MM' — для отсева кредитов, закончившихся к нему
    const [yy, mm] = monthPrefix.split('-').map(Number)
    const nextPrefix = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, '0')}`
    // платёж активен в месяц, если у него нет даты окончания или она не раньше
    const activeIn = (r: (typeof byDay)[number], month: string) => !r.endMonth || r.endMonth >= month
    const thisMonth = byDay.find(
      (r) => r.dayOfMonth >= dayOfMonth && r.lastAppliedMonth !== monthPrefix && activeIn(r, monthPrefix),
    )
    if (thisMonth) return { rec: thisMonth, nextMonth: false }
    const nextRec = byDay.find((r) => activeIn(r, nextPrefix))
    return nextRec ? { rec: nextRec, nextMonth: true } : null
  }, [data.recurringExpenses, dayOfMonth, monthPrefix])

  const profile = data.healthProfile
  const waterGoal = profile ? computeHealth(profile).waterMl : null
  const waterToday = data.waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0)
  const waterLow = waterGoal != null && waterToday < waterGoal && now.getHours() >= 17

  const reminderLines = [
    ...overdueTasks.map((x) => `⏰ ${x.title} — ${vt('dashboard.overdue')}`),
    ...dueTodayTasks.map((x) => `• ${x.title}`),
    ...calendarToday.map((x) => (x.time ? `${x.time} — ${x.title}` : `• ${x.title}`)),
  ]
  const totalDue = overdueTasks.length + dueTodayTasks.length + calendarToday.length

  const remindersSig = `${today}|${[
    ...overdueTasks.map((x) => `o:${x.id}:${x.title}`),
    ...dueTodayTasks.map((x) => `d:${x.id}:${x.title}`),
    ...calendarToday.map((x) => `c:${x.id}:${x.time ?? ''}:${x.title}`),
  ].join('|')}`

  const count =
    overdueTasks.length +
    dueTodayTasks.length +
    calendarToday.length +
    budgetAlerts.length +
    (nextRecurring ? 1 : 0) +
    (waterLow ? 1 : 0)

  return {
    overdueTasks,
    dueTodayTasks,
    calendarToday,
    budgetAlerts,
    nextRecurring,
    waterLow,
    waterToday,
    waterGoal,
    count,
    reminderLines,
    totalDue,
    remindersSig,
  }
}
