import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Link2, Check, Copy, LogOut, Undo2, Plus, Trash2 } from 'lucide-react'
import { Button, Card, IconButton } from '../../components/ui'
import { useStore } from '../../store'
import { visibleItems, type SharedItem } from '../../lib/sharedListMerge'

/**
 * Общие списки покупок — данные, доступные двум аккаунтам.
 *
 * Показываются отдельным блоком, а не вперемешку с локальными: у них другая
 * природа (их видит и меняет ещё один человек), и путать их с личными
 * списками не нужно. Локальные списки этот компонент не трогает.
 */
export function SharedLists() {
  const { t } = useTranslation()
  const account = useStore((s) => s.account)
  const lists = useStore((s) => s.sharedLists)
  const busy = useStore((s) => s.sharedBusy)
  const error = useStore((s) => s.sharedError)
  const refresh = useStore((s) => s.refreshSharedLists)
  const save = useStore((s) => s.saveSharedListState)
  const createInvite = useStore((s) => s.createSharedInvite)
  const unshare = useStore((s) => s.unshareList)
  const leave = useStore((s) => s.leaveSharedList)

  const [link, setLink] = useState<{ id: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    void refresh()
  }, [refresh, account])

  // Без аккаунта общих списков не бывает — блок не показываем вовсе.
  // А вот с аккаунтом показываем ВСЕГДА, даже когда список пуст: иначе после
  // «Поделиться» локальный список исчезает, общий ещё не подгрузился, и
  // человеку кажется, что список потерян.
  if (!account) return null

  const stamp = () => new Date().toISOString()

  async function toggle(listId: string, items: SharedItem[], itemId: string) {
    await save(listId, {
      items: items.map((i) =>
        i.id === itemId ? { ...i, bought: !i.bought, updatedAt: stamp() } : i,
      ),
    })
  }

  async function addItem(listId: string, items: SharedItem[]) {
    const name = (draft[listId] ?? '').trim()
    if (!name) return
    setDraft((d) => ({ ...d, [listId]: '' }))
    await save(listId, {
      items: [
        ...items,
        { id: crypto.randomUUID(), name, qty: 1, bought: false, updatedAt: stamp() },
      ],
    })
  }

  async function removeItem(listId: string, items: SharedItem[], itemId: string) {
    // не выбрасываем позицию, а помечаем удалённой: иначе она вернётся с
    // устройства партнёра, которое об удалении ещё не знает
    await save(listId, {
      items: items.map((i) => (i.id === itemId ? { ...i, deleted: true, updatedAt: stamp() } : i)),
    })
  }

  async function share(listId: string) {
    setCopied(false)
    const url = await createInvite(listId)
    setLink({ id: listId, url })
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* буфер недоступен — ссылка и так видна на экране */
    }
  }

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-base font-semibold">{t('shopping.sharedTitle')}</h2>
      </div>

      {error && (
        <p className="mb-2 text-xs" style={{ color: 'var(--danger-text)' }}>
          {error}
        </p>
      )}

      {!lists.length && !busy && !error && (
        <p className="text-sm text-[var(--text-3)]">{t('shopping.sharedNone')}</p>
      )}

      {lists.map((l) => {
        const items = visibleItems(l.items)
        const mine = l.owner_id === account.id
        return (
          <div
            key={l.id}
            className="mb-3 rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
              {/* владелец и участник могут разное — подписываем явно */}
              <span className="shrink-0 text-[11px] text-[var(--text-3)]">
                {mine ? t('shopping.sharedOwner') : t('shopping.sharedGuest')}
              </span>
            </div>

            <ul className="mb-2 space-y-1">
              {items.length === 0 && (
                <li className="text-xs text-[var(--text-3)]">{t('shopping.sharedEmpty')}</li>
              )}
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!i.bought}
                    onChange={() => void toggle(l.id, l.items, i.id)}
                    style={{ width: 18, height: 18 }}
                    aria-label={i.name}
                  />
                  <span className={`min-w-0 flex-1 truncate ${i.bought ? 'line-through opacity-60' : ''}`}>
                    {i.name}
                  </span>
                  <IconButton
                    aria-label={`${t('shopping.deleteItem')}: ${i.name}`}
                    onClick={() => void removeItem(l.id, l.items, i.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <input
                value={draft[l.id] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && void addItem(l.id, l.items)}
                placeholder={t('shopping.itemName')}
                className="min-w-0 flex-1"
              />
              <Button
                aria-label={t('common.add')}
                className="shrink-0"
                disabled={!(draft[l.id] ?? '').trim()}
                onClick={() => void addItem(l.id, l.items)}
              >
                <Plus size={16} />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {mine ? (
                <>
                  <Button variant="subtle" onClick={() => void share(l.id)}>
                    <Link2 size={15} /> {t('shopping.sharedInvite')}
                  </Button>
                  {/* отзыв доступа = вернуть список себе; ссылки при этом
                      аннулируются, иначе по старой ссылке зайдут снова */}
                  <Button variant="ghost" onClick={() => void unshare(l.id)}>
                    <Undo2 size={15} /> {t('shopping.sharedStop')}
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => void leave(l.id)}>
                  <LogOut size={15} /> {t('shopping.sharedLeave')}
                </Button>
              )}
            </div>

            {link?.id === l.id && (
              <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
                <p className="mb-1 text-xs text-[var(--text-3)]">{t('shopping.sharedLinkHint')}</p>
                <button
                  type="button"
                  onClick={() => void copyLink(link.url)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <code className="min-w-0 flex-1 break-all text-xs">{link.url}</code>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            )}
          </div>
        )
      })}

      <p className="text-[11px] text-[var(--text-3)]">{t('shopping.sharedNote')}</p>
    </Card>
  )
}
