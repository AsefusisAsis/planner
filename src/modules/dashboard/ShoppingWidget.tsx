import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useStore } from '../../store'
import { Checkbox, CollapsibleCard } from '../../components/ui'
import { todayISO } from '../../lib/id'
import type { ShoppingItem } from '../../types'

/**
 * Запланированные покупки: по всем спискам, только с датой и некупленные.
 * Ближайшее по дате — выше, просроченные первыми.
 */
export function ShoppingWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const shoppingLists = useStore((s) => s.data.shoppingLists)
  const toggleItem = useStore((s) => s.toggleItem)
  const today = todayISO()

  const plannedPurchases = useMemo(() => {
    const out: { listId: string; listName: string; item: ShoppingItem }[] = []
    for (const l of shoppingLists)
      for (const it of l.items)
        if (it.plannedDate && !it.bought) out.push({ listId: l.id, listName: l.name, item: it })
    out.sort((a, b) => (a.item.plannedDate as string).localeCompare(b.item.plannedDate as string))
    return out
  }, [shoppingLists])

  /** Относительная дата покупки (цвет + текст). */
  function plannedRel(dateISO: string): { text: string; color: string } {
    const days = Math.round(
      (Date.parse(dateISO + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86400000,
    )
    if (days < 0) return { text: t('dashboard.shopOverdue'), color: 'var(--danger)' }
    if (days === 0) return { text: t('dashboard.cycToday'), color: 'var(--warning-text)' }
    if (days === 1) return { text: t('dashboard.shopTomorrow'), color: 'var(--text-2)' }
    return { text: t('dashboard.cycInDays', { count: days }), color: 'var(--text-3)' }
  }

  return (
    <CollapsibleCard
      id="shopping"
      icon={<ShoppingCart size={16} style={{ color: 'var(--accent)' }} />}
      title={t('dashboard.wShopping')}
      summary={
        plannedPurchases.length > 0 ? (
          <span className="tnum text-xs text-[var(--text-3)]">{plannedPurchases.length}</span>
        ) : undefined
      }
    >
      {plannedPurchases.length === 0 ? (
        <p className="text-sm text-[var(--text-3)]">{t('dashboard.shopEmpty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {plannedPurchases.slice(0, 5).map(({ listId, listName, item }) => {
            const rel = plannedRel(item.plannedDate as string)
            return (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={item.bought} onChange={() => toggleItem(listId, item.id)} label={item.name} />
                <button
                  onClick={() => navigate('/shopping', { state: { focusId: item.id, focusListId: listId } })}
                  className="min-w-0 flex-1 truncate py-1 text-left"
                >
                  {item.name}
                  <span className="text-[var(--text-3)]"> · {listName}</span>
                </button>
                <span className="shrink-0 text-xs tnum" style={{ color: rel.color }}>
                  {rel.text}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </CollapsibleCard>
  )
}
