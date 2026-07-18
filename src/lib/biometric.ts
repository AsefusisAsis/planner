// Биометрическая разблокировка «Защиты данных» на устройстве. Биометрия —
// это ГЕЙТ доступа к сохранённому секрету (открыть session-DEK), а не второй
// фактор шифрования. Работает только в нативной сборке (Capacitor); на вебе
// isBiometryAvailable() всегда false и кнопка не показывается.
import { Capacitor } from '@capacitor/core'

export async function isBiometryAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    const info = await BiometricAuth.checkBiometry()
    return info.isAvailable
  } catch {
    return false
  }
}

/** Показать системный биометрический промпт. true — успех, false — отказ/ошибка. */
export async function biometricAuthenticate(reason: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: undefined,
      allowDeviceCredential: true, // запасной вход по PIN/паттерну устройства
    })
    return true
  } catch {
    return false // пользователь отменил или биометрия не прошла
  }
}
