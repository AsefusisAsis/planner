import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Coins, Copy, Check, QrCode as QrIcon, Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react'
import { Button, Card, Field, IconButton, Modal, Empty } from '../../components/ui'
import { QrCode } from '../../components/QrCode'
import { useStore } from '../../store'
import {
  CRYPTO_NETWORKS,
  NETWORK_LABEL,
  NETWORKS_FOR_COIN,
  checkAddress,
  shortAddress,
} from '../../lib/cryptoAddress'
import { CRYPTO_CURRENCIES, CURRENCY_SYMBOLS } from '../../types'
import type { CryptoAddress, CryptoCurrency, CryptoNetwork } from '../../types'

interface Draft {
  id: string | null
  label: string
  currency: CryptoCurrency
  network: CryptoNetwork
  address: string
  note: string
}

const EMPTY: Draft = {
  id: null,
  label: '',
  currency: 'USDT',
  network: 'TRON',
  address: '',
  note: '',
}

const coinLabel = (c: CryptoCurrency) =>
  CURRENCY_SYMBOLS[c] === c ? c : `${c} ${CURRENCY_SYMBOLS[c]}`

/**
 * Криптоадреса — справочник «куда мне присылать монеты». Баланса нет
 * намеренно: он потребовал бы своего API на каждую сеть.
 *
 * Главная задача экрана — не дать перепутать сеть. Один и тот же USDT в
 * TRC20, ERC20 и BEP20 это разные адреса, и перевод не в ту сеть уходит
 * безвозвратно, поэтому сеть показывается всегда и рядом с адресом, а формат
 * сверяется с выбранной сетью прямо при вводе.
 */
export function CryptoAddresses() {
  const { t } = useTranslation()
  const list = useStore((s) => s.data.cryptoAddresses)
  const addCryptoAddress = useStore((s) => s.addCryptoAddress)
  const updateCryptoAddress = useStore((s) => s.updateCryptoAddress)
  const deleteCryptoAddress = useStore((s) => s.deleteCryptoAddress)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [qrFor, setQrFor] = useState<CryptoAddress | null>(null)

  const check = useMemo(
    () => (draft ? checkAddress(draft.address, draft.network) : null),
    [draft],
  )

  async function copy(a: CryptoAddress) {
    try {
      await navigator.clipboard.writeText(a.address)
      setCopied(a.id)
      setTimeout(() => setCopied((k) => (k === a.id ? null : k)), 1500)
    } catch {
      /* недоступно */
    }
  }

  function openNew() {
    setDraft({ ...EMPTY })
  }
  function openEdit(a: CryptoAddress) {
    setDraft({
      id: a.id,
      label: a.label,
      currency: a.currency,
      network: a.network,
      address: a.address,
      note: a.note ?? '',
    })
  }

  function save() {
    if (!draft) return
    const rec = {
      label: draft.label.trim() || coinLabel(draft.currency),
      currency: draft.currency,
      network: draft.network,
      address: draft.address.trim(),
      note: draft.note.trim() || undefined,
    }
    if (!rec.address) return
    if (draft.id) updateCryptoAddress(draft.id, rec)
    else addCryptoAddress(rec)
    setDraft(null)
  }

  // сети, типичные для выбранной монеты — их показываем первыми
  const suggested = draft ? (NETWORKS_FOR_COIN[draft.currency] ?? []) : []
  const restNetworks = CRYPTO_NETWORKS.filter((n) => !suggested.includes(n))

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Coins size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold">{t('cards.cryptoTitle')}</h2>
          <div className="ml-auto">
            <Button variant="subtle" onClick={openNew}>
              <Plus size={15} />
              {t('cards.cryptoAdd')}
            </Button>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty icon={<Coins size={22} />} text={t('cards.cryptoEmpty')} />
        ) : (
          <ul className="space-y-2">
            {list.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border p-3"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{a.label}</span>
                      {/* сеть рядом с названием: именно её путают */}
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                        style={{
                          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                          color: 'var(--accent)',
                        }}
                      >
                        {a.currency} · {NETWORK_LABEL[a.network]}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-[var(--text-2)]">
                      {shortAddress(a.address, 10)}
                    </div>
                    {a.note && (
                      <div className="mt-1 text-xs text-[var(--text-3)]">{a.note}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton aria-label={t('cards.cryptoCopy')} onClick={() => copy(a)}>
                      {copied === a.id ? <Check size={15} /> : <Copy size={15} />}
                    </IconButton>
                    <IconButton aria-label={t('cards.cryptoQr')} onClick={() => setQrFor(a)}>
                      <QrIcon size={15} />
                    </IconButton>
                    <IconButton aria-label={t('cards.cryptoEdit')} onClick={() => openEdit(a)}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      aria-label={t('cards.cryptoDelete')}
                      danger
                      onClick={() => deleteCryptoAddress(a.id)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[11px] text-[var(--text-3)]">{t('cards.cryptoPublicHint')}</p>
      </Card>

      {/* QR для получения */}
      <Modal open={!!qrFor} onClose={() => setQrFor(null)} title={qrFor?.label ?? ''}>
        {qrFor && (
          <div className="flex flex-col items-center gap-3">
            <QrCode value={qrFor.address} size={220} />
            <div
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{
                background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {qrFor.currency} · {NETWORK_LABEL[qrFor.network]}
            </div>
            <div className="w-full break-all text-center font-mono text-xs text-[var(--text-2)]">
              {qrFor.address}
            </div>
            {/* напоминание держим и здесь: QR показывают отправителю
                именно в этот момент */}
            <p className="text-center text-[11px] text-[var(--text-3)]">
              {t('cards.cryptoNetworkWarn')}
            </p>
            <Button variant="subtle" onClick={() => copy(qrFor)}>
              <Copy size={15} />
              {t('cards.cryptoCopy')}
            </Button>
          </div>
        )}
      </Modal>

      {/* Форма адреса */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('cards.cryptoEdit') : t('cards.cryptoAdd')}
      >
        {draft && (
          <>
            <Field label={t('cards.cryptoLabel')}>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder={t('cards.cryptoLabelPlaceholder')}
                maxLength={40}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('cards.cryptoCoin')}>
                <select
                  value={draft.currency}
                  onChange={(e) => {
                    const currency = e.target.value as CryptoCurrency
                    // подставляем типичную сеть монеты: у BTC она одна, а у
                    // USDT первой идёт TRC20 — самый ходовой канал
                    const nets = NETWORKS_FOR_COIN[currency] ?? []
                    setDraft({ ...draft, currency, network: nets[0] ?? draft.network })
                  }}
                >
                  {CRYPTO_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {coinLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('cards.cryptoNetwork')} required>
                <select
                  value={draft.network}
                  onChange={(e) =>
                    setDraft({ ...draft, network: e.target.value as CryptoNetwork })
                  }
                >
                  {suggested.length > 0 && (
                    <optgroup label={t('cards.cryptoNetworkUsual')}>
                      {suggested.map((n) => (
                        <option key={n} value={n}>
                          {NETWORK_LABEL[n]}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={t('cards.cryptoNetworkOther')}>
                    {restNetworks.map((n) => (
                      <option key={n} value={n}>
                        {n === 'OTHER' ? t('cards.cryptoNetworkCustom') : NETWORK_LABEL[n]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
            </div>

            <Field label={t('cards.cryptoAddress')} required hint={t('cards.cryptoNetworkWarn')}>
              <input
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder={t('cards.cryptoAddressPlaceholder')}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                className="font-mono text-sm"
              />
            </Field>

            {/* Главная защита: формат уверенно принадлежит другой сети.
                Не блокируем сохранение — форматы меняются, и запретить
                валидный адрес хуже, чем предупредить. */}
            {check?.status === 'mismatch' && (
              <div
                className="mb-3 flex items-start gap-2 rounded-lg p-2.5 text-xs"
                style={{
                  background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  color: 'var(--danger-text)',
                }}
                role="alert"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  {t('cards.cryptoMismatch', {
                    looks: t('cards.cryptoFamily_' + check.looksLike),
                    chosen: NETWORK_LABEL[draft.network],
                  })}
                </span>
              </div>
            )}
            {check?.status === 'ok' && (
              <div
                className="mb-3 flex items-center gap-2 text-xs"
                style={{ color: 'var(--success-text)' }}
              >
                <Check size={14} />
                {t('cards.cryptoMatch', { network: NETWORK_LABEL[draft.network] })}
              </div>
            )}

            <Field label={t('cards.cryptoNote')}>
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                maxLength={80}
              />
            </Field>

            {/* НЕ fullWidth: у Button это w-100% контейнера, и две такие в
                одном ряду дают двойную ширину — модалку уносит вбок вместе с
                формой. Нужен flex-1: делят строку поровну. */}
            <div className="mt-4 flex gap-2">
              <Button variant="subtle" className="min-w-0 flex-1" onClick={() => setDraft(null)}>
                {t('common.cancel')}
              </Button>
              <Button className="min-w-0 flex-1" onClick={save} disabled={!draft.address.trim()}>
                {t('common.save')}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
