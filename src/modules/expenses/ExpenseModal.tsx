import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button, Checkbox, Field, Modal, SegmentedControl } from '../../components/ui'
import { CurrencySelect } from '../../components/CurrencySelect'
import { useStore } from '../../store'
import { preferredCurrencies, amountStep, type Currency, type Expense, type TxnType } from '../../types'
import { todayISO } from '../../lib/id'

interface ExpenseForm {
  amount: string
  currency: Currency
  categoryId: string | null
  note: string
  date: string
  type: TxnType
  /** пометка «относится к налоговой отчётности» */
  taxRelevant: boolean
}

function empty(baseCurrency: Currency): ExpenseForm {
  return {
    amount: '',
    currency: baseCurrency,
    categoryId: null,
    note: '',
    date: todayISO(),
    type: 'expense',
    taxRelevant: false,
  }
}

function fromExpense(e: Expense): ExpenseForm {
  return {
    amount: String(e.amount),
    currency: e.currency,
    categoryId: e.categoryId,
    note: e.note,
    date: e.date,
    type: e.type ?? 'expense',
    taxRelevant: !!e.taxRelevant,
  }
}

/**
 * Добавление и правка операции.
 *
 * : undefined — окно закрыто, null — новая запись, Expense — правка.
 * Три состояния в одном пропсе вместо пары «открыто + что правим»: рассинхрон
 * между ними невозможен по построению.
 */
export function ExpenseModal({
  editing,
  onClose,
}: {
  editing: Expense | null | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const displayCurrencies = useStore((s) => s.data.settings.displayCurrencies)
  const preferred = preferredCurrencies({ baseCurrency, displayCurrencies })
  const categories = useStore((s) => s.data.expenseCategories)
  const addExpense = useStore((s) => s.addExpense)
  const updateExpense = useStore((s) => s.updateExpense)
  const deleteExpense = useStore((s) => s.deleteExpense)

  const [form, setForm] = useState<ExpenseForm>(() => empty(baseCurrency))

  // Форма наполняется при ОТКРЫТИИ. Раньше это делали openAdd/openEdit на
  // странице; здесь эффект даёт тот же результат, но состояние формы не
  // разъезжается с тем, что мы правим.
  useEffect(() => {
    if (editing === undefined) return
    setForm(editing ? fromExpense(editing) : empty(baseCurrency))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const amountValid = Number.isFinite(Number(form.amount)) && Number(form.amount) > 0

  function submit() {
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const payload = {
      amount,
      currency: form.currency,
      categoryId: form.categoryId,
      note: form.note.trim(),
      date: form.date,
      type: form.type,
      // пишем поле всегда: при снятии галочки в существующей записи
      // отсутствие ключа оставило бы старое значение
      taxRelevant: form.taxRelevant,
    }
    if (editing) updateExpense(editing.id, payload)
    else addExpense(payload)
    onClose()
  }

  function remove() {
    if (editing) deleteExpense(editing.id)
    onClose()
  }

  return (
    <Modal
      open={editing !== undefined}
      onClose={() => onClose()}
      title={editing ? t('expenses.edit') : t('expenses.add')}
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
          onChange={(ev) => setForm((f) => ({ ...f, categoryId: ev.target.value || null }))}
        >
          <option value="">{t('expenses.noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('expenses.note')}>
        <input
          value={form.note}
          placeholder={t('expenses.notePlaceholder')}
          onChange={(ev) => setForm((f) => ({ ...f, note: ev.target.value }))}
        />
      </Field>

      <Field label={t('expenses.date')}>
        <input
          type="date"
          value={form.date}
          onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value || todayISO() }))}
        />
      </Field>

      {/* Пометку ставит пользователь: приложение не решает за него, что
          относится к отчётности, и не считает налог к уплате. */}
      <Checkbox
        checked={form.taxRelevant}
        onChange={(v) => setForm((f) => ({ ...f, taxRelevant: v }))}
        label={t('expenses.taxRelevant')}
      />
      <p className="mb-3 mt-1 text-xs text-[var(--text-3)]">{t('expenses.taxRelevantHint')}</p>

      {!amountValid && form.amount.trim() !== '' && (
        <p className="mb-3 text-xs" style={{ color: 'var(--danger-text)' }}>
          {t('expenses.invalidAmount')}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {editing ? (
          <Button variant="danger" onClick={remove}>
            <Trash2 size={16} /> {t('expenses.delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onClose()}>
            {t('expenses.cancel')}
          </Button>
          <Button type="submit" disabled={!amountValid}>
            {t('expenses.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
