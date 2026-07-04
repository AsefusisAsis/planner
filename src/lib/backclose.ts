// ============================================================
// Реестр «что закрыть по системной кнопке назад» (Android).
// Открытые листы/модалки регистрируют своё закрытие; обработчик
// backButton (App.tsx) закрывает верхний вместо навигации/выхода.
// ============================================================

import { useEffect } from 'react'

type Closer = () => void
const stack: Closer[] = []

export function registerBackCloser(close: Closer): () => void {
  stack.push(close)
  return () => {
    const i = stack.lastIndexOf(close)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** Закрыть верхний открытый лист. true — было что закрывать. */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top()
  return true
}

/** Пока open — компонент закрывается системной «назад». */
export function useBackCloser(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    return registerBackCloser(onClose)
  }, [open, onClose])
}
