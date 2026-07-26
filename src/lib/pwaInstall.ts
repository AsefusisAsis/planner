// Установка веб-версии как приложения (PWA).
//
// Chrome/Edge перед показом своей плашки шлют beforeinstallprompt. Событие
// одноразовое и приходит рано, поэтому слушатель вешается на импорте модуля,
// а само событие складывается в память — потом его можно вызвать по кнопке.
// Так пользователь жмёт «Установить» у нас, а не ищет иконку в адресной
// строке. Где события нет (Safari, Firefox) — показываем инструкцию.

import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'

/** Событие Chrome; в TS его типа нет. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // без preventDefault Chrome покажет свою мини-плашку вместо нашей кнопки
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

/** Приложение уже открыто как установленное (не вкладка браузера)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Какую инструкцию показать, если системного диалога нет. */
export type InstallHint = 'ios' | 'android' | 'desktop'

export function installHint(): InstallHint {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** true — можно показать системный диалог установки прямо сейчас. */
function getSnapshot(): boolean {
  return deferred !== null && !installed
}

export interface InstallState {
  /** показывать ли блок установки вообще */
  show: boolean
  /** есть системный диалог — рисуем кнопку; иначе текстовую инструкцию */
  canPrompt: boolean
  hint: InstallHint
}

/** Состояние установки для интерфейса. */
export function useInstallState(): InstallState {
  const canPrompt = useSyncExternalStore(subscribe, getSnapshot, () => false)
  // в нативной сборке и в уже установленном приложении предлагать нечего
  const show = !Capacitor.isNativePlatform() && !isStandalone() && !installed
  return { show, canPrompt, hint: installHint() }
}

/** Показать системный диалог установки. true — пользователь согласился. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  // событие одноразовое: повторный prompt() бросает, поэтому сразу забываем
  deferred = null
  emit()
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome === 'accepted'
  } catch {
    return false
  }
}
