import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Receipt, AlertTriangle } from 'lucide-react'
import { Button, Field, Modal } from '../../components/ui'
import { useStore } from '../../store'
import { convert, formatMoney } from '../../services/rates'
import { todayISO } from '../../lib/id'
import { buildExportPlan } from '../../lib/shoppingExport'
import { amountStep, type Currency, type ShoppingList } from '../../types'

/**
 * Проведение купленных позиций списка в трату.
 *
 * Раньше это была кнопка без окна: она молча складывала позиции, У КОТОРЫХ
 * УЖЕ ЕСТЬ ЦЕНА, а остальные пропускала. В обычном списке покупок цены не
 * пишут заранее, поэтому чаще всего кнопка отвечала «нечего проводить» —
 * связка «купил → попало в бюджет» на бумаге работала, а в жизни нет.
 *
 * Теперь цену спрашиваем здесь: человек нажимает «В траты», когда пришёл из
 * магазина с чеком, и это ровно тот момент, когда цены у него перед глазами.
 *
 * Окно ещё и показывает итог до сохранения. Для денежной записи это не
 * лишний шаг: то же правило, что у импорта из уведомления — молча создать
 * трату с неверной суммой хуже, чем спросить.
 */
export function ToExpenseModal({
  list,
  onClose,
}: {
  /** null — окно закрыто */
  list: ShoppingList | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const rates = useStore((s) => s.rates)
  const categories = useStore((s) => s.data.expenseCategories)
  const addExpense = useStore((s) => s.addExpense)
  const updateItem = useStore((s) => s.updateItem)
  const setListCategory = useStore((s) => s.setListCategory)

  // цены, введённые здесь: строками, чтобы пустое поле не превращалось в ноль
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    if (!list) return
    setPrices(
      Object.fromEntries(
        list.items
          .filter((it) => it.bought && !it.exportedAt)
          .map((it) => [it.id, it.price != null ? String(it.price) : '']),
      ),
    )
    // категория списка — подсказка по умолчанию; менять можно прямо здесь
    setCategoryId(list.categoryId ?? null)
    setDate(todayISO())
  }, [list])

  const toBase = (amount: number, from: Currency): number | null =>
    rates ? convert(amount, from, baseCurrency, rates) : null

  // План считаем по ВВЕДЁННЫМ ценам, а не по сохранённым: пока окно открыто,
  // человек правит суммы и должен видеть итог сразу.
  const plan = useMemo(() => {
    if (!list) return null
    const patched = list.items.map((it) => {
      const raw = prices[it.id]
      if (raw === undefined) return it
      const n = raw.trim() === '' ? undefined : Number(raw)
      return { ...it, price: Number.isFinite(n) ? n : undefined }
    })
    return buildExportPlan(patched, baseCurrency, toBase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, prices, rates, baseCurrency])

  if (!list || !plan) return null

  const anyToExport = plan.lines.some((l) => l.base != null)

  function submit() {
    if (!list || !plan || !anyToExport) return
    const stamp = new Date().toISOString()

    // 1. Сохраняем введённые цены в сами позиции: они часть истории списка,
    //    а не одноразовый ввод ради суммы.
    for (const line of plan.lines) {
      if (line.price != null) updateItem(list.id, line.id, { price: line.price })
    }

    // 2. Одна трата на весь поход, с категорией — иначе в бюджет не попадёт.
    addExpense({
      amount: plan.total,
      currency: baseCurrency,
      categoryId,
      note: list.name,
      date,
    })

    // 3. Помечаем проведёнными ТОЛЬКО те, что вошли в сумму. Позиция без
    //    курса остаётся непроведённой: её проведут, когда курсы появятся.
    for (const line of plan.lines) {
      if (line.base != null) updateItem(list.id, line.id, { exportedAt: stamp })
    }

    // 4. Запоминаем категорию на списке — в следующий раз подставится сама.
    if (categoryId !== (list.categoryId ?? null)) setListCategory(list.id, categoryId)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={t('shopping.toExpense')} onSubmit={submit}>
      <p className="mb-3 text-xs text-[var(--text-3)]">{t('shopping.toExpenseHint')}</p>

      <div className="mb-3 flex flex-col gap-2">
        {plan.lines.map((line) => (
          <div key={line.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {line.name}
              {line.qty !== 1 && <span className="text-[var(--text-3)]"> × {line.qty}</span>}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={amountStep(line.currency)}
              value={prices[line.id] ?? ''}
              placeholder={t('shopping.pricePlaceholder')}
              aria-label={`${t('shopping.price')}: ${line.name}`}
              onChange={(e) => setPrices((p) => ({ ...p, [line.id]: e.target.value }))}
              className="w-24 shrink-0"
            />
            <span className="w-10 shrink-0 text-xs text-[var(--text-3)]">{line.currency}</span>
          </div>
        ))}
      </div>

      {plan.noRate > 0 && (
        <div
          className="mb-3 flex items-start gap-2 rounded-lg border p-3 text-xs"
          style={{
            color: 'var(--warning-text)',
            borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{t('shopping.toExpenseNoRates', { count: plan.noRate })}</span>
        </div>
      )}

      <Field label={t('expenses.category')} hint={t('shopping.categoryHint')}>
        <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value || null)}>
          <option value="">{t('expenses.noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('expenses.date')}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
      </Field>

      <div
        className="mt-1 flex items-center justify-between rounded-lg p-3"
        style={{ background: 'var(--bg-3)' }}
      >
        <span className="text-sm text-[var(--text-2)]">{t('shopping.total')}</span>
        <span className="tnum text-lg font-semibold">{formatMoney(plan.total, baseCurrency)}</span>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('expenses.cancel')}
        </Button>
        <Button type="submit" disabled={!anyToExport}>
          <Receipt size={16} /> {t('shopping.toExpenseConfirm')}
        </Button>
      </div>
    </Modal>
  )
}
