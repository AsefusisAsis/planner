import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet } from 'lucide-react'
import { useStore } from '../../store'
import { Button, CollapsibleCard } from '../../components/ui'
import { CurrencySelect } from '../../components/CurrencySelect'
import { todayISO } from '../../lib/id'
import { amountInBase, formatMoney } from '../../services/rates'
import { MAX_TICKER_CURRENCIES, type Currency } from '../../types'

/**
 * Финансы за месяц + быстрый ввод операции.
 *
 * Состояние формы (тип, сумма, валюта, категория) живёт здесь, а не на
 * странице: наружу оно не нужно никому.
 */
export function FinanceWidget() {
  const { t } = useTranslation()
  const expenses = useStore((s) => s.data.expenses)
  const expenseCategories = useStore((s) => s.data.expenseCategories)
  const settings = useStore((s) => s.data.settings)
  const rates = useStore((s) => s.rates)
  const addExpense = useStore((s) => s.addExpense)
  const base = settings.baseCurrency
  const today = todayISO()
  const monthPrefix = today.slice(0, 7)

  // валюты для быстрого выбора: те же, что в тикере курсов
  const tickerCurrencies: Currency[] = (
    settings.displayCurrencies?.length ? settings.displayCurrencies : (['USD', 'EUR', 'RUB'] as Currency[])
  )
    .filter((c) => c !== base)
    .slice(0, MAX_TICKER_CURRENCIES)

  const money = useMemo(() => {
    let income = 0
    let spending = 0
    for (const e of expenses) {
      if (!e.date.startsWith(monthPrefix)) continue
      const v = amountInBase(e, base, rates)
      if (v == null) continue
      if (e.type === 'income') income += v
      else spending += v
    }
    return { income, spending, balance: income - spending }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, rates, base, monthPrefix])

  const [qaType, setQaType] = useState<'expense' | 'income'>('expense')
  const [qaAmount, setQaAmount] = useState('')
  const [qaCur, setQaCur] = useState<Currency>(base)
  const [qaCat, setQaCat] = useState<string | null>(null)

  // Категории для быстрых чипов: самые ходовые по последним тратам. Раньше
  // быстрый ввод всегда клал categoryId: null, и запись потом приходилось
  // доредактировать в Финансах — ради этого её и вводили быстро.
  const qaCategories = useMemo(() => {
    const used = new Map<string, number>()
    for (const e of expenses) {
      if (!e.categoryId) continue
      used.set(e.categoryId, (used.get(e.categoryId) ?? 0) + 1)
    }
    const ranked = [...expenseCategories].sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0))
    return ranked.slice(0, 5)
  }, [expenses, expenseCategories])

  function quickAddMoney() {
    const a = Number(qaAmount)
    if (!Number.isFinite(a) || a <= 0) return
    addExpense({ amount: a, currency: qaCur, categoryId: qaCat, note: '', date: today, type: qaType })
    // категорию НЕ сбрасываем: подряд обычно вносят однотипные траты
    setQaAmount('')
  }

  return (
    <CollapsibleCard
      id="finance"
      icon={<Wallet size={16} style={{ color: 'var(--accent)' }} />}
      title={t('dashboard.wFinance')}
      summary={
        <span
          className="text-sm font-semibold tnum"
          style={{ color: money.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
        >
          {formatMoney(money.balance, base)}
        </span>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
          <div className="text-[var(--text-3)]">{t('dashboard.income')}</div>
          <div className="font-semibold tnum" style={{ color: 'var(--success)' }}>{formatMoney(money.income, base)}</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
          <div className="text-[var(--text-3)]">{t('dashboard.spending')}</div>
          <div className="font-semibold tnum">{formatMoney(money.spending, base)}</div>
        </div>
      </div>
      {!rates && (
        <p className="mb-2 text-[11px]" style={{ color: 'var(--warning)' }}>
          {t('dashboard.ratesMissing')}
        </p>
      )}
      {/* зоны нажатия ≥40px: тип операции, сумма, валюта, добавить.
          Порядок кнопок = порядку сводки выше (Доходы | Расходы),
          иначе пользователи путались; по умолчанию выбран Расход */}
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {(['income', 'expense'] as const).map((tp) => (
          <button
            key={tp}
            onClick={() => setQaType(tp)}
            className="min-h-10 rounded-lg py-2 text-sm font-medium transition active:scale-[.97]"
            style={qaType === tp ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { background: 'var(--bg-3)', color: 'var(--text-2)' }}
          >
            {tp === 'expense' ? t('expenses.typeExpense') : t('expenses.typeIncome')}
          </button>
        ))}
      </div>
      {/* быстрые категории: до пяти самых ходовых + «без категории» */}
      {qaCategories.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[null, ...qaCategories.map((c) => c.id)].map((id) => {
            const cat = id ? qaCategories.find((c) => c.id === id) : null
            const on = qaCat === id
            return (
              <button
                key={id ?? 'none'}
                type="button"
                onClick={() => setQaCat(id)}
                aria-pressed={on}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
                style={{
                  borderColor: on ? 'var(--accent)' : 'var(--border)',
                  background: on ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {cat && <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat.color }} />}
                {cat ? cat.name : t('dashboard.qaNoCategory')}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={qaAmount}
          onChange={(e) => setQaAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAddMoney()}
          placeholder={t('dashboard.qaAmount')}
          className="min-h-11 min-w-0 flex-1"
        />
        <div className="w-24 shrink-0">
          <CurrencySelect
            value={qaCur}
            onChange={setQaCur}
            preferred={tickerCurrencies.length ? [base, ...tickerCurrencies] : undefined}
          />
        </div>
        <Button
          onClick={quickAddMoney}
          disabled={!qaAmount}
          aria-label={t('common.add')}
          className="min-h-11 min-w-11 shrink-0"
        >
          <Plus size={18} />
        </Button>
      </div>
    </CollapsibleCard>
  )
}
