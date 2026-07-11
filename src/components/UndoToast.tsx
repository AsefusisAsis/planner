// Тост «Удалено · Отменить» — единая точка отмены удалений.
// Управляется стором (pendingUndo); скрывается через 8 секунд, пауза при
// наведении/фокусе (WCAG 2.2.1), Ctrl/Cmd+Z отменяет с клавиатуры.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { useVoice } from '../lib/voice'

export function UndoToast() {
  const { t } = useTranslation()
  const vt = useVoice()
  const pending = useStore((s) => s.pendingUndo)
  const undoLast = useStore((s) => s.undoLast)
  const dismissUndo = useStore((s) => s.dismissUndo)
  const [paused, setPaused] = useState(false)

  // новый показ — пауза с прошлого тоста не должна пережить его
  useEffect(() => {
    setPaused(false)
  }, [pending?.id])

  // авто-скрытие (id в зависимостях — новый показ перезапускает таймер);
  // пока курсор/фокус на тосте, таймер стоит
  useEffect(() => {
    if (!pending || paused) return
    const timer = setTimeout(dismissUndo, 8000)
    return () => clearTimeout(timer)
  }, [pending?.id, paused, dismissUndo, pending])

  // Ctrl/Cmd+Z — отмена без тачпада: до кнопки тоста дотабывать далеко.
  // e.code вместо e.key — на русской раскладке key даёт «я»
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyZ' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      undoLast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, undoLast])

  if (!pending) return null
  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      // над нижней навигацией на телефоне; по центру
      className="anim-sheet fixed inset-x-0 bottom-24 z-40 mx-auto flex w-[min(92%,26rem)] items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg sm:bottom-6"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
    >
      <span className="min-w-0 truncate text-sm">
        {vt('common.deleted')}: <span className="text-[var(--text-2)]">{pending.label}</span>
      </span>
      <button
        onClick={undoLast}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition active:scale-95"
        style={{ color: 'var(--accent)' }}
      >
        <RotateCcw size={15} />
        {t('common.undo')}
      </button>
    </div>
  )
}
