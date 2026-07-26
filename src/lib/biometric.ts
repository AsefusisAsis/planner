// Биометрическая разблокировка «Защиты данных» на устройстве. Биометрия —
// это ГЕЙТ доступа к сохранённому секрету (открыть session-DEK), а не второй
// фактор шифрования. Работает только в нативной сборке (Capacitor).
//
// Важное правило этого модуля: НЕ проглатывать причину. Раньше всё
// возвращало голый false, и когда биометрия не настроена на телефоне или
// плагин падал, кнопка просто не появлялась — пользователь видел «молча не
// работает». Теперь наверх идут код и текст причины, а интерфейс объясняет.

import { Capacitor } from '@capacitor/core'

/** Во что укрупняем тип биометрии для подписи в интерфейсе. */
export type BiometryKind = 'none' | 'fingerprint' | 'face' | 'iris'

export interface BiometryStatus {
  /** нативная сборка? в вебе биометрии нет в принципе */
  native: boolean
  /** доступна и настроена — можно показывать кнопку */
  available: boolean
  /** есть ли на устройстве экран блокировки (PIN/паттерн/пароль) */
  deviceSecure: boolean
  kind: BiometryKind
  /** код причины недоступности (BiometryErrorType) — '' если доступна */
  code: string
  /** пояснение от системы; может быть пустым */
  reason: string
}

const UNAVAILABLE: BiometryStatus = {
  native: false,
  available: false,
  deviceSecure: false,
  kind: 'none',
  code: 'web',
  reason: '',
}

/** Числовой BiometryType плагина → укрупнённый вид. */
function kindOf(t: number): BiometryKind {
  switch (t) {
    case 1: // touchId
    case 3: // fingerprintAuthentication
      return 'fingerprint'
    case 2: // faceId
    case 4: // faceAuthentication
      return 'face'
    case 5: // irisAuthentication
      return 'iris'
    default:
      return 'none'
  }
}

/** Полное состояние биометрии на устройстве — с причиной недоступности. */
export async function getBiometryStatus(): Promise<BiometryStatus> {
  if (!Capacitor.isNativePlatform()) return UNAVAILABLE
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    const info = await BiometricAuth.checkBiometry()
    return {
      native: true,
      available: info.isAvailable,
      deviceSecure: info.deviceIsSecure,
      kind: kindOf(info.biometryType as unknown as number),
      code: info.isAvailable ? '' : String(info.code || 'biometryNotAvailable'),
      reason: info.reason ?? '',
    }
  } catch (e) {
    // плагин не поднялся (нет в сборке, старая версия) — это тоже причина,
    // и её нужно показать, а не выдать за «биометрии нет на телефоне»
    return {
      native: true,
      available: false,
      deviceSecure: false,
      kind: 'none',
      code: 'pluginError',
      reason: (e as Error)?.message ?? '',
    }
  }
}

/** Короткая проверка доступности (для мест, где причина не нужна). */
export async function isBiometryAvailable(): Promise<boolean> {
  return (await getBiometryStatus()).available
}

/**
 * Можно ли вообще предлагать быструю разблокировку.
 *
 * Шире, чем `available`: мы зовём промпт с `allowDeviceCredential`, поэтому
 * PIN/паттерн устройства подходит и без заведённого отпечатка. Раньше кнопку
 * гейтили только по биометрии — на телефоне без отпечатка пользователь не
 * получал ничего, хотя разблокировка по PIN сработала бы.
 */
export function canPromptUnlock(s: BiometryStatus): boolean {
  return s.native && (s.available || s.deviceSecure)
}

export interface BiometryAuthResult {
  ok: boolean
  /** код ошибки плагина: userCancel, biometryLockout, … */
  code: string
  message: string
}

/** Показать системный биометрический промпт. */
export async function biometricAuthenticate(reason: string): Promise<BiometryAuthResult> {
  if (!Capacitor.isNativePlatform()) return { ok: false, code: 'web', message: '' }
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: undefined,
      allowDeviceCredential: true, // запасной вход по PIN/паттерну устройства
    })
    return { ok: true, code: '', message: '' }
  } catch (e) {
    const err = e as { code?: string; message?: string }
    return { ok: false, code: String(err?.code ?? 'unknown'), message: err?.message ?? '' }
  }
}
