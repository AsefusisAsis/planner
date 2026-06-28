import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, ShoppingCart, ListPlus, Receipt } from 'lucide-react'
import { useStore } from '../../store'
import {
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHeader,
} from '../../components/ui'
import { CURRENCIES, type Currency, type ShoppingItem } from '../../types'
import { convert, formatMoney } from '../../services/nbrb'

interface ItemForm {
  name: string
  qty: string
  price: string
  currency: Currency
}

export default function ShoppingPage() {
  const { t } = useTranslation()

  const lists = useStore((s) => s.data.shoppingLists)
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const rates = useStore((s) => s.rates)

  const addList = useStore((s) => s.addList)
  const renameList = useStore((s) => s.renameList)
  const deleteList = useStore((s) => s.deleteList)
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)
  const toggleItem = useStore((s) => s.toggleItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const addExpense = useStore((s) => s.addExpense)

  const [activeId, setActiveId] = useState<string | null>(lists[0]?.id ?? null)
  const [notice, setNotice] = useState<string | null>(null)

  // авто-скрытие уведомления об успехе
  useEffect(() => {
    if (!notice) return
    const tmr = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(tmr)
  }, [notice])

  // держим валидный активный список даже после удаления/добавления
  useEffect(() => {
    if (lists.length === 0) {
      if (activeId !== null) setActiveId(null)
      return
    }
    if (!lists.some((l) => l.id === activeId)) {
      setActiveId(lists[0].id)
    }
  }, [lists, activeId])

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeId) ?? null,
    [lists, activeId],
  )

  // ---- модалки для списков ----
  const [listModal, setListModal] = useState<'add' | 'rename' | null>(null)
  const [listName, setListName] = useState('')

  function openAddList() {
    setListName('')
    setListModal('add')
  }
  function openRenameList() {
    if (!activeList) return
    setListName(activeList.name)
    setListModal('rename')
  }
  function submitList() {
    const name = listName.trim()
    if (!name) return
    if (listModal === 'add') {
      addList(name)
    } else if (listModal === 'rename' && activeList) {
      renameList(activeList.id, name)
    }
    setListModal(null)
  }
  function handleDeleteList() {
    if (!activeList) return
    if (window.confirm(t('shopping.deleteListConfirm', { name: activeList.name }))) {
      deleteList(activeList.id)
    }
  }

  // ---- модалка для позиций ----
  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
  const [form, setForm] = useState<ItemForm>({
    name: '',
    qty: '1',
    price: '',
    currency: baseCurrency,
  })

  function openAddItem() {
    setEditingItem(null)
    setForm({ name: '', qty: '1', price: '', currency: baseCurrency })
    setItemModal(true)
  }
  function openEditItem(it: ShoppingItem) {
    setEditingItem(it)
    setForm({
      name: it.name,
      qty: String(it.qty),
      price: it.price != null ? String(it.price) : '',
      currency: it.currency ?? baseCurrency,
    })
    setItemModal(true)
  }
  function submitItem() {
    if (!activeList) return
    const name = form.name.trim()
    if (!name) return

    const qty = Math.max(1, Math.round(Number(form.qty) || 1))
    const priceNum = form.price.trim() === '' ? NaN : Number(form.price)
    const hasPrice = Number.isFinite(priceNum) && priceNum >= 0

    const payload = {
      name,
      qty,
      price: hasPrice ? priceNum : undefined,
      currency: hasPrice ? form.currency : undefined,
    }

    if (editingItem) {
      updateItem(activeList.id, editingItem.id, payload)
    } else {
      addItem(activeList.id, payload)
    }
    setItemModal(false)
  }
  function handleDeleteItem(it: ShoppingItem) {
    if (!activeList) return
    if (window.confirm(t('shopping.deleteItemConfirm', { name: it.name }))) {
      deleteItem(activeList.id, it.id)
    }
  }

  // ---- сортировка: некупленное сверху, купленное снизу ----
  const sortedItems = useMemo(() => {
    if (!activeList) return []
    return [...activeList.items].sort(
      (a, b) => Number(a.bought) - Number(b.bought),
    )
  }, [activeList])

  // ---- итоги (в базовой валюте) ----
  function lineTotal(it: ShoppingItem): number {
    if (it.price == null) return 0
    const sum = it.price * it.qty
    const cur = it.currency ?? baseCurrency
    return rates ? convert(sum, cur, baseCurrency, rates) : sum
  }

  const totals = useMemo(() => {
    if (!activeList) return { total: 0, remaining: 0, bought: 0, count: 0 }
    let total = 0
    let remaining = 0
    let bought = 0
    for (const it of activeList.items) {
      const lt = lineTotal(it)
      total += lt
      if (it.bought) bought += 1
      else remaining += lt
    }
    return { total, remaining, bought, count: activeList.items.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList, rates, baseCurrency])

  // ---- частые товары: самые повторяющиеся названия по всем спискам ----
  const frequentNames = useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>()
    for (const l of lists) {
      for (const it of l.items) {
        const name = it.name.trim()
        if (!name) continue
        const key = name.toLowerCase()
        const prev = counts.get(key)
        if (prev) prev.count += 1
        else counts.set(key, { display: name, count: 1 })
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
      .slice(0, 8)
      .map((x) => x.display)
  }, [lists])

  // ---- «В траты»: сумма купленных позиций → одна трата в базовой валюте ----
  function handleToExpense() {
    if (!activeList) return
    let sum = 0
    let any = false
    for (const it of activeList.items) {
      if (!it.bought || it.price == null) continue
      any = true
      const line = it.price * it.qty
      const cur = it.currency ?? baseCurrency
      sum += rates ? convert(line, cur, baseCurrency, rates) : line
    }
    if (!any || sum <= 0) {
      window.alert(t('shopping.toExpenseNone'))
      return
    }
    const amount = Math.round(sum * 100) / 100
    addExpense({
      amount,
      currency: baseCurrency,
      categoryId: null,
      note: activeList.name,
      date: new Date().toISOString().slice(0, 10),
    })
    setNotice(t('shopping.toExpenseDone', { amount: formatMoney(amount, baseCurrency) }))
  }

  // быстрое добавление товара по названию из чипа
  function addFrequent(name: string) {
    if (!activeList) return
    addItem(activeList.id, { name, qty: 1 })
  }

  return (
    <div>
      <PageHeader
        title={t('shopping.title')}
        subtitle={t('shopping.subtitle')}
        action={
          <Button onClick={openAddList}>
            <ListPlus size={16} />
            {t('shopping.addList')}
          </Button>
        }
      />

      {lists.length === 0 ? (
        <Empty icon={<ShoppingCart size={32} />} text={t('shopping.noLists')} />
      ) : (
        <>
          {/* Табы списков */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {lists.map((l) => {
              const active = l.id === activeId
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveId(l.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                  }}
                >
                  {l.name}
                </button>
              )
            })}
          </div>

          {activeList && (
            <>
              {/* Уведомление об успехе */}
              {notice && (
                <div
                  className="mb-3 rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--success) 12%, transparent)',
                    color: 'var(--success)',
                  }}
                  role="status"
                >
                  {notice}
                </div>
              )}

              {/* Шапка активного списка */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm text-[var(--text-2)]">
                  {t('shopping.boughtCount', {
                    bought: totals.bought,
                    total: totals.count,
                  })}
                </div>
                <div className="flex items-center gap-1">
                  {totals.bought > 0 && (
                    <Button
                      variant="subtle"
                      onClick={handleToExpense}
                      aria-label={t('shopping.toExpense')}
                    >
                      <Receipt size={16} />
                      {t('shopping.toExpense')}
                    </Button>
                  )}
                  <IconButton onClick={openRenameList} aria-label={t('shopping.renameListTitle')}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton onClick={handleDeleteList} aria-label={t('shopping.deleteListTitle')}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>

              {/* Позиции */}
              {sortedItems.length === 0 ? (
                <Empty icon={<ShoppingCart size={32} />} text={t('shopping.emptyList')} />
              ) : (
                <div className="space-y-2">
                  {sortedItems.map((it) => (
                    <Card key={it.id} className={it.bought ? 'opacity-50' : ''}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={it.bought}
                          onChange={() => toggleItem(activeList.id, it.id)}
                          className="h-4 w-4 shrink-0 cursor-pointer"
                          style={{ width: 'auto', accentColor: 'var(--accent)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-sm font-medium ${
                              it.bought ? 'line-through' : ''
                            }`}
                          >
                            {it.name}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--text-3)]">
                            {it.qty > 1 ? `× ${it.qty}` : ''}
                            {it.price != null && (
                              <span>
                                {it.qty > 1 ? ' · ' : ''}
                                {formatMoney(
                                  it.price * it.qty,
                                  it.currency ?? baseCurrency,
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            onClick={() => openEditItem(it)}
                            aria-label={t('common.edit')}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteItem(it)}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Итоги */}
              {totals.count > 0 && (
                <Card className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-2)]">{t('shopping.total')}</span>
                    <span className="font-semibold">
                      {formatMoney(totals.total, baseCurrency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--text-2)]">{t('shopping.remaining')}</span>
                    <span className="font-medium" style={{ color: 'var(--warning)' }}>
                      {formatMoney(totals.remaining, baseCurrency)}
                    </span>
                  </div>
                </Card>
              )}

              {/* Частые товары — быстрое добавление */}
              {frequentNames.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 text-xs font-medium text-[var(--text-2)]">
                    {t('shopping.frequent')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => addFrequent(name)}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-[var(--bg-3)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                      >
                        <Plus size={12} />
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Добавить позицию */}
              <div className="mt-4">
                <Button variant="subtle" onClick={openAddItem}>
                  <Plus size={16} />
                  {t('shopping.addItem')}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Модалка списка */}
      <Modal
        open={listModal !== null}
        onClose={() => setListModal(null)}
        title={
          listModal === 'rename'
            ? t('shopping.renameListTitle')
            : t('shopping.addListTitle')
        }
      >
        <Field label={t('shopping.listName')}>
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder={t('shopping.listNamePlaceholder')}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submitList()}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setListModal(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submitList} disabled={!listName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>

      {/* Модалка позиции */}
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title={editingItem ? t('shopping.editItemTitle') : t('shopping.addItemTitle')}
      >
        <Field label={t('shopping.name')}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('shopping.namePlaceholder')}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={t('shopping.qty')}>
            <input
              type="number"
              min={1}
              step={1}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
            />
          </Field>
          <Field label={t('shopping.currency')}>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('shopping.priceOptional')}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
          />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setItemModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submitItem} disabled={!form.name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
