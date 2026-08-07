import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button, Field, Modal, SegmentedControl } from '../../components/ui'
import { CurrencySelect } from '../../components/CurrencySelect'
import { useStore } from '../../store'
import {
  preferredCurrencies,
  amountStep,
  type Currency,
  type RecurringExpense,
  type TxnType,
} from '../../types'

interface RecurringForm {
  label: string
  amount: string
  currency: Currency
  categoryId: string | null
  type: TxnType
  dayOfMonth: string
  /** 'YYYY-MM' — дата окончания платежа (кредит); пусто = бессрочный */
  endMonth: string
  /** платёж последнего месяца (остаток), если отличается; пусто = как обычный */
  lastAmount: string
  /** заметка: номер счёта по кредиту, реквизиты, к чему платёж */
  note: string
}

function fromRecurring(r: RecurringExpense): RecurringForm {
  return {
    label: r.label,
    amount: String(r.amount),
    currency: r.currency,
    categoryId: r.categoryId,
    type: r.type ?? 'expense',
    dayOfMonth: String(r.dayOfMonth),
    endMonth: r.endMonth ?? '',
    lastAmount: r.lastAmount != null ? String(r.lastAmount) : '',
    note: r.note ?? '',
  }
}

function empty(baseCurrency: Currency): RecurringForm {
  return {
    label: '',
    amount: '',
    currency: baseCurrency,
    categoryId: null,
    type: 'expense',
    dayOfMonth: '1',
    endMonth: '',
    lastAmount: '',
    note: '',
  }
}

/**
 * Повторяющийся платёж: обычный ежемесячный либо кредит с датой окончания
 * и отличающимся последним взносом.
 *
 * `editing`: undefined — окно закрыто, null — новый платёж, объект — правка.
 * Три состояния в одном пропсе, как у ExpenseModal: пара «открыто + что
 * правим» могла бы разъехаться, здесь это невозможно по построению.
 *
 * Правка нужна была не для удобства. Поменять сумму или число можно было
 * только «удалить и создать заново», а новый платёж не помнит
 * lastAppliedMonth — и начислялся в том же месяце ВТОРОЙ раз.
 */
export function RecurringModal({
  editing,
  onClose,
}: {
  editing: RecurringExpense | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const displayCurrencies = useStore((s) => s.data.settings.displayCurrencies)
  const preferred = preferredCurrencies({ baseCurrency, displayCurrencies })
  const categories = useStore((s) => s.data.expenseCategories)
  const addRecurring = useStore((s) => s.addRecurring)
  const updateRecurring = useStore((s) => s.updateRecurring)
  const deleteRecurring = useStore((s) => s.deleteRecurring)
  const [form, setForm] = useState<RecurringForm>(() => empty(baseCurrency))

  // наполняем при ОТКРЫТИИ, как в ExpenseModal
  useEffect(() => {
    if (editing === undefined) return
    setForm(editing ? fromRecurring(editing) : empty(baseCurrency))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  function submit() {
    const label = form.label.trim()
    const amount = Number(form.amount)
    if (!label || !Number.isFinite(amount) || amount <= 0) return
    const dayRaw = Math.round(Number(form.dayOfMonth))
    const dayOfMonth = Math.min(28, Math.max(1, Number.isFinite(dayRaw) ? dayRaw : 1))
    // дата окончания (кредит) и платёж последнего месяца — опциональны
    const endMonth = /^\d{4}-\d{2}$/.test(form.endMonth) ? form.endMonth : undefined
    const lastRaw = Number(form.lastAmount)
    const lastAmount =
      endMonth && form.lastAmount.trim() !== '' && Number.isFinite(lastRaw) && lastRaw > 0
        ? lastRaw
        : undefined
    const payload = {
      label,
      amount,
      currency: form.currency,
      categoryId: form.categoryId,
      type: form.type,
      dayOfMonth,
      // При ПРАВКЕ пишем поля всегда, в т.ч. undefined: снятую дату окончания
      // или убранный остаток иначе не стереть — отсутствие ключа оставило бы
      // старое значение, и «бессрочный» платёж молча остался бы кредитом.
      endMonth,
      lastAmount,
      note: form.note.trim() || undefined,
    }
    if (editing) updateRecurring(editing.id, payload)
    else
      addRecurring({
        ...payload,
        ...(endMonth ? {} : { endMonth: undefined }),
      })
    onClose()
  }

  const valid =
    form.label.trim() !== '' &&
    Number.isFinite(Number(form.amount)) &&
    Number(form.amount) > 0

  return (
    <Modal
      open={editing !== undefined}
      onClose={() => onClose()}
      title={editing ? t('expenses.editRecurring') : t('expenses.addRecurring')}
      onSubmit={submit}
    >
      <Field label={t('expenses.type')}>
        <SegmentedControl<TxnType>
          value={form.type}
          onChange={(tp) => setForm((f) => ({ ...f, type: tp }))}
          options={[
            { value: 'expense', label: t('expenses.typeExpense') },
            { value: 'income', label: t('expenses.typeIncome') },
          ]}
        />
      </Field>

      <Field label={t('expenses.recurringLabel')}>
        <input
          value={form.label}
          placeholder={t('expenses.recurringLabelPlaceholder')}
          onChange={(ev) => setForm((f) => ({ ...f, label: ev.target.value }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('expenses.amount')}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={amountStep(form.currency)}
            value={form.amount}
            onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))}
          />
        </Field>
        <Field label={t('expenses.currency')}>
          <CurrencySelect
            value={form.currency}
            onChange={(c) => setForm((f) => ({ ...f, currency: c }))}
            preferred={preferred}
          />
        </Field>
      </div>

      <Field label={t('expenses.category')}>
        <select
          value={form.categoryId ?? ''}
          onChange={(ev) =>
            setForm((f) => ({ ...f, categoryId: ev.target.value || null }))
          }
        >
          <option value="">{t('expenses.noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('expenses.dayOfMonth')}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          step="1"
          value={form.dayOfMonth}
          onChange={(ev) => setForm((f) => ({ ...f, dayOfMonth: ev.target.value }))}
        />
      </Field>

      {/* Дата окончания (кредит): после неё платёж не начисляется; можно
          задать иной платёж последнего месяца (остаток). Обе — опционально. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('expenses.endMonth')} hint={t('expenses.endMonthHint')}>
          <input
            type="month"
            value={form.endMonth}
            onChange={(ev) => setForm((f) => ({ ...f, endMonth: ev.target.value }))}
          />
        </Field>
        {form.endMonth && (
          <Field label={t('expenses.lastPayment')} hint={t('expenses.lastPaymentHint')}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.lastAmount}
              placeholder={form.amount || '—'}
              onChange={(ev) => setForm((f) => ({ ...f, lastAmount: ev.target.value }))}
            />
          </Field>
        )}
      </div>

      <Field label={t('expenses.recurringNote')} hint={t('expenses.recurringNoteHint')}>
        <input
          value={form.note}
          onChange={(ev) => setForm((f) => ({ ...f, note: ev.target.value }))}
          placeholder={t('expenses.recurringNotePlaceholder')}
          maxLength={80}
        />
      </Field>

      <div className="mt-2 flex items-center justify-between gap-2">
        {editing ? (
          <Button
            variant="danger"
            onClick={() => {
              deleteRecurring(editing.id)
              onClose()
            }}
          >
            <Trash2 size={16} /> {t('expenses.delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onClose()}>
            {t('expenses.cancel')}
          </Button>
          <Button type="submit" disabled={!valid}>
            {t('expenses.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
