import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, ShoppingCart, ListPlus, Receipt } from 'lucide-react'
import { useStore } from '../../store'
import {
  Button,
  Card,
  Checkbox,
  Fab,
  Field,
  IconButton,
  Modal,
  PageHeader,
} from '../../components/ui'
import { CURRENCIES, type Currency, type ShoppingItem } from '../../types'
import { convert, formatMoney } from '../../services/nbrb'
import { todayISO } from '../../lib/id'
import { tap } from '../../lib/haptics'

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
    deleteList(activeList.id) // отмена доступна через тост «Удалено · Отменить»
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
    deleteItem(activeList.id, it.id) // отмена доступна через тост
  }

  // ---- сортировка: некупленное сверху, купленное снизу ----
  const sortedItems = useMemo(() => {
    if (!activeList) return []
    return [...activeList.items].sort(
      (a, b) => Number(a.bought) - Number(b.bought),
    )
  }, [activeList])

  // ---- итоги (в базовой валюте) ----
  // null — курса нет, позиция неконвертируема (в суммах пропускаем)
  function lineTotal(it: ShoppingItem): number | null {
    if (it.price == null) return 0
    const sum = it.price * it.qty
    const cur = it.currency ?? baseCurrency
    if (cur === baseCurrency) return sum
    return rates ? convert(sum, cur, baseCurrency, rates) : null
  }

  const totals = useMemo(() => {
    if (!activeList) return { total: 0, remaining: 0, bought: 0, count: 0 }
    let total = 0
    let remaining = 0
    let bought = 0
    for (const it of activeList.items) {
      if (it.bought) bought += 1
      const lt = lineTotal(it)
      if (lt == null) continue
      total += lt
      if (!it.bought) remaining += lt
    }
    return { total, remaining, bought, count: activeList.items.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList, rates, baseCurrency])

  // есть ли купленные позиции, ещё не проведённые в траты
  const hasUnexported = useMemo(
    () => !!activeList && activeList.items.some((it) => it.bought && !it.exportedAt),
    [activeList],
  )

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

  // ---- «В траты»: сумма купленных (ещё не проведённых) позиций → одна трата в базовой валюте ----
  function handleToExpense() {
    if (!activeList) return
    let sum = 0
    let skipped = 0 // позиции без курса — молча в 1:1 не конвертируем
    const exportedIds: string[] = []
    for (const it of activeList.items) {
      if (!it.bought || it.exportedAt || it.price == null) continue
      const line = it.price * it.qty
      const cur = it.currency ?? baseCurrency
      const inBase =
        cur === baseCurrency ? line : rates ? convert(line, cur, baseCurrency, rates) : null
      if (inBase == null) {
        skipped += 1
        continue
      }
      sum += inBase
      exportedIds.push(it.id)
    }
    if (exportedIds.length === 0) {
      setNotice(
        skipped > 0
          ? t('shopping.toExpenseNoRates', { count: skipped })
          : t('shopping.toExpenseNone'),
      )
      return
    }
    const stamp = new Date().toISOString()
    if (sum <= 0) {
      // только нулевые цены: трату не создаём, но помечаем позиции проведёнными —
      // иначе кнопка «В траты» останется висеть навсегда
      for (const id of exportedIds) {
        updateItem(activeList.id, id, { exportedAt: stamp })
      }
      setNotice(
        skipped > 0
          ? t('shopping.toExpenseNoRates', { count: skipped })
          : t('shopping.toExpenseNone'),
      )
      return
    }
    const amount = Math.round(sum * 100) / 100
    addExpense({
      amount,
      currency: baseCurrency,
      categoryId: null,
      note: activeList.name,
      date: todayISO(),
    })
    // помечаем проведённые позиции — защита от повторного проведения
    for (const id of exportedIds) {
      updateItem(activeList.id, id, { exportedAt: stamp })
    }
    setNotice(
      skipped > 0
        ? t('shopping.toExpenseDonePartial', {
            amount: formatMoney(amount, baseCurrency),
            count: skipped,
          })
        : t('shopping.toExpenseDone', { amount: formatMoney(amount, baseCurrency) }),
    )
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
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-[var(--text-3)]">
            <ShoppingCart size={36} />
          </div>
          <p className="text-base font-medium text-[var(--text)]">
            {t('shopping.noLists')}
          </p>
          <p className="max-w-xs text-sm text-[var(--text-3)]">
            {t('shopping.noListsHint')}
          </p>
          <Button className="mt-1" onClick={openAddList}>
            <ListPlus size={16} />
            {t('shopping.createFirstList')}
          </Button>
        </div>
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
              <div className="mb-3 flex items-center justify-end gap-1">
                {hasUnexported && (
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
                <IconButton danger big onClick={handleDeleteList} aria-label={t('shopping.deleteListTitle')}>
                  <Trash2 size={16} />
                </IconButton>
              </div>

              {/* Прогресс списка */}
              {totals.count > 0 && (
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--text-2)]">
                      {t('shopping.progress')}
                    </span>
                    <span className="tnum font-medium text-[var(--text)]">
                      {t('shopping.boughtCount', {
                        bought: totals.bought,
                        total: totals.count,
                      })}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--bg-3)' }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={totals.count}
                    aria-valuenow={totals.bought}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${
                          totals.count > 0 ? (totals.bought / totals.count) * 100 : 0
                        }%`,
                        background: 'var(--success)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Двухколоночная раскладка на десктопе, одна колонка на мобиле */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
                {/* Левая колонка: позиции списка */}
                <div className="min-w-0">
                  {sortedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                      <div className="text-[var(--text-3)]">
                        <ShoppingCart size={32} />
                      </div>
                      <p className="text-base font-medium text-[var(--text)]">
                        {t('shopping.emptyList')}
                      </p>
                      <p className="max-w-xs text-sm text-[var(--text-3)]">
                        {t('shopping.emptyListHint')}
                      </p>
                      <Button className="mt-1" onClick={openAddItem}>
                        <Plus size={16} />
                        {t('shopping.addItem')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedItems.map((it) => (
                        <Card key={it.id} className={it.bought ? 'opacity-50' : ''}>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={it.bought}
                              onChange={() => toggleItem(activeList.id, it.id)}
                              label={it.name}
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
                                {it.qty > 1 ? <span className="tnum">{`× ${it.qty}`}</span> : ''}
                                {it.price != null && (
                                  <span className="tnum">
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
                                danger
                                big
                                onClick={() => handleDeleteItem(it)}
                                aria-label={t('common.delete')}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </div>
                          </div>
                        </Card>
                      ))}

                      {/* Добавить позицию (под списком) */}
                      <div className="pt-1">
                        <Button variant="subtle" onClick={openAddItem}>
                          <Plus size={16} />
                          {t('shopping.addItem')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Правая колонка (боковая панель): на десктопе sticky */}
                <aside className="space-y-4 lg:sticky lg:top-4">
                  {/* Добавить позицию */}
                  <Card>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                      {t('shopping.addItemTitlePanel')}
                    </div>
                    <Button className="w-full" onClick={openAddItem}>
                      <Plus size={16} />
                      {t('shopping.addItem')}
                    </Button>
                  </Card>

                  {/* Итоги — крупно и контрастно */}
                  {totals.count > 0 && (
                    <Card>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                        {t('shopping.totalsTitle')}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[var(--text-2)]">
                          {t('shopping.total')}
                        </span>
                        <span className="tnum text-2xl font-bold text-[var(--text)]">
                          {formatMoney(totals.total, baseCurrency)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm text-[var(--text-2)]">
                          {t('shopping.remaining')}
                        </span>
                        <span
                          className="tnum text-lg font-semibold"
                          style={{ color: 'var(--warning)' }}
                        >
                          {formatMoney(totals.remaining, baseCurrency)}
                        </span>
                      </div>
                    </Card>
                  )}

                  {/* Частые товары — быстрое добавление */}
                  {frequentNames.length > 0 && (
                    <Card>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
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
                    </Card>
                  )}
                </aside>
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
              inputMode="numeric"
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
            inputMode="decimal"
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

      {/* FAB (мобильный): добавить товар в активный список; когда списков нет —
          создать первый список. При открытой модалке не показываем. */}
      {listModal === null &&
        !itemModal &&
        (activeList ? (
          <Fab
            label={t('shopping.addItem')}
            onClick={() => {
              tap('light') // чисто-UI действие: открытие модалки, стор не трогаем
              openAddItem()
            }}
          />
        ) : lists.length === 0 ? (
          <Fab
            label={t('shopping.createFirstList')}
            onClick={() => {
              tap('light')
              openAddList()
            }}
          />
        ) : null)}
    </div>
  )
}
