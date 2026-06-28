import { useState } from 'react'
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
} from 'lucide-react'
import { useStore } from '../../store'
import { Button, Empty, Field, IconButton, Modal, PageHeader } from '../../components/ui'
import type { BankCard } from '../../types'
import { CardVisual } from './CardVisual'
import { GRADIENTS, gradientCss, digitsOf, formatNumber } from './brand'

interface CardForm {
  label: string
  number: string
  holder: string
  expiry: string
  gradient: string
}

const emptyForm: CardForm = {
  label: '',
  number: '',
  holder: '',
  expiry: '',
  gradient: GRADIENTS[0].key,
}

export default function CardsPage() {
  const { t } = useTranslation()
  const cards = useStore((s) => s.data.cards)
  const addCard = useStore((s) => s.addCard)
  const updateCard = useStore((s) => s.updateCard)
  const deleteCard = useStore((s) => s.deleteCard)

  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CardForm>(emptyForm)

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      /* clipboard недоступен */
    }
  }

  async function share(card: BankCard) {
    const text = `${card.label}\n${formatNumber(card.number)}\n${card.holder}\n${card.expiry}`
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

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setModal(true)
  }
  function openEdit(c: BankCard) {
    setForm({
      label: c.label,
      number: formatNumber(c.number),
      holder: c.holder,
      expiry: c.expiry,
      gradient: c.gradient,
    })
    setEditingId(c.id)
    setModal(true)
  }

  const digits = digitsOf(form.number)
  const numberValid = digits.length >= 12 && digits.length <= 19

  function save() {
    if (!numberValid) return
    const payload = {
      label: form.label.trim() || t('cards.title'),
      number: digits,
      holder: form.holder.trim().toUpperCase(),
      expiry: form.expiry.trim(),
      gradient: form.gradient,
    }
    if (editingId) updateCard(editingId, payload)
    else addCard(payload)
    setModal(false)
  }

  function onNumberChange(v: string) {
    const d = digitsOf(v).slice(0, 19)
    setForm((f) => ({ ...f, number: formatNumber(d) }))
  }
  function onExpiryChange(v: string) {
    const d = digitsOf(v).slice(0, 4)
    const out = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
    setForm((f) => ({ ...f, expiry: out }))
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

      <div
        className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
        style={{
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
          color: 'var(--text-2)',
        }}
      >
        <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
        <span>{t('cards.security')}</span>
      </div>

      {cards.length === 0 ? (
        <Empty icon={<CreditCard size={28} />} text={t('cards.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id}>
              <CardVisual card={c} revealed={revealed.has(c.id)} />
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {copyBtn(digitsOf(c.number), `num-${c.id}`, t('cards.copyNumber'))}
                {copyBtn(c.holder, `hold-${c.id}`, t('cards.copyHolder'))}
                {copyBtn(c.expiry, `exp-${c.id}`, t('cards.copyExpiry'))}
                <div className="ml-auto flex items-center">
                  <IconButton
                    onClick={() => toggleReveal(c.id)}
                    aria-label={revealed.has(c.id) ? t('cards.hide') : t('cards.reveal')}
                  >
                    {revealed.has(c.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconButton>
                  <IconButton onClick={() => share(c)} aria-label={t('cards.share')}>
                    <Share2 size={15} />
                  </IconButton>
                  <IconButton onClick={() => openEdit(c)} aria-label={t('cards.save')}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      if (window.confirm(t('cards.deleteConfirm'))) deleteCard(c.id)
                    }}
                    aria-label={t('cards.delete')}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? t('cards.editTitle') : t('cards.newTitle')}>
        {/* живое превью */}
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
        <Field label={t('cards.number')}>
          <input
            value={form.number}
            onChange={(e) => onNumberChange(e.target.value)}
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
          />
        </Field>
        {form.number && !numberValid && (
          <p className="mb-3 -mt-2 text-xs" style={{ color: 'var(--danger)' }}>
            {t('cards.numberInvalid')}
          </p>
        )}
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

        <Field label={t('cards.gradient')}>
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g.key}
                onClick={() => setForm((f) => ({ ...f, gradient: g.key }))}
                className="h-8 w-8 rounded-lg transition-transform"
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
    </div>
  )
}
