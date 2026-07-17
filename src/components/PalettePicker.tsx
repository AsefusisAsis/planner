// ============================================================
// Выбор темы карточками-превью (вместо трёх слов в SegmentedControl):
// каждая тема показывает свои цвета/форму и объясняет, для кого она —
// «Деловая» быстро и плотно, «Тёплая» мягко и с медвежонком,
// «Спокойная» тихо и с капибарой. Radiogroup + roving tabindex,
// как у SegmentedControl.
// ============================================================
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { PALETTES, type Palette } from '../types'
import { tap } from '../lib/haptics'

// мини-превью рисуем ФИКСИРОВАННЫМИ цветами светлого варианта каждой темы,
// а не var(--…): карточки должны показывать «как будет», а не «как сейчас»
const PREVIEW: Record<Palette, { bg: string; card: string; accent: string; text: string; radius: number }> = {
  classic: { bg: '#f4f4f5', card: '#ffffff', accent: '#6366f1', text: '#3f3f46', radius: 8 },
  warm: { bg: '#F4EEE3', card: '#FFFDF9', accent: '#B2592F', text: '#6B5A4B', radius: 12 },
  emerald: { bg: '#E9EFE7', card: '#ffffff', accent: '#107A55', text: '#46524B', radius: 4 },
}

export function PalettePicker({
  value,
  onChange,
  className = '',
}: {
  value: Palette
  onChange: (v: Palette) => void
  className?: string
}) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const label: Record<Palette, string> = {
    classic: t('settings.paletteClassic'),
    warm: t('settings.paletteWarm'),
    emerald: t('settings.paletteEmerald'),
  }
  const desc: Record<Palette, string> = {
    classic: t('settings.paletteClassicDesc'),
    warm: t('settings.paletteWarmDesc'),
    emerald: t('settings.paletteEmeraldDesc'),
  }
  return (
    <div
      ref={boxRef}
      role="radiogroup"
      onKeyDown={(e) => {
        const i = PALETTES.findIndex((p) => p === value)
        let next = -1
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + PALETTES.length) % PALETTES.length
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % PALETTES.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = PALETTES.length - 1
        if (next < 0 || next === i) return
        e.preventDefault()
        onChange(PALETTES[next])
        boxRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
      }}
      className={`flex flex-col gap-2 ${className}`}
    >
      {PALETTES.map((p) => {
        const active = p === value
        const pv = PREVIEW[p]
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              tap()
              onChange(p)
            }}
            className="press flex w-full items-center gap-3 border p-2.5 text-left transition"
            style={{
              borderRadius: 'var(--radius-sm)',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              boxShadow: active ? '0 0 0 1px var(--accent)' : undefined,
              background: 'var(--card)',
            }}
          >
            {/* мини-сцена темы: фон + карточка с акцентом в её форме */}
            <span
              className="flex h-12 w-16 shrink-0 items-center justify-center"
              style={{ background: pv.bg, borderRadius: pv.radius }}
              aria-hidden="true"
            >
              <span
                className="flex h-8 w-11 flex-col justify-center gap-1 px-1.5"
                style={{ background: pv.card, borderRadius: Math.max(3, pv.radius - 4), boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)' }}
              >
                <span className="block h-1.5 w-4 rounded-full" style={{ background: pv.accent }} />
                <span className="block h-1 w-7 rounded-full" style={{ background: pv.text, opacity: 0.35 }} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label[p]}</span>
              <span className="mt-0.5 block text-xs leading-snug text-[var(--text-3)]">{desc[p]}</span>
            </span>
            {active && <Check size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />}
          </button>
        )
      })}
    </div>
  )
}
