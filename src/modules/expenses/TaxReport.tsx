import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { FileSpreadsheet, Download, Share2, Check, AlertTriangle } from 'lucide-react'
import { Button, Card, Field } from '../../components/ui'
import { useStore } from '../../store'
import { buildTaxReport, taxReportToCsv } from '../../lib/taxReport'
import { amountInBase, formatMoney } from '../../services/rates'
import { shareTextFile } from '../../lib/shareFile'
import type { Expense } from '../../types'

/** Первое января текущего года — обычная граница отчётного периода. */
function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}
function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Отчёт по записям с пометкой «для налоговой»: суммы за период, разбивка по
 * категориям и месяцам, выгрузка CSV.
 *
 * Сумму налога к уплате здесь НЕ считают — приложение не знает местного
 * закона, а ошибка в такой цифре стоит дороже удобства. Отчёт отвечает на
 * вопрос «сколько прошло», решение принимает бухгалтер.
 */
export function TaxReportCard() {
  const { t } = useTranslation()
  const expenses = useStore((s) => s.data.expenses)
  const categories = useStore((s) => s.data.expenseCategories)
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const rates = useStore((s) => s.rates)

  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(todayStr)
  const [copied, setCopied] = useState(false)
  const native = Capacitor.isNativePlatform()
  const [saveErr, setSaveErr] = useState<'clipboard' | 'failed' | null>(null)

  const report = useMemo(
    () =>
      buildTaxReport(expenses, categories, from, to, (e: Expense) =>
        amountInBase(e, baseCurrency, rates),
      ),
    [expenses, categories, from, to, baseCurrency, rates],
  )

  // всего помеченных записей — чтобы отличить «нет пометок вообще» от
  // «в этом периоде пусто»
  const markedTotal = useMemo(() => expenses.filter((e) => e.taxRelevant).length, [expenses])

  function csv(): string {
    return taxReportToCsv(report, baseCurrency, {
      date: t('expenses.date'),
      type: t('expenses.type'),
      income: t('expenses.typeIncome'),
      expense: t('expenses.typeExpense'),
      category: t('expenses.category'),
      note: t('expenses.note'),
      amount: t('expenses.amount'),
      currency: t('expenses.currency'),
      inBase: t('expenses.taxInBase'),
    })
  }

  async function exportCsv() {
    setSaveErr(null)
    // В вебе — скачивание, на телефоне — системное «Поделиться» файлом
    // (WebView игнорирует <a download>). Логика в lib/shareFile.
    const res = await shareTextFile(`tax-${from}_${to}.csv`, csv(), {
      mime: 'text/csv',
      title: t('expenses.taxReportTitle'),
    })
    if (res.ok) {
      if (res.how === 'share') {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
      return
    }
    if (res.how === 'cancelled') return // пользователь сам закрыл диалог
    // Последний рубеж: отдать данные хоть как-то, а не оставить ни с чем
    try {
      await navigator.clipboard.writeText(csv())
      setSaveErr('clipboard')
    } catch {
      setSaveErr('failed')
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <FileSpreadsheet size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-base font-semibold">{t('expenses.taxReportTitle')}</h2>
      </div>
      <p className="mb-3 text-xs text-[var(--text-3)]">{t('expenses.taxReportHint')}</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('expenses.taxFrom')}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('expenses.taxTo')}>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {markedTotal === 0 ? (
        <p className="text-sm text-[var(--text-3)]">{t('expenses.taxNoneMarked')}</p>
      ) : report.rows.length === 0 ? (
        <p className="text-sm text-[var(--text-3)]">{t('expenses.taxEmptyPeriod')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
              <div className="text-[var(--text-3)]">{t('expenses.typeIncome')}</div>
              <div className="font-semibold tnum" style={{ color: 'var(--success-text)' }}>
                {formatMoney(report.income, baseCurrency)}
              </div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
              <div className="text-[var(--text-3)]">{t('expenses.typeExpense')}</div>
              <div className="font-semibold tnum">{formatMoney(report.expense, baseCurrency)}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
              <div className="text-[var(--text-3)]">{t('expenses.taxRecords')}</div>
              <div className="font-semibold tnum">{report.rows.length}</div>
            </div>
          </div>

          {/* Неконвертируемые записи не молчим: они есть в выгрузке, но их
              нет в итогах — иначе сумма выглядела бы полной, не будучи ею. */}
          {report.unconvertible > 0 && (
            <div
              className="mt-2 flex items-start gap-2 rounded-lg p-2 text-xs"
              style={{
                background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
                color: 'var(--warning-text)',
              }}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{t('expenses.taxUnconvertible', { count: report.unconvertible })}</span>
            </div>
          )}

          {report.byCategory.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs text-[var(--text-3)]">
                {t('expenses.taxByCategory')}
              </div>
              <ul className="space-y-1">
                {report.byCategory.map((g) => (
                  <li key={g.key || '__none__'} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {g.key || t('expenses.noCategory')}
                    </span>
                    {g.income > 0 && (
                      <span className="tnum shrink-0" style={{ color: 'var(--success-text)' }}>
                        +{formatMoney(g.income, baseCurrency)}
                      </span>
                    )}
                    {g.expense > 0 && (
                      <span className="tnum shrink-0">{formatMoney(g.expense, baseCurrency)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <Button variant="subtle" onClick={() => void exportCsv()}>
              {copied ? (
                <Check size={15} />
              ) : native ? (
                <Share2 size={15} />
              ) : (
                <Download size={15} />
              )}
              {copied
                ? t('expenses.taxShared')
                : native
                  ? t('expenses.taxShareCsv')
                  : t('expenses.taxDownloadCsv')}
            </Button>
            {saveErr && (
              <p className="mt-1 text-xs" style={{ color: 'var(--danger-text)' }}>
                {saveErr === 'clipboard' ? t('expenses.taxCopiedInstead') : t('expenses.taxCopyFailed')}
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
