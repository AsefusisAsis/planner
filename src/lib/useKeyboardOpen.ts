// Открыта ли экранная клавиатура. Вынесено из components/ui: там этот хук
// соседствовал с компонентами, из-за чего Fast Refresh переставал работать
// для всего файла (единственное предупреждение линтера в проекте).

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const KEYBOARD_INPUTS = new Set([
  'text', 'number', 'search', 'email', 'tel', 'url', 'password',
  'date', 'time', 'datetime-local', 'month', 'week',
])

/** Вызывает ли фокус на этом элементе появление клавиатуры. */
function summonsKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') return KEYBOARD_INPUTS.has((el as HTMLInputElement).type)
  return false
}

/** Открыта ли экранная клавиатура — на телефоне прячем нижнюю навигацию/FAB. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // натив: честные события клавиатуры (системная «назад» прячет её без снятия фокуса)
    if (Capacitor.isNativePlatform()) {
      const subs = [
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ]
      return () => {
        for (const s of subs) void s.then((h) => h.remove()).catch(() => {})
      }
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const onIn = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      if (timer) clearTimeout(timer)
      setOpen(true)
    }
    const onOut = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      timer = setTimeout(() => setOpen(false), 150)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      if (timer) clearTimeout(timer)
    }
  }, [])
  return open
}
