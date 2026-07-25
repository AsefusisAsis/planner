// Чистая логика налога с доходов. Вынесена из стора для тестируемости.
// Модель: налог за месяц M начисляется в следующий месяц (M+1), так как в
// текущем месяце пользователь платит налог за прошлый.

/** Налог = процент от дохода в базовой валюте, округлённый до 2 знаков.
 *  Неположительный доход/ставка → 0. */
export function computeTax(incomeBase: number, percent: number): number {
  if (!(incomeBase > 0) || !(percent > 0)) return 0
  return Math.round(incomeBase * percent) / 100
}

/** 'YYYY-MM' предыдущего месяца (для месяца доходов относительно месяца
 *  начисления). */
export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}
