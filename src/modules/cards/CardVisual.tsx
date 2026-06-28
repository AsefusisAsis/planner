import type { BankCard } from '../../types'
import { Barcode } from '../../components/Barcode'
import {
  detectBrand,
  formatNumber,
  maskNumber,
  gradientCss,
  BRAND_NAME,
  digitsOf,
  type Brand,
} from './brand'

function BrandMark({ brand }: { brand: Brand }) {
  if (brand === 'mastercard') {
    return (
      <svg width="44" height="28" viewBox="0 0 44 28" aria-label="Mastercard">
        <circle cx="17" cy="14" r="10" fill="#eb001b" />
        <circle cx="27" cy="14" r="10" fill="#f79e1b" fillOpacity="0.9" />
      </svg>
    )
  }
  if (brand === 'visa') {
    return (
      <span className="text-lg font-bold italic tracking-wider text-white" style={{ fontFamily: 'Georgia, serif' }}>
        VISA
      </span>
    )
  }
  if (brand === 'mir') {
    return (
      <span className="rounded bg-white/90 px-1.5 py-0.5 text-sm font-extrabold tracking-tight" style={{ color: '#0f754e' }}>
        МИР
      </span>
    )
  }
  return (
    <span className="text-sm font-semibold uppercase tracking-wide text-white/90">
      {BRAND_NAME[brand]}
    </span>
  )
}

export function CardVisual({
  card,
  revealed,
  decrypted,
}: {
  card: BankCard
  revealed: boolean
  /** расшифрованный номер (для enc-карт), если уже получен */
  decrypted?: string
}) {
  // ---- Скидочная карта: штрихкод вместо платёжной системы ----
  if (card.loyalty) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl p-5 text-white shadow-md"
        style={{ background: gradientCss(card.gradient), aspectRatio: '1.586 / 1' }}
      >
        <span className="block max-w-full truncate text-sm font-medium text-white/90">
          {card.label}
        </span>
        <div className="mt-4 rounded-lg bg-white p-2">
          <Barcode value={card.number} height={48} />
          <div className="mt-1 text-center font-mono text-sm tracking-widest text-black">
            {card.number}
          </div>
        </div>
      </div>
    )
  }

  // ---- Платёжная карта ----
  const brand = card.enc ? ((card.brand as Brand) ?? 'unknown') : detectBrand(card.number)

  let numberDisplay: string
  if (card.enc) {
    numberDisplay = revealed && decrypted ? formatNumber(decrypted) : `•••• •••• •••• ${card.last4 ?? '••••'}`
  } else {
    numberDisplay = revealed ? formatNumber(card.number) : maskNumber(card.number)
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl p-5 text-white shadow-md"
      style={{ background: gradientCss(card.gradient), aspectRatio: '1.586 / 1' }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      />

      <div className="flex items-start justify-between">
        <span className="max-w-[60%] truncate text-sm font-medium text-white/90">{card.label}</span>
        <BrandMark brand={brand} />
      </div>

      <div className="mt-3 h-7 w-10 rounded-md" style={{ background: 'linear-gradient(135deg, #f5d061, #c99700)' }} />

      <div className="mt-3 font-mono text-lg tracking-[0.12em] sm:text-xl">{numberDisplay}</div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-sm uppercase tracking-wide text-white/90">
          {card.holder || ' '}
        </span>
        <span className="shrink-0 font-mono text-sm text-white/90">{card.expiry}</span>
      </div>
    </div>
  )
}

/** Цифры для копирования платёжной карты (не enc). */
export function plainDigits(card: BankCard): string {
  return digitsOf(card.number)
}
