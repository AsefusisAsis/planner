import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Share2,
  Pencil,
  Trash2,
  ShieldAlert,
  CreditCard,
  Lock,
  LockOpen,
  X,
} from 'lucide-react'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import {
  Button,
  Checkbox,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SegmentedControl,
} from '../../components/ui'
import { useBackCloser } from '../../lib/backclose'
import type { BankCard } from '../../types'
import { Barcode } from '../../components/Barcode'
import { CardVisual } from './CardVisual'
import { GRADIENTS, gradientCss, digitsOf, formatNumber, detectBrand } from './brand'
import {
  deriveKey,
  encryptStr,
  decryptStr,
  makeCheck,
  verifyKey,
  genSalt,
  setSessionKey,
  getSessionKey,
  PBKDF2_ITERATIONS,
  LEGACY_PBKDF2_ITERATIONS,
} from './crypto'

interface CardForm {
  label: string
  number: string
  holder: string
  expiry: string
  gradient: string
  note: string
  loyalty: boolean
  barcode: boolean
}

const emptyForm: CardForm = {
  label: '',
  number: '',
  holder: '',
  expiry: '',
  gradient: GRADIENTS[0].key,
  note: '',
  loyalty: false,
  barcode: true,
}

export default function CardsPage() {
  const { t } = useTranslation()
  const vt = useVoice()
  const cards = useStore((s) => s.data.cards)
  const cardSecurity = useStore((s) => s.data.cardSecurity)
  const addCard = useStore((s) => s.addCard)
  const updateCard = useStore((s) => s.updateCard)
  const deleteCard = useStore((s) => s.deleteCard)
  const setCards = useStore((s) => s.setCards)
  const setCardSecurity = useStore((s) => s.setCardSecurity)

  const [unlocked, setUnlocked] = useState<boolean>(() => !cardSecurity || getSessionKey() != null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [decrypted, setDecrypted] = useState<Record<string, string>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  /** активный раздел: банковские (loyalty!==true) или скидочные (loyalty===true) */
  const [section, setSection] = useState<'bank' | 'loyalty'>('bank')
  /** скидочная карта, открытая на весь экран (оверлей) */
  const [fullCardId, setFullCardId] = useState<string | null>(null)

  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CardForm>(emptyForm)

  const [pwMode, setPwMode] = useState<'setup' | 'unlock' | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  /** действие, ожидающее разблокировки */
  const [pending, setPending] = useState<(() => void) | null>(null)

  const locked = !!cardSecurity && !unlocked

  const visibleCards = useMemo(
    () => cards.filter((c) => (section === 'loyalty' ? c.loyalty === true : c.loyalty !== true)),
    [cards, section],
  )
  const fullCard = fullCardId ? cards.find((c) => c.id === fullCardId) ?? null : null

  // закрытие полноэкранного просмотра по Escape и по системной «назад» (Android)
  useBackCloser(!!fullCard, () => setFullCardId(null))
  useEffect(() => {
    if (!fullCard) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullCardId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullCard])

  // авто-блокировка: через 3 минуты после разблокировки снова прячем номера
  useEffect(() => {
    if (!cardSecurity || !unlocked) return
    const id = setTimeout(() => {
      setSessionKey(null)
      setUnlocked(false)
      setRevealed(new Set())
      setDecrypted({})
    }, 3 * 60 * 1000)
    return () => clearTimeout(id)
  }, [cardSecurity, unlocked])

  function openUnlock(after?: () => void) {
    setPw('')
    setPwErr(null)
    setPending(() => after ?? null)
    setPwMode('unlock')
  }

  // ---- получить цифры номера (расшифровать при необходимости) ----
  async function getDigits(card: BankCard): Promise<string | null> {
    if (!card.enc) return digitsOf(card.number)
    const key = getSessionKey()
    if (!key) return null
    if (decrypted[card.id]) return digitsOf(decrypted[card.id])
    const plain = await decryptStr(key, card.number)
    setDecrypted((d) => ({ ...d, [card.id]: plain }))
    return digitsOf(plain)
  }

  async function reveal(card: BankCard) {
    if (card.enc && locked) {
      openUnlock(() => reveal(card))
      return
    }
    if (card.enc && !decrypted[card.id]) {
      const key = getSessionKey()
      if (key) setDecrypted((d) => ({ ...d, [card.id]: '' })) // плейсхолдер до загрузки
      await getDigits(card)
    }
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(card.id)) next.delete(card.id)
      else next.add(card.id)
      return next
    })
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      /* недоступно */
    }
  }

  async function copyNumber(card: BankCard) {
    if (card.enc && locked) {
      openUnlock(() => copyNumber(card))
      return
    }
    const digits = await getDigits(card)
    if (digits) copy(digits, `num-${card.id}`)
  }

  async function share(card: BankCard) {
    if (card.enc && locked) {
      openUnlock(() => share(card))
      return
    }
    const digits = (await getDigits(card)) ?? ''
    const text = card.loyalty
      ? [card.label, card.number].filter(Boolean).join('\n')
      : `${card.label}\n${formatNumber(digits)}\n${card.holder}\n${card.expiry}`
    if (navigator.share) {
      try {
        await navigator.share({ title: card.label, text })
      } catch {
        /* отменено */
      }
    } else {
      copy(text, `share-${card.id}`)
    }
  }

  // ---- защита паролем ----
  async function setupLock() {
    if (pw.length < 8) {
      setPwErr(vt('cards.passwordTooShort'))
      return
    }
    if (pw !== pw2) {
      setPwErr(vt('cards.passwordMismatch'))
      return
    }
    const salt = genSalt()
    const key = await deriveKey(pw, salt, PBKDF2_ITERATIONS)
    const check = await makeCheck(key)
    const newCards = await Promise.all(
      cards.map(async (c) => {
        if (c.loyalty || c.enc) return c
        const d = digitsOf(c.number)
        return {
          ...c,
          number: await encryptStr(key, d),
          enc: true,
          last4: d.slice(-4),
          brand: detectBrand(d),
        }
      }),
    )
    setCards(newCards)
    setCardSecurity({ salt, check, iterations: PBKDF2_ITERATIONS })
    setSessionKey(key)
    setUnlocked(true)
    setPwMode(null)
    setPw('')
    setPw2('')
  }

  async function doUnlock() {
    if (!cardSecurity) return
    // старые записи без iterations зашифрованы на 150k — не ломаем совместимость
    const key = await deriveKey(pw, cardSecurity.salt, cardSecurity.iterations ?? LEGACY_PBKDF2_ITERATIONS)
    if (await verifyKey(key, cardSecurity.check)) {
      setSessionKey(key)
      setUnlocked(true)
      setPwMode(null)
      setPw('')
      const after = pending
      setPending(null)
      if (after) after()
    } else {
      setPwErr(t('cards.wrongPassword'))
    }
  }

  async function disableLock() {
    if (locked) {
      openUnlock(disableLock)
      return
    }
    const key = getSessionKey()
    if (!key) return
    const newCards = await Promise.all(
      cards.map(async (c): Promise<BankCard> => {
        if (!c.enc) return c
        const d = await decryptStr(key, c.number)
        return {
          id: c.id,
          label: c.label,
          number: d,
          holder: c.holder,
          expiry: c.expiry,
          gradient: c.gradient,
          createdAt: c.createdAt,
          note: c.note,
          loyalty: c.loyalty,
        }
      }),
    )
    setCards(newCards)
    setCardSecurity(null)
    setSessionKey(null)
    setDecrypted({})
  }

  // ---- форма ----
  function openAdd() {
    if (cardSecurity && locked) {
      openUnlock(openAdd)
      return
    }
    // тип новой карты определяется активным разделом (в модалке можно переключить)
    setForm({ ...emptyForm, loyalty: section === 'loyalty' })
    setEditingId(null)
    setModal(true)
  }

  async function openEdit(c: BankCard) {
    if (c.enc && locked) {
      openUnlock(() => openEdit(c))
      return
    }
    const num = c.enc ? formatNumber((await getDigits(c)) ?? '') : formatNumber(c.number)
    setForm({
      label: c.label,
      number: c.loyalty ? c.number : num,
      holder: c.holder,
      expiry: c.expiry,
      gradient: c.gradient,
      note: c.note ?? '',
      loyalty: !!c.loyalty,
      barcode: c.barcode !== false,
    })
    setEditingId(c.id)
    setModal(true)
  }

  const digits = digitsOf(form.number)
  // для скидочной код штрихкода необязателен; для платёжной — 12–19 цифр
  const numberValid = form.loyalty ? true : digits.length >= 12 && digits.length <= 19

  async function save() {
    if (!numberValid) return
    const base = {
      label: form.label.trim() || t('cards.title'),
      gradient: form.gradient,
      note: form.note.trim() || undefined,
    }
    let payload: Omit<BankCard, 'id' | 'createdAt'>
    if (form.loyalty) {
      payload = {
        ...base,
        number: form.number.trim(),
        holder: '',
        expiry: '',
        loyalty: true,
        barcode: form.barcode,
      }
    } else if (cardSecurity) {
      const key = getSessionKey()
      if (!key) {
        openUnlock(save)
        return
      }
      payload = {
        ...base,
        number: await encryptStr(key, digits),
        holder: form.holder.trim().toUpperCase(),
        expiry: form.expiry.trim(),
        enc: true,
        last4: digits.slice(-4),
        brand: detectBrand(digits),
      }
    } else {
      payload = {
        ...base,
        number: digits,
        holder: form.holder.trim().toUpperCase(),
        expiry: form.expiry.trim(),
      }
    }
    if (editingId) {
      // при редактировании очищаем возможные старые enc-поля, если стало не enc
      updateCard(editingId, { enc: undefined, last4: undefined, brand: undefined, ...payload })
      setDecrypted((d) => {
        const n = { ...d }
        delete n[editingId]
        return n
      })
      setRevealed((s) => {
        const n = new Set(s)
        n.delete(editingId)
        return n
      })
    } else {
      addCard(payload)
    }
    setModal(false)
  }

  function onNumberChange(v: string) {
    if (form.loyalty) {
      setForm((f) => ({ ...f, number: v.replace(/[^\w]/g, '').slice(0, 48) }))
      return
    }
    const d = digitsOf(v).slice(0, 19)
    setForm((f) => ({ ...f, number: formatNumber(d) }))
  }
  function onExpiryChange(v: string) {
    const d = digitsOf(v).slice(0, 4)
    setForm((f) => ({ ...f, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }))
  }

  const copyBtn = (text: string, key: string, label: string) => (
    <button
      onClick={() => copy(text, key)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-3)]"
      style={{ color: copiedKey === key ? 'var(--success)' : 'var(--text-2)' }}
    >
      {copiedKey === key ? <Check size={14} /> : <Copy size={14} />}
      {copiedKey === key ? t('cards.copied') : label}
    </button>
  )

  return (
    <div>
      <PageHeader
        title={t('cards.title')}
        subtitle={t('cards.subtitle')}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> {t('cards.add')}
          </Button>
        }
      />

      {/* Защита */}
      <div
        className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
        style={{
          background: cardSecurity
            ? 'color-mix(in srgb, var(--success) 10%, transparent)'
            : 'color-mix(in srgb, var(--warning) 10%, transparent)',
          borderColor: cardSecurity
            ? 'color-mix(in srgb, var(--success) 40%, transparent)'
            : 'color-mix(in srgb, var(--warning) 40%, transparent)',
          color: 'var(--text-2)',
        }}
      >
        {cardSecurity ? (
          <Lock size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
        ) : (
          <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
        )}
        <div className="flex-1">
          <p className="mb-2">{cardSecurity ? t('cards.securedOn') : t('cards.securedOff')}</p>
          <div className="flex flex-wrap gap-2">
            {!cardSecurity && (
              <Button
                variant="subtle"
                onClick={() => {
                  setPw('')
                  setPw2('')
                  setPwErr(null)
                  setPwMode('setup')
                }}
              >
                <Lock size={14} /> {t('cards.protect')}
              </Button>
            )}
            {cardSecurity && locked && (
              <Button variant="subtle" onClick={() => openUnlock()}>
                <LockOpen size={14} /> {t('cards.unlock')}
              </Button>
            )}
            {cardSecurity && !locked && (
              <Button variant="ghost" onClick={disableLock}>
                {t('cards.disableProtect')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Разделы: банковские / скидочные */}
      <SegmentedControl
        className="mb-4 sm:inline-grid"
        value={section}
        onChange={setSection}
        options={[
          { value: 'bank', label: t('cards.sectionBank') },
          { value: 'loyalty', label: t('cards.sectionLoyalty') },
        ]}
      />

      {visibleCards.length === 0 ? (
        <Empty
          icon={<CreditCard size={28} />}
          text={section === 'loyalty' ? t('cards.emptyLoyalty') : t('cards.emptyBank')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleCards.map((c) => (
            <div key={c.id}>
              {c.loyalty ? (
                <button
                  type="button"
                  onClick={() => setFullCardId(c.id)}
                  className="block w-full text-left transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-2xl"
                  aria-label={c.label}
                >
                  <CardVisual card={c} revealed={revealed.has(c.id)} decrypted={decrypted[c.id]} />
                </button>
              ) : (
                <CardVisual card={c} revealed={revealed.has(c.id)} decrypted={decrypted[c.id]} />
              )}
              {c.note && <p className="mt-1.5 px-1 text-xs text-[var(--text-3)]">{c.note}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {!c.loyalty && (
                  <button
                    onClick={() => copyNumber(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-3)]"
                    style={{ color: copiedKey === `num-${c.id}` ? 'var(--success)' : 'var(--text-2)' }}
                  >
                    {copiedKey === `num-${c.id}` ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === `num-${c.id}` ? t('cards.copied') : t('cards.copyNumber')}
                  </button>
                )}
                {c.loyalty && c.number.trim() && copyBtn(c.number, `code-${c.id}`, t('cards.copyNumber'))}
                {!c.loyalty && copyBtn(c.holder, `hold-${c.id}`, t('cards.copyHolder'))}
                {!c.loyalty && copyBtn(c.expiry, `exp-${c.id}`, t('cards.copyExpiry'))}
                <div className="ml-auto flex items-center">
                  {!c.loyalty && (
                    <IconButton
                      onClick={() => reveal(c)}
                      aria-label={revealed.has(c.id) ? t('cards.hide') : t('cards.reveal')}
                    >
                      {revealed.has(c.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  )}
                  <IconButton onClick={() => share(c)} aria-label={t('cards.share')}>
                    <Share2 size={15} />
                  </IconButton>
                  <IconButton onClick={() => openEdit(c)} aria-label={t('cards.save')}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton danger big onClick={() => deleteCard(c.id)} aria-label={t('cards.delete')}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка добавления/редактирования */}
      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? t('cards.editTitle') : t('cards.newTitle')}>
        {/* тип карты */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { v: false, label: t('cards.typePayment') },
            { v: true, label: t('cards.typeLoyalty') },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setForm((f) => ({ ...f, loyalty: o.v, number: '' }))}
              className="rounded-lg border px-3 py-2 text-sm transition-colors"
              style={{
                borderColor: form.loyalty === o.v ? 'var(--accent)' : 'var(--border)',
                background: form.loyalty === o.v ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                color: form.loyalty === o.v ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <CardVisual
            card={{
              id: 'preview',
              label: form.label || t('cards.label'),
              number: form.number,
              holder: form.holder,
              expiry: form.expiry || 'MM/YY',
              gradient: form.gradient,
              createdAt: '',
              loyalty: form.loyalty,
            }}
            revealed
          />
        </div>

        <Field label={t('cards.label')}>
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder={t('cards.labelPlaceholder')}
          />
        </Field>
        <Field label={form.loyalty ? t('cards.loyaltyNumber') : t('cards.number')}>
          <input
            value={form.number}
            onChange={(e) => onNumberChange(e.target.value)}
            inputMode={form.loyalty ? 'text' : 'numeric'}
            placeholder={form.loyalty ? '2000000000001' : '0000 0000 0000 0000'}
          />
        </Field>
        {form.loyalty && (
          <div className="mb-3 -mt-1 flex items-center gap-2 text-sm text-[var(--text-2)]">
            <Checkbox
              checked={form.barcode}
              onChange={(v) => setForm((f) => ({ ...f, barcode: v }))}
              label={t('cards.withBarcode')}
            />
            <span>{t('cards.withBarcode')}</span>
          </div>
        )}
        {!form.loyalty && form.number && !numberValid && (
          <p className="mb-3 -mt-2 text-xs" style={{ color: 'var(--danger)' }}>
            {t('cards.numberInvalid')}
          </p>
        )}
        {!form.loyalty && (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('cards.holder')}>
              <input
                value={form.holder}
                onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
                placeholder={t('cards.holderPlaceholder')}
              />
            </Field>
            <Field label={t('cards.expiry')}>
              <input
                value={form.expiry}
                onChange={(e) => onExpiryChange(e.target.value)}
                inputMode="numeric"
                placeholder="MM/YY"
              />
            </Field>
          </div>
        )}

        <Field label={t('cards.note')}>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder={t('cards.notePlaceholder')}
          />
        </Field>

        <Field label={t('cards.gradient')}>
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g.key}
                onClick={() => setForm((f) => ({ ...f, gradient: g.key }))}
                className="h-8 w-8 rounded-lg"
                style={{
                  background: gradientCss(g.key),
                  outline: form.gradient === g.key ? '2px solid var(--text)' : 'none',
                  outlineOffset: 2,
                }}
                aria-label={g.key}
              />
            ))}
          </div>
        </Field>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={!numberValid}>
            {t('cards.save')}
          </Button>
        </div>
      </Modal>

      {/* Модалка пароля */}
      <Modal
        open={pwMode !== null}
        onClose={() => setPwMode(null)}
        title={pwMode === 'setup' ? t('cards.setupTitle') : t('cards.unlockTitle')}
      >
        <p className="mb-3 text-xs text-[var(--text-3)]">{t('cards.lockWarn')}</p>
        <Field label={t('cards.password')}>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pwMode === 'unlock' && doUnlock()}
          />
        </Field>
        {pwMode === 'setup' && (
          <Field label={t('cards.passwordRepeat')}>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
        )}
        {pwErr && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{pwErr}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPwMode(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={pwMode === 'setup' ? setupLock : doUnlock} disabled={!pw}>
            {pwMode === 'setup' ? t('cards.enable') : t('cards.unlock')}
          </Button>
        </div>
      </Modal>

      {/* Полноэкранный просмотр скидочной карты (для сканирования) */}
      {fullCard && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-5"
          onClick={() => setFullCardId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={fullCard.label}
        >
          <button
            onClick={() => setFullCardId(null)}
            aria-label={t('cards.close')}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <X size={22} />
          </button>

          <div
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative w-full overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
              style={{ background: gradientCss(fullCard.gradient), aspectRatio: '1.586 / 1' }}
            >
              <span className="block max-w-full truncate text-lg font-semibold text-white/95">
                {fullCard.label}
              </span>
              {!fullCard.number.trim() && (
                <div className="mt-6 text-sm text-white/70">{t('cards.noCode')}</div>
              )}
            </div>

            {fullCard.number.trim() ? (
              fullCard.barcode !== false ? (
                <div className="mt-5 rounded-2xl bg-white p-5 shadow-xl">
                  <Barcode value={fullCard.number} height={120} />
                  <div className="mt-3 text-center font-mono text-2xl font-semibold tracking-[0.2em] text-black">
                    {fullCard.number}
                  </div>
                  <p className="mt-2 text-center text-xs text-black/50">{t('cards.tapToScan')}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-white p-6 shadow-xl">
                  <div className="text-center font-mono text-3xl font-bold tracking-[0.15em] text-black">
                    {fullCard.number}
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
