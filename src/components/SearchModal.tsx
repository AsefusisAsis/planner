import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useStore } from '../store'
import { useVoice } from '../lib/voice'
import { useBackCloser } from '../lib/backclose'

interface Result {
  id: string
  group: string
  label: string
  sub?: string
  to: string
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const vt = useVoice()
  const navigate = useNavigate()
  const data = useStore((s) => s.data)
  const [q, setQ] = useState('')

  // системная «назад» на Android закрывает поиск
  useBackCloser(open, onClose)

  useEffect(() => {
    if (!open) return
    setQ('')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo<Result[]>(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const out: Result[] = []
    const hit = (s?: string) => !!s && s.toLowerCase().includes(query)

    for (const e of data.expenses) {
      if (hit(e.note)) out.push({ id: e.id, group: t('nav.expenses'), label: e.note || '—', sub: e.date, to: '/expenses' })
    }
    for (const x of data.homeTasks) {
      if (hit(x.title)) out.push({ id: x.id, group: t('nav.home'), label: x.title, to: '/home' })
    }
    for (const l of data.shoppingLists) {
      if (hit(l.name)) out.push({ id: l.id, group: t('nav.shopping'), label: l.name, to: '/shopping' })
      for (const it of l.items) {
        if (hit(it.name)) out.push({ id: it.id, group: t('nav.shopping'), label: it.name, sub: l.name, to: '/shopping' })
      }
    }
    for (const c of data.calendarTasks) {
      if (hit(c.title)) out.push({ id: c.id, group: t('nav.calendar'), label: c.title, sub: c.date, to: '/calendar' })
    }
    for (const c of data.cards) {
      if (hit(c.label) || hit(c.note)) out.push({ id: c.id, group: t('nav.cards'), label: c.label, sub: c.note, to: '/cards' })
    }
    return out.slice(0, 40)
  }, [q, data, t])

  if (!open) return null

  function go(to: string) {
    onClose()
    navigate(to)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3" style={{ borderColor: 'var(--border)' }}>
          <Search size={18} className="text-[var(--text-3)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="flex-1 border-0 bg-transparent px-0 py-3 text-sm focus:shadow-none"
            style={{ outline: 'none' }}
          />
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim() && results.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-[var(--text-3)]">{vt('common.noResults')}</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.group}-${r.id}`}
              onClick={() => go(r.to)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--bg-3)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-[var(--text-3)]">{r.sub}</span>}
              </span>
              <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-[var(--text-2)]" style={{ background: 'var(--bg-3)' }}>
                {r.group}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
