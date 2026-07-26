// Защищённое хранилище устройства. На Android — собственный плагин
// SecureStore поверх Android Keystore (см. SecureStorePlugin.java): значение
// шифруется ключом, который не покидает устройство. В вебе такого хранилища
// нет — там остаётся localStorage (осознанный компромисс, см. vault.ts).

import { Capacitor, registerPlugin } from '@capacitor/core'

interface SecureStorePlugin {
  get(opts: { key: string }): Promise<{ value: string | null }>
  set(opts: { key: string; value: string }): Promise<{ value: boolean }>
  remove(opts: { key: string }): Promise<{ value: boolean }>
}

const SecureStore = registerPlugin<SecureStorePlugin>('SecureStore')

/** Доступно ли аппаратно-защищённое хранилище (только нативная сборка). */
export function hasSecureStore(): boolean {
  return Capacitor.isNativePlatform()
}

export async function secureGet(key: string): Promise<string | null> {
  if (!hasSecureStore()) return null
  try {
    return (await SecureStore.get({ key })).value
  } catch {
    return null
  }
}

/** Записать значение. Возвращает false, если сохранить не удалось. */
export async function secureSet(key: string, value: string): Promise<boolean> {
  if (!hasSecureStore()) return false
  try {
    return (await SecureStore.set({ key, value })).value
  } catch {
    return false
  }
}

export async function secureRemove(key: string): Promise<void> {
  if (!hasSecureStore()) return
  try {
    await SecureStore.remove({ key })
  } catch {
    /* нечего чистить */
  }
}
