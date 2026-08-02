import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import { useStore } from '../../store'
import { CollapsibleCard } from '../../components/ui'
import { gradientCss, digitsOf } from '../cards/brand'

/**
 * Карты на Главной: закреплённые пользователем (в его порядке) или первые
 * две — для обратной совместимости с настройками, где закрепления ещё нет.
 * Потолок 6, чтобы виджет не превращался в весь Кошелёк.
 */
export function CardsWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cards = useStore((s) => s.data.cards)
  const pinnedCardIds = useStore((s) => s.data.settings.dashboardCardIds)

  const widgetCards: typeof cards = (
    pinnedCardIds?.length ? pinnedCardIds.flatMap((id) => cards.filter((c) => c.id === id)) : cards.slice(0, 2)
  ).slice(0, 6)

  return (
    <CollapsibleCard
      id="cards"
      icon={<CreditCard size={16} style={{ color: 'var(--accent)' }} />}
      title={t('nav.cards')}
      summary={<span className="text-xs text-[var(--text-3)] tnum">{cards.length}</span>}
    >
      {cards.length === 0 ? (
        <button onClick={() => navigate('/cards')} className="text-sm text-[var(--accent)]">
          {t('dashboard.noCards')} · {t('dashboard.open')}
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {widgetCards.map((c) => {
            const last4 = c.loyalty ? '' : c.enc ? c.last4 ?? '' : digitsOf(c.number).slice(-4)
            return (
              <button
                key={c.id}
                onClick={() => navigate('/cards')}
                className="rounded-xl p-3 text-left text-white"
                style={{ background: gradientCss(c.gradient), aspectRatio: '1.9 / 1' }}
              >
                <div className="truncate text-sm font-medium">{c.label}</div>
                {!c.loyalty && <div className="mt-3 font-mono text-sm tracking-widest">•••• {last4}</div>}
              </button>
            )
          })}
        </div>
      )}
    </CollapsibleCard>
  )
}
