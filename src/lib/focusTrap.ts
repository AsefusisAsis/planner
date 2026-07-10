import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Фокус-ловушка для диалогов (WCAG 2.4.3): запоминает элемент до открытия,
// переводит фокус внутрь панели, держит Tab в её пределах, возвращает фокус
// на триггер при закрытии. initial='panel' — фокус на саму панель (не дёргаем
// клавиатуру), 'first' — на первый фокусируемый элемент (например, поле
// поиска). Атрибут autoFocus внутри панели использовать нельзя: он срабатывает
// раньше этого эффекта, и точкой возврата запомнится само поле, а не триггер.
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  initial: 'panel' | 'first' = 'panel',
) {
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    // если фокус уже внутри панели (какой-то autoFocus успел раньше) —
    // возвращать фокус «в панель» после закрытия бессмысленно, пропускаем
    const ae = document.activeElement as HTMLElement | null
    restoreRef.current = ae && panel?.contains(ae) ? null : ae
    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        : []
    if (initial === 'first') (focusables()[0] ?? panel)?.focus()
    else panel?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    panel?.addEventListener('keydown', onKey)
    return () => {
      panel?.removeEventListener('keydown', onKey)
      restoreRef.current?.focus?.()
    }
  }, [open, panelRef, initial])
}
