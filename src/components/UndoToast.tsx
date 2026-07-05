// Тост «Удалено · Отменить» — единая точка отмены удалений.
// Управляется стором (pendingUndo); показывается 5 секунд.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../store'

export function UndoToast() {
  const { t } = useTranslation()
  const pending = useStore((s) => s.pendingUndo)
  const undoLast = useStore((s) => s.undoLast)
  const dismissUndo = useStore((s) => s.dismissUndo)

  // авто-скрытие через 5 секунд (id в зависимостях — новый показ перезапускает таймер)
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(dismissUndo, 5000)
    return () => clearTimeout(timer)
  }, [pending?.id, dismissUndo, pending])

  if (!pending) return null
  return (
    <div
      role="status"
      aria-live="polite"
      // над нижней навигацией на телефоне; по центру
      className="anim-sheet fixed inset-x-0 bottom-24 z-40 mx-auto flex w-[min(92%,26rem)] items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg sm:bottom-6"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
    >
      <span className="min-w-0 truncate text-sm">
        {t('common.deleted')}: <span className="text-[var(--text-2)]">{pending.label}</span>
      </span>
      <button
        onClick={undoLast}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition active:scale-95"
        style={{ color: 'var(--accent)' }}
      >
        <RotateCcw size={15} />
        {t('common.undo')}
      </button>
    </div>
  )
}
