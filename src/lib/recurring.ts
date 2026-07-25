// Чистая логика повторяющихся платежей с датой окончания (кредиты).
// Вынесена из стора, чтобы покрыть тестами и переиспользовать в
// планировщике уведомлений.

/** Часть RecurringExpense, влияющая на график: сумма + опц. окончание. */
export interface RecurringSchedule {
  amount: number
  /** последний месяц начисления включительно 'YYYY-MM'; после него не платим */
  endMonth?: string
  /** платёж последнего месяца, если отличается от amount */
  lastAmount?: number
}

/** monthKey — 'YYYY-MM'. Платёж завершён (после даты окончания)? */
export function isEnded(r: RecurringSchedule, monthKey: string): boolean {
  return !!r.endMonth && monthKey > r.endMonth
}

/** Сумма к начислению в данном месяце: обычная, кроме последнего месяца
 *  кредита с иным платежом (остаток). */
export function amountForMonth(r: RecurringSchedule, monthKey: string): number {
  return r.endMonth && monthKey === r.endMonth && r.lastAmount != null ? r.lastAmount : r.amount
}
