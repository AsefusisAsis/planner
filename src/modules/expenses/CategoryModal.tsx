import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Modal } from '../../components/ui'
import { useStore } from '../../store'
import { amountStep } from '../../types'

interface CategoryForm {
  name: string
  color: string
  budget: string
}

const EMPTY: CategoryForm = { name: '', color: '#6366f1', budget: '' }

/**
 * Новая категория трат.
 *
 * Форма живёт ВНУТРИ компонента, а не в странице: наружу торчат только
 * «открыто» и «закрыть». Раньше это состояние лежало в expenses/Page вместе
 * с ещё двумя формами, и файл разросся до тысячи строк.
 */
export function CategoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const addCategory = useStore((s) => s.addCategory)
  const [form, setForm] = useState<CategoryForm>(EMPTY)

  function submit() {
    const name = form.name.trim()
    if (!name) return
    const budgetNum = Number(form.budget)
    const hasBudget = form.budget.trim() !== '' && Number.isFinite(budgetNum) && budgetNum > 0
    addCategory({
      name,
      color: form.color,
      budget: hasBudget ? budgetNum : undefined,
      // фиксируем валюту бюджета на момент сохранения — смена baseCurrency не сломает сравнение
      budgetCurrency: hasBudget ? baseCurrency : undefined,
    })
    // Окно НЕ закрываем — так было до выделения компонента: форма очищается,
    // и можно завести несколько категорий подряд. Поведение сохранено
    // намеренно, чтобы этот шаг остался чисто структурным.
    setForm(EMPTY)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('expenses.addCategory')} onSubmit={submit}>
      <Field label={t('expenses.categoryName')}>
        <input
          value={form.name}
          placeholder={t('expenses.categoryNamePlaceholder')}
          onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('expenses.categoryColor')}>
          <input
            type="color"
            value={form.color}
            onChange={(ev) => setForm((f) => ({ ...f, color: ev.target.value }))}
            className="h-10 p-1"
          />
        </Field>
        <Field label={t('expenses.categoryBudget')}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={amountStep(baseCurrency)}
            value={form.budget}
            onChange={(ev) => setForm((f) => ({ ...f, budget: ev.target.value }))}
          />
        </Field>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('expenses.cancel')}
        </Button>
        <Button type="submit" disabled={!form.name.trim()}>
          {t('expenses.save')}
        </Button>
      </div>
    </Modal>
  )
}
