// Текст, отправленный в приложение через системное «Поделиться».
//
// Нативная часть — android/.../ShareTargetPlugin.java. На вебе плагина нет,
// и это нормально: там сценарий закрывается кнопкой «Вставить из буфера».
//
// Приложение НЕ читает уведомления само и не просит такого разрешения —
// текст отдаёт пользователь явным действием.

import { Capacitor, registerPlugin } from '@capacitor/core'

interface ShareTargetPlugin {
  /** Забрать отложенный текст (и очистить). Пустая строка — ничего нет. */
  consume(): Promise<{ value: string }>
  addListener(
    event: 'sharedText',
    cb: (data: { value: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const plugin = registerPlugin<ShareTargetPlugin>('ShareTarget')

/**
 * Текст, пришедший ДО того, как веб-слой успел подписаться (приложение
 * запускали самим «Поделиться»). Возвращает null, если ничего нет.
 */
export async function consumeSharedText(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { value } = await plugin.consume()
    return value.trim() ? value : null
  } catch {
    // Плагина может не быть в старой установленной сборке — это не повод
    // ронять запуск приложения.
    return null
  }
}

/**
 * Подписка на «поделились, пока приложение открыто».
 * Возвращает функцию отписки (no-op на вебе).
 */
export function onSharedText(cb: (text: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}
  let handle: { remove: () => Promise<void> } | null = null
  let cancelled = false
  void plugin
    .addListener('sharedText', ({ value }) => {
      if (value.trim()) cb(value)
    })
    .then((h) => {
      if (cancelled) void h.remove()
      else handle = h
    })
    .catch(() => {})
  return () => {
    cancelled = true
    if (handle) void handle.remove().catch(() => {})
  }
}
