import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardPaste, Check, AlertTriangle } from 'lucide-react'
import { Button, Field, Modal } from '../../components/ui'
import { parseNotification, type ParsedTxn } from '../../lib/notificationParse'
import { formatMoney } from '../../services/rates'
import { useStore } from '../../store'

export interface ExpenseDraft {
  amount: string
  currency?: ParsedTxn['currency']
  type: ParsedTxn['type']
  note: string
}

/**
 * Импорт операции из текста банковского уведомления.
 *
 * Разбор — в lib/notificationParse (чистые функции, 31 тест). Здесь только
 * доставка текста и ПОКАЗ того, что удалось понять.
 *
 * Окно ничего не сохраняет само. Оно заполняет обычную форму операции, где
 * пользователь всё видит и правит перед сохранением. Причина в философии
 * самого парсера: молча создать трату с неверной суммой хуже, чем не создать
 * ничего — пропущенную запись человек заметит, а неверную далеко не всегда.
 */
export function ImportModal({
  open,
  onClose,
  onUse,
  initialText,
}: {
  open: boolean
  onClose: () => void
  onUse: (draft: ExpenseDraft) => void
  /** текст из системного «Поделиться» — окно открывается уже заполненным */
  initialText?: string
}) {
  const { t } = useTranslation()
  const baseCurrency = useStore((s) => s.data.settings.baseCurrency)
  const [text, setText] = useState('')
  const [pasteErr, setPasteErr] = useState<string | null>(null)

  // при каждом открытии — либо текст из «Поделиться», либо чистое поле:
  // прошлый разбор здесь только мешает
  useEffect(() => {
    if (open) {
      setText(initialText ?? '')
      setPasteErr(null)
    }
  }, [open, initialText])

  const parsed = useMemo(() => (text.trim() ? parseNotification(text) : null), [text])

  async function pasteFromClipboard() {
    setPasteErr(null)
    try {
      const v = await navigator.clipboard.readText()
      if (!v.trim()) {
        setPasteErr(t('expenses.importClipboardEmpty'))
        return
      }
      setText(v)
    } catch {
      // Чтение буфера требует разрешения и защищённого контекста; в WebView
      // и в вебе без https оно просто падает. Молчать нельзя — объясняем,
      // что можно вставить руками.
      setPasteErr(t('expenses.importClipboardDenied'))
    }
  }

  const typeLabel = (ty: ParsedTxn['type']) =>
    ty === 'income' ? t('expenses.typeIncome') : t('expenses.typeExpense')

  return (
    <Modal open={open} onClose={onClose} title={t('expenses.importTitle')}>
      <p className="mb-3 text-xs text-[var(--text-3)]">{t('expenses.importHint')}</p>

      <Field label={t('expenses.importText')}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={t('expenses.importPlaceholder')}
          className="w-full resize-y"
        />
      </Field>

      <div className="mb-3 flex items-center gap-2">
        <Button variant="subtle" onClick={() => void pasteFromClipboard()}>
          <ClipboardPaste size={15} /> {t('expenses.importPaste')}
        </Button>
        {pasteErr && (
          <span className="text-xs" style={{ color: 'var(--warning-text)' }}>
            {pasteErr}
          </span>
        )}
      </div>

      {/* Разбор показываем построчно: человек должен видеть, что именно
          приложение поняло, до того как это попадёт в форму. */}
      {text.trim() && !parsed && (
        <div
          className="mb-3 flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{
            color: 'var(--warning-text)',
            borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          }}
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{t('expenses.importNoAmount')}</span>
        </div>
      )}

      {parsed && (
        <div
          className="mb-3 rounded-lg border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
        >
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-3)]">{t('expenses.amount')}</dt>
              <dd className="tnum font-semibold">
                {formatMoney(parsed.amount, parsed.currency ?? baseCurrency)}
                {!parsed.currency && (
                  <span className="ml-1 text-xs font-normal text-[var(--text-3)]">
                    {t('expenses.importCurrencyGuess')}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-3)]">{t('expenses.type')}</dt>
              <dd className="font-medium">{typeLabel(parsed.type)}</dd>
            </div>
            {parsed.merchant && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-3)]">{t('expenses.importMerchant')}</dt>
                <dd className="min-w-0 truncate font-medium">{parsed.merchant}</dd>
              </div>
            )}
            {parsed.last4 && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-3)]">{t('expenses.importCard')}</dt>
                <dd className="tnum font-medium">•••• {parsed.last4}</dd>
              </div>
            )}
          </dl>

          {parsed.confidence !== 'high' && (
            <p className="mt-2 text-xs" style={{ color: 'var(--warning-text)' }}>
              {parsed.confidence === 'low'
                ? t('expenses.importLowConfidence')
                : t('expenses.importMediumConfidence')}
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('expenses.cancel')}
        </Button>
        <Button
          disabled={!parsed}
          onClick={() => {
            if (!parsed) return
            onUse({
              amount: String(parsed.amount),
              currency: parsed.currency ?? undefined,
              type: parsed.type,
              // магазин идёт в заметку: это единственное, что стоит перенести
              // как текст, и пользователь тут же может его поправить
              note: parsed.merchant ?? '',
            })
          }}
        >
          <Check size={15} /> {t('expenses.importUse')}
        </Button>
      </div>
    </Modal>
  )
}
