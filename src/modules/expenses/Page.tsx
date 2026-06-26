import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tags,
  Wallet,
} from 'lucide-react'
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns'
import { ru as ruLocale, enUS } from 'date-fns/locale'
import { useStore } from '../../store'
import { Donut, type DonutSegment } from '../../components/Donut'
import { Button, Card, Empty, Field, IconButton, Modal, PageHeader } from '../../components/ui'
import { CURRENCIES, type Currency, type Expense } from '../../types'
import { convert, formatMoney } from '../../services/nbrb'
import { todayISO } from '../../lib/id'

interface ExpenseForm {
  amount: string
  currency: Currency
  categoryId: string | null
  note: string
  date: string
}

interface CategoryForm {
  name: string
  color: string
  budget: string
}

export default function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('ru') ? ruLocale : enUS

  const expenses = useStore((s) => s.data.expenses)
  const categories = useStore((s) => s.data.expenseCategories)
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const rates = useStore((s) => s.rates)

  const addExpense = useStore((s) => s.addExpense)
  const updateExpense = useStore((s) => s.updateExpense)
  const deleteExpense = useStore((s) => s.deleteExpense)
  const addCategory = useStore((s) => s.addCategory)
  const deleteCategory = useStore((s) => s.deleteCategory)

  // ---- month filter ----
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEnd = useMemo(() => endOfMonth(month), [month])

  // ---- expense modal ----
  const [expenseModal, setExpenseModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyExpenseForm(baseCurrency))

  // ---- category modal ----
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState<CategoryForm>({ name: '', color: '#6366f1', budget: '' })

  /** Конвертация в базовую валюту с учётом null-курсов. Возвращает null, если посчитать нельзя. */
  function toBase(amount: number, from: Currency): number | null {
    if (from === baseCurrency) return amount
    if (!rates) return null
    return convert(amount, from, baseCurrency, rates)
  }

  // ---- expenses of selected month ----
  const monthExpenses = useMemo(
    () =>
      expenses.filter((e) =>
        isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }),
      ),
    [expenses, monthStart, monthEnd],
  )

  // ---- month total (base currency) ----
  const monthTotal = useMemo(
    () =>
      monthExpenses.reduce((sum, e) => {
        const v = toBase(e.amount, e.currency)
        return v === null ? sum : sum + v
      }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthExpenses, rates, baseCurrency],
  )

  // ---- per-category breakdown (base currency) ----
  const breakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthExpenses) {
      const v = toBase(e.amount, e.currency)
      if (v === null) continue
      const key = e.categoryId ?? '__none__'
      map.set(key, (map.get(key) ?? 0) + v)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthExpenses, rates, baseCurrency])

  function categoryById(id: string | null) {
    return id ? categories.find((c) => c.id === id) ?? null : null
  }

  // ---- donut segments (reuses breakdown) ----
  const donutSegments = useMemo<DonutSegment[]>(
    () =>
      [...breakdown.entries()]
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => {
          const cat = key === '__none__' ? null : categoryById(key)
          return {
            label: cat?.name ?? t('expenses.noCategory'),
            value,
            color: cat?.color ?? 'var(--text-3)',
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breakdown, categories, t],
  )

  // ---- expense modal handlers ----
  function openAdd() {
    setEditingId(null)
    setForm(emptyExpenseForm(baseCurrency))
    setExpenseModal(true)
  }

  function openEdit(e: Expense) {
    setEditingId(e.id)
    setForm({
      amount: String(e.amount),
      currency: e.currency,
      categoryId: e.categoryId,
      note: e.note,
      date: e.date,
    })
    setExpenseModal(true)
  }

  function submitExpense() {
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const payload = {
      amount,
      currency: form.currency,
      categoryId: form.categoryId,
      note: form.note.trim(),
      date: form.date,
    }
    if (editingId) updateExpense(editingId, payload)
    else addExpense(payload)
    setExpenseModal(false)
  }

  function removeExpense() {
    if (editingId) deleteExpense(editingId)
    setExpenseModal(false)
  }

  // ---- category modal handlers ----
  function submitCategory() {
    const name = catForm.name.trim()
    if (!name) return
    const budgetNum = Number(catForm.budget)
    addCategory({
      name,
      color: catForm.color,
      budget: catForm.budget.trim() && Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : undefined,
    })
    setCatForm({ name: '', color: '#6366f1', budget: '' })
  }

  const amountValid = Number.isFinite(Number(form.amount)) && Number(form.amount) > 0

  return (
    <div>
      <PageHeader
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> {t('expenses.add')}
          </Button>
        }
      />

      {/* Month switcher + summary */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <IconButton onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="prev">
            <ChevronLeft size={18} />
          </IconButton>
          <span className="text-sm font-medium capitalize">{format(month, 'LLLL yyyy', { locale })}</span>
          <IconButton onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="next">
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--text-2)]">{t('expenses.monthTotal')}</span>
          <span className="text-xl font-semibold">{formatMoney(monthTotal, baseCurrency)}</span>
        </div>
        {!rates && (
          <p className="mt-2 text-xs" style={{ color: 'var(--warning)' }}>
            {t('expenses.ratesLoading')}
          </p>
        )}
      </Card>

      {/* Category breakdown */}
      {breakdown.size > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('expenses.breakdown')}</h2>
          {donutSegments.length > 0 && (
            <div className="mb-4 flex justify-center">
              <Donut
                segments={donutSegments}
                centerTop={formatMoney(monthTotal, baseCurrency)}
                centerBottom={t('expenses.chartCenterLabel')}
              />
            </div>
          )}
          <div className="space-y-3">
            {[...breakdown.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([key, spent]) => {
                const cat = key === '__none__' ? null : categoryById(key)
                const color = cat?.color ?? 'var(--text-3)'
                const name = cat?.name ?? t('expenses.noCategory')
                const over = cat?.budget != null && spent > cat.budget
                const pct = cat?.budget ? Math.min(100, (spent / cat.budget) * 100) : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        {name}
                      </span>
                      <span className="font-medium">
                        {formatMoney(spent, baseCurrency)}
                        {cat?.budget != null && (
                          <span className="text-[var(--text-3)]">
                            {' '}
                            {t('expenses.spentOf')} {formatMoney(cat.budget, baseCurrency)}
                          </span>
                        )}
                      </span>
                    </div>
                    {cat?.budget != null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: over ? 'var(--danger)' : color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Expense list */}
      <Card className="mb-4">
        {monthExpenses.length === 0 ? (
          <Empty icon={<Wallet size={28} />} text={t('expenses.emptyList')} />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {monthExpenses.map((e) => {
              const cat = categoryById(e.categoryId)
              const converted = e.currency !== baseCurrency ? toBase(e.amount, e.currency) : null
              return (
                <button
                  key={e.id}
                  onClick={() => openEdit(e)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--bg-3)]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? 'var(--text-3)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {cat?.name ?? t('expenses.noCategory')}
                    </div>
                    <div className="truncate text-xs text-[var(--text-3)]">
                      {[e.note, format(parseISO(e.date), 'dd.MM.yyyy')].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium">{formatMoney(e.amount, e.currency)}</div>
                    {converted !== null && (
                      <div className="text-xs text-[var(--text-3)]">
                        ({formatMoney(converted, baseCurrency)})
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Manage categories */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <Tags size={16} /> {t('expenses.categories')}
        </h2>
        {categories.length === 0 ? (
          <Empty text={t('expenses.noCategories')} />
        ) : (
          <div className="mb-3 space-y-1">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate text-sm">{c.name}</span>
                {c.budget != null && (
                  <span className="text-xs text-[var(--text-3)]">
                    {t('expenses.budget')}: {formatMoney(c.budget, baseCurrency)}
                  </span>
                )}
                <IconButton onClick={() => deleteCategory(c.id)} aria-label={t('expenses.deleteCategory')}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        <Button variant="subtle" onClick={() => setCatModal(true)}>
          <Plus size={16} /> {t('expenses.addCategory')}
        </Button>
      </Card>

      {/* Expense modal */}
      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title={editingId ? t('expenses.edit') : t('expenses.add')}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('expenses.amount')}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))}
              autoFocus
            />
          </Field>
          <Field label={t('expenses.currency')}>
            <select
              value={form.currency}
              onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value as Currency }))}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        {!amountValid && form.amount.trim() !== '' && (
          <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
            {t('expenses.invalidAmount')}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {editingId ? (
            <Button variant="danger" onClick={removeExpense}>
              <Trash2 size={16} /> {t('expenses.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setExpenseModal(false)}>
              {t('expenses.cancel')}
            </Button>
            <Button onClick={submitExpense} disabled={!amountValid}>
              {t('expenses.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={t('expenses.addCategory')}>
        <Field label={t('expenses.categoryName')}>
          <input
            value={catForm.name}
            placeholder={t('expenses.categoryNamePlaceholder')}
            onChange={(ev) => setCatForm((f) => ({ ...f, name: ev.target.value }))}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('expenses.categoryColor')}>
            <input
              type="color"
              value={catForm.color}
              onChange={(ev) => setCatForm((f) => ({ ...f, color: ev.target.value }))}
              className="h-10 p-1"
            />
          </Field>
          <Field label={t('expenses.categoryBudget')}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={catForm.budget}
              onChange={(ev) => setCatForm((f) => ({ ...f, budget: ev.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCatModal(false)}>
            {t('expenses.cancel')}
          </Button>
          <Button
            onClick={submitCategory}
            disabled={!catForm.name.trim()}
          >
            {t('expenses.save')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function emptyExpenseForm(baseCurrency: Currency): ExpenseForm {
  return {
    amount: '',
    currency: baseCurrency,
    categoryId: null,
    note: '',
    date: todayISO(),
  }
}
