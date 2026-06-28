import type { BankCard } from '../../types'
import {
  detectBrand,
  formatNumber,
  maskNumber,
  gradientCss,
  BRAND_NAME,
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

export function CardVisual({ card, revealed }: { card: BankCard; revealed: boolean }) {
  const brand = detectBrand(card.number)
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl p-5 text-white shadow-md"
      style={{ background: gradientCss(card.gradient), aspectRatio: '1.586 / 1' }}
    >
      {/* блик */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      />

      <div className="flex items-start justify-between">
        <span className="max-w-[60%] truncate text-sm font-medium text-white/90">
          {card.label}
        </span>
        <BrandMark brand={brand} />
      </div>

      {/* чип */}
      <div
        className="mt-3 h-7 w-10 rounded-md"
        style={{ background: 'linear-gradient(135deg, #f5d061, #c99700)' }}
      />

      {/* номер */}
      <div className="mt-3 font-mono text-lg tracking-[0.12em] sm:text-xl">
        {revealed ? formatNumber(card.number) : maskNumber(card.number)}
      </div>

      {/* низ */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-sm uppercase tracking-wide text-white/90">
          {card.holder || ' '}
        </span>
        <span className="shrink-0 font-mono text-sm text-white/90">{card.expiry}</span>
      </div>
    </div>
  )
}
