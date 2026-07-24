// Открытие стороннего приложения по имени пакета (Android Intent) через
// собственный плагин AppOpener (см. android/.../AppOpenerPlugin.java).
// Только нативная сборка; на вебе всегда false, кнопка скрыта.
import { Capacitor, registerPlugin } from '@capacitor/core'

interface AppOpenerPlugin {
  canOpen(opts: { package: string }): Promise<{ value: boolean }>
  open(opts: { package: string }): Promise<{ value: boolean }>
}

const AppOpener = registerPlugin<AppOpenerPlugin>('AppOpener')

export async function canOpenApp(pkg: string | undefined | null): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !pkg) return false
  try {
    return (await AppOpener.canOpen({ package: pkg })).value
  } catch {
    return false
  }
}

export async function openApp(pkg: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !pkg) return false
  try {
    return (await AppOpener.open({ package: pkg })).value
  } catch {
    return false
  }
}
