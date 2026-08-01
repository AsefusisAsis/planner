// Мост к Health Connect (Android). Только ЧТЕНИЕ веса.
//
// Правило этого модуля — как и у lib/biometric: не проглатывать причину.
// «Не работает» бывает четырёх разных видов, и пользователю нужно разное
// действие: обновить Android, поставить Health Connect, выдать разрешение
// или пожаловаться нам. Общий false тут бесполезен.

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HealthWeightSample } from './healthImport'

export type HealthState =
  /** веб или Android старше 8 — интеграции нет в принципе */
  | 'unsupported'
  /** Health Connect не установлен (до Android 14 это отдельное приложение) */
  | 'notInstalled'
  /** установлен, но требует обновления */
  | 'needsUpdate'
  /** доступ к весу не выдан */
  | 'noPermission'
  /** всё готово, можно читать */
  | 'ready'
  /** что-то пошло не так; reason — текст для показа */
  | 'error'

export interface HealthStatus {
  state: HealthState
  reason?: string
}

interface HealthConnectPlugin {
  status(): Promise<HealthStatus>
  requestPermission(): Promise<{ granted: boolean }>
  readWeights(options: { startISO: string }): Promise<{ samples: HealthWeightSample[] }>
  openHealthConnect(): Promise<void>
}

const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect')

const UNSUPPORTED: HealthStatus = { state: 'unsupported' }

export async function getHealthStatus(): Promise<HealthStatus> {
  if (!Capacitor.isNativePlatform()) return UNSUPPORTED
  try {
    return await HealthConnect.status()
  } catch (e) {
    // Плагина нет в сборке / он не поднялся — это причина, а не «нет данных»
    return { state: 'error', reason: (e as Error)?.message ?? '' }
  }
}

/** Системный экран выдачи доступа. Возвращает, выдан ли он по итогу. */
export async function requestHealthPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    return (await HealthConnect.requestPermission()).granted
  } catch {
    return false
  }
}

/** Открыть Health Connect: установка, обновление или настройка доступа. */
export async function openHealthConnect(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await HealthConnect.openHealthConnect()
  } catch {
    /* нечего показать — состояние экрана и так объясняет, что делать */
  }
}

/**
 * Замеры веса за последние `days` дней.
 * Бросает при сбое чтения: вызывающий показывает причину, а не молча
 * рисует «импортировано 0».
 */
export async function readHealthWeights(days = 365): Promise<HealthWeightSample[]> {
  if (!Capacitor.isNativePlatform()) return []
  const startISO = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
  const res = await HealthConnect.readWeights({ startISO })
  return res.samples ?? []
}
