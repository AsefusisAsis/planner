import type { ThemeMode } from '../types'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Применяет тему к <html data-theme="..."> с учётом системной,
 *  а в нативном приложении синхронизирует иконки статус-бара под фон. */
export function applyTheme(mode: ThemeMode) {
  const resolved =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved

  // натив: тёмный фон → светлые иконки (Style.Dark), светлый → тёмные (Style.Light).
  // Иначе при смене темы в приложении иконки статус-бара оставались от старой.
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light }).catch(
      () => {},
    )
  }
}
