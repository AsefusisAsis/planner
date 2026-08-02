import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tags,
  Wallet,
  Repeat,
  Search,
  X,
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
import { useVoice } from '../../lib/voice'
import { Donut, type DonutSegment } from '../../components/Donut'
import {
  Button,
  Card,
  Empty,
  Fab,
  IconButton,
  PageHeader,
} from '../../components/ui'
import { type Currency, type Expense, type TxnType } from '../../types'
import { convert, formatMoney, amountInBase } from '../../services/rates'
import { TaxReportCard } from './TaxReport'
import { ExpenseModal } from './ExpenseModal'
import { CategoryModal } from './CategoryModal'
import { RecurringModal } from './RecurringModal'

export default function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const vt = useVoice()
  const locale = i18n.language.startsWith('ru') ? ruLocale : enUS

  const expenses = useStore((s) => s.data.expenses)
  const categories = useStore((s) => s.data.expenseCategories)
  const recurringExpenses = useStore((s) => s.data.recurringExpenses)
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const rates = useStore((s) => s.rates)

  const deleteCategory = useStore((s) => s.deleteCategory)
  const deleteRecurring = useStore((s) => s.deleteRecurring)

  // ---- month filter ----
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEnd = useMemo(() => endOfMonth(month), [month])

  // ---- search / filters for the operations list ----
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TxnType>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // UX-тупик: выбранная в фильтре категория могла быть удалена (в т.ч. с
  // другого устройства) — фильтр молча пустил бы список в ноль, а селект
  // показывал бы пустоту. Сбрасываем на «Все».
  if (
    categoryFilter !== 'all' &&
    categoryFilter !== '__none__' &&
    !categories.some((c) => c.id === categoryFilter)
  ) {
    setCategoryFilter('all')
  }

  // ---- expense modal ----
  // undefined — окно закрыто, null — новая запись, Expense — правка
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined)

  // ---- category modal ----
  const [catModal, setCatModal] = useState(false)

  // ---- recurring modal ----
  const [recurringModal, setRecurringModal] = useState(false)

  /** Конвертация в базовую валюту с учётом null-курсов. Возвращает null, если посчитать нельзя. */
  function toBase(amount: number, from: Currency): number | null {
    if (from === baseCurrency) return amount
    if (!rates) return null
    return convert(amount, from, baseCurrency, rates)
  }
  /** Сумма траты в базовой валюте с учётом курса на момент траты (снимок). */
  function expBase(e: Expense): number | null {
    return amountInBase(e, baseCurrency, rates)
  }

  // ---- entries of selected month (доходы + расходы) ----
  const monthEntries = useMemo(
    () =>
      expenses.filter((e) =>
        isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }),
      ),
    [expenses, monthStart, monthEnd],
  )

  // ---- filtered operations (search + type + category) ----
  const filtersActive =
    search.trim() !== '' || typeFilter !== 'all' || categoryFilter !== 'all'

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return monthEntries.filter((e) => {
      const type = e.type ?? 'expense'
      if (typeFilter !== 'all' && type !== typeFilter) return false
      if (categoryFilter !== 'all') {
        const key = e.categoryId ?? '__none__'
        if (key !== categoryFilter) return false
      }
      if (q) {
        const cat = e.categoryId ? categories.find((c) => c.id === e.categoryId) : null
        const haystack = `${e.note} ${cat?.name ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [monthEntries, categories, search, typeFilter, categoryFilter])

  function resetFilters() {
    setSearch('')
    setTypeFilter('all')
    setCategoryFilter('all')
  }

  // ---- month income / expense totals (base currency) ----
  const monthTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const e of monthEntries) {
      const v = expBase(e)
      if (v === null) continue
      if (e.type === 'income') income += v
      else expense += v
    }
    return { income, expense, balance: income - expense }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthEntries, rates, baseCurrency])

  // ---- per-category breakdown (base currency, ТОЛЬКО расходы) ----
  const breakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthEntries) {
      if (e.type === 'income') continue
      const v = expBase(e)
      if (v === null) continue
      const key = e.categoryId ?? '__none__'
      map.set(key, (map.get(key) ?? 0) + v)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthEntries, rates, baseCurrency])

  // ---- 6-month spending trend (base currency, ТОЛЬКО расходы) ----
  const trend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(month, 5 - i)))
    return months.map((m) => {
      const start = startOfMonth(m)
      const end = endOfMonth(m)
      let total = 0
      for (const e of expenses) {
        if (e.type === 'income') continue
        if (!isWithinInterval(parseISO(e.date), { start, end })) continue
        const v = expBase(e)
        if (v === null) continue
        total += v
      }
      return { date: m, total }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, month, rates, baseCurrency])

  const trendMax = useMemo(() => Math.max(0, ...trend.map((t) => t.total)), [trend])

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

  // Карточка «переключатель месяца + сводка». На мобильном рендерится ПЕРВОЙ
  // (пользователь сначала видит, за какой месяц смотрит), на десктопе — как
  // прежде, первой в правой колонке.
  const monthSummaryCard = (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <IconButton onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="prev">
          <ChevronLeft size={18} />
        </IconButton>
        <span className="text-sm font-medium capitalize">{format(month, 'LLLL yyyy', { locale })}</span>
        <IconButton onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="next">
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--text-2)]">{t('expenses.monthIncome')}</span>
          <span className="tnum text-sm font-medium" style={{ color: 'var(--success-text)' }}>
            + {formatMoney(monthTotals.income, baseCurrency)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--text-2)]">{t('expenses.monthTotal')}</span>
          <span className="tnum text-sm font-medium">{formatMoney(monthTotals.expense, baseCurrency)}</span>
        </div>
        <div
          className="flex items-baseline justify-between border-t pt-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm text-[var(--text-2)]">{t('expenses.monthBalance')}</span>
          <span
            className="tnum text-xl font-semibold"
            style={{ color: monthTotals.balance < 0 ? 'var(--danger-text)' : 'var(--success-text)' }}
          >
            {formatMoney(monthTotals.balance, baseCurrency)}
          </span>
        </div>
      </div>
      {!rates && (
        <p className="mt-2 text-xs" style={{ color: 'var(--warning-text)' }}>
          {t('expenses.ratesLoading')}
        </p>
      )}
    </Card>
  )

  return (
    <div>
      <PageHeader
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        action={
          // на мобильном добавление — через FAB, кнопку в шапке прячем.
          // Обёртка-span: у Button в базовых классах inline-flex, и утилита
          // hidden проигрывает ему по порядку CSS — прячем через родителя
          <span className="hidden sm:block">
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> {t('expenses.add')}
            </Button>
          </span>
        }
      />

      {/* Мобильный: месяц + сводка ПЕРВЫМИ, до списка операций */}
      <div className="mb-4 lg:hidden">{monthSummaryCard}</div>

      {/* Desktop: 2 columns (operations | summary/breakdown/trend/recurring/categories). Mobile: single column. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        {/* ---- Left column: operations list with search + filters ---- */}
        <div className="lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-2)]">{t('expenses.operations')}</h2>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                >
                  <X size={14} /> {t('expenses.resetFilters')}
                </button>
              )}
            </div>

            {/* Search + filters */}
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                />
                <input
                  type="search"
                  value={search}
                  placeholder={t('expenses.searchPlaceholder')}
                  onChange={(ev) => setSearch(ev.target.value)}
                  className="pl-9"
                />
              </div>
              {/* фильтры в одну строку и на мобильном — короткие подписи влезают */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={typeFilter}
                  onChange={(ev) => setTypeFilter(ev.target.value as 'all' | TxnType)}
                  aria-label={t('expenses.type')}
                >
                  <option value="all">{t('expenses.filterAll')}</option>
                  <option value="expense">{t('expenses.typeExpense')}</option>
                  <option value="income">{t('expenses.typeIncome')}</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(ev) => setCategoryFilter(ev.target.value)}
                  aria-label={t('expenses.category')}
                >
                  <option value="all">{t('expenses.filterAllCategories')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__none__">{t('expenses.noCategory')}</option>
                </select>
              </div>
            </div>

            {monthEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <span className="text-[var(--text-3)]">
                  <Wallet size={28} />
                </span>
                <p className="text-sm text-[var(--text-3)]">{vt('expenses.emptyList')}</p>
                <Button onClick={() => setEditing(null)}>
                  <Plus size={16} /> {t('expenses.add')}
                </Button>
                <p className="text-xs text-[var(--text-3)]">{t('expenses.emptyListCta')}</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <span className="text-[var(--text-3)]">
                  <Search size={24} />
                </span>
                <p className="text-sm text-[var(--text-3)]">{t('expenses.nothingFound')}</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {t('expenses.resetFilters')}
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredEntries.map((e) => {
                  const isIncome = e.type === 'income'
                  const cat = categoryById(e.categoryId)
                  const converted = e.currency !== baseCurrency ? expBase(e) : null
                  return (
                    <button
                      key={e.id}
                      onClick={() => setEditing(e)}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--bg-3)]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: isIncome ? 'var(--success)' : cat?.color ?? 'var(--text-3)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {isIncome
                            ? e.note || t('expenses.typeIncome')
                            : cat?.name ?? t('expenses.noCategory')}
                        </div>
                        <div className="truncate text-xs text-[var(--text-3)]">
                          {[isIncome ? '' : e.note, format(parseISO(e.date), 'dd.MM.yyyy')]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className="tnum text-sm font-medium"
                          style={isIncome ? { color: 'var(--success-text)' } : undefined}
                        >
                          {isIncome ? '+ ' : ''}
                          {formatMoney(e.amount, e.currency)}
                        </div>
                        {converted !== null && (
                          <div className="tnum text-xs text-[var(--text-3)]">
                            ({isIncome ? '+ ' : ''}
                            {formatMoney(converted, baseCurrency)})
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ---- Right column: summary, breakdown, trend, recurring, categories ---- */}
        <div className="space-y-4 lg:col-span-1">
          {/* Month switcher + summary — на мобильном эта карточка уже показана сверху */}
          <div className="hidden lg:block">{monthSummaryCard}</div>

          {/* Category breakdown */}
          {breakdown.size > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('expenses.breakdown')}</h2>
              {donutSegments.length > 0 && (
                <div className="mb-4 flex justify-center">
                  <Donut
                    segments={donutSegments}
                    centerTop={formatMoney(monthTotals.expense, baseCurrency)}
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
                    // бюджет хранится в budgetCurrency (у старых записей — базовая); для сравнения приводим к базовой
                    const budgetBase =
                      cat?.budget != null ? toBase(cat.budget, cat.budgetCurrency ?? baseCurrency) : null
                    const over = budgetBase !== null && spent > budgetBase
                    const pct =
                      budgetBase !== null && budgetBase > 0
                        ? Math.min(100, (spent / budgetBase) * 100)
                        : 0
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                            {name}
                          </span>
                          <span className="tnum font-medium">
                            {formatMoney(spent, baseCurrency)}
                            {cat?.budget != null && (
                              <span className="text-[var(--text-3)]">
                                {' '}
                                {t('expenses.spentOf')}{' '}
                                {budgetBase !== null
                                  ? formatMoney(budgetBase, baseCurrency)
                                  : formatMoney(cat.budget, cat.budgetCurrency ?? baseCurrency)}
                              </span>
                            )}
                          </span>
                        </div>
                        {/* без курса бюджет несравним с тратами — прогресс не показываем */}
                        {budgetBase !== null && (
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

          {/* 6-month trend */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('expenses.trend')}</h2>
            {trendMax <= 0 ? (
              <p className="py-1 text-sm text-[var(--text-3)]">{t('expenses.trendEmptyShort')}</p>
            ) : (
              <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
                {trend.map((bar) => {
                  // сюда попадаем только при trendMax > 0 (ветка тернарника выше)
                  const pct = (bar.total / trendMax) * 100
                  return (
                    <div key={bar.date.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="tnum text-[10px] font-medium text-[var(--text-2)]">
                        {bar.total > 0 ? formatMoney(Math.round(bar.total), baseCurrency) : ''}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${Math.max(pct, bar.total > 0 ? 4 : 0)}%`,
                            background: 'var(--accent)',
                          }}
                        />
                      </div>
                      <span className="truncate text-[10px] capitalize text-[var(--text-3)]">
                        {format(bar.date, 'LLL', { locale })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Recurring */}
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
              <Repeat size={16} /> {t('expenses.recurring')}
            </h2>
            <p className="mb-3 text-xs text-[var(--text-3)]">{t('expenses.recurringHint')}</p>
            {recurringExpenses.length === 0 ? (
              <Empty text={t('expenses.noRecurring')} />
            ) : (
              <div className="mb-3 space-y-1">
                {recurringExpenses.map((r) => {
                  const cat = categoryById(r.categoryId)
                  const isIncome = r.type === 'income'
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-1.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: isIncome ? 'var(--success)' : cat?.color ?? 'var(--text-3)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.label}</div>
                        <div className="truncate text-xs text-[var(--text-3)]">
                          {t('expenses.everyMonthDay', { count: r.dayOfMonth, ordinal: true })}
                          {r.endMonth &&
                            ` · ${t('expenses.until', {
                              month: `${r.endMonth.slice(5, 7)}.${r.endMonth.slice(0, 4)}`,
                            })}`}
                        </div>
                        {/* заметка — отдельной строкой: номер счёта нужен
                            целиком, в общей строке он бы обрезался первым */}
                        {r.note && (
                          <div className="truncate text-xs text-[var(--text-2)]">{r.note}</div>
                        )}
                      </div>
                      <span
                        className="tnum shrink-0 text-sm font-medium"
                        style={isIncome ? { color: 'var(--success-text)' } : undefined}
                      >
                        {isIncome ? '+ ' : ''}
                        {formatMoney(r.amount, r.currency)}
                      </span>
                      <IconButton danger big onClick={() => deleteRecurring(r.id)} aria-label={t('expenses.deleteRecurring')}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  )
                })}
              </div>
            )}
            <Button variant="subtle" onClick={() => setRecurringModal(true)}>
              <Plus size={16} /> {t('expenses.addRecurring')}
            </Button>
          </Card>

          {/* Отчёт по пометкам «для налоговой» */}
          <TaxReportCard />

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
                      <span className="tnum text-xs text-[var(--text-3)]">
                        {t('expenses.budget')}: {formatMoney(c.budget, c.budgetCurrency ?? baseCurrency)}
                      </span>
                    )}
                    <IconButton danger big onClick={() => deleteCategory(c.id)} aria-label={t('expenses.deleteCategory')}>
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
        </div>
      </div>

      {/* FAB «добавить операцию» — только мобильный; прячем, пока открыт любой bottom-sheet */}
      {!(editing !== undefined || catModal || recurringModal) && (
        <Fab label={t('expenses.add')} onClick={() => setEditing(null)} />
      )}

      <ExpenseModal editing={editing} onClose={() => setEditing(undefined)} />

      <CategoryModal open={catModal} onClose={() => setCatModal(false)} />

      <RecurringModal open={recurringModal} onClose={() => setRecurringModal(false)} />
    </div>
  )
}

