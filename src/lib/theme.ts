import type { ThemeMode, Palette } from '../types'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Применяет тему и палитру к <html>: data-theme (light/dark) + data-palette,
 *  а в нативном приложении синхронизирует иконки статус-бара под фон. */
export function applyTheme(mode: ThemeMode, palette: Palette = 'classic') {
  const resolved =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.setAttribute('data-palette', palette)
  root.style.colorScheme = resolved

  // натив: тёмный фон → светлые иконки (Style.Dark), светлый → тёмные (Style.Light).
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light }).catch(
      () => {},
    )
  }
}
