// ============================================================
// Мост «веб → виджет рабочего стола» (Android).
//
// Виджет ничего не считает сам: здесь берётся готовый снимок дня
// (lib/widgetSnapshot — уже локализованный) и отдаётся нативной части
// (android/.../WidgetBridgePlugin.java), которая кладёт его в
// SharedPreferences и перерисовывает размещённые виджеты.
//
// Только нативная сборка; в вебе — no-op.
// ============================================================

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { AppData } from '../types'
import { todayISO } from '../lib/id'
import { buildWidgetSnapshot } from '../lib/widgetSnapshot'

interface WidgetBridgePlugin {
  update(opts: { data: string }): Promise<{ value: boolean }>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

let timer: ReturnType<typeof setTimeout> | null = null

/** Обновить виджет рабочего стола по текущим данным (дебаунс 1.5 с). */
export function refreshWidget(data: AppData): void {
  if (!Capacitor.isNativePlatform()) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void (async () => {
      try {
        const snapshot = buildWidgetSnapshot(data, todayISO())
        await WidgetBridge.update({ data: JSON.stringify(snapshot) })
      } catch (e) {
        // плагин есть только в нативной сборке (ранний выход выше) — значит
        // это реальная ошибка моста: логируем, но приложение не роняем
        console.warn('[widget] не удалось обновить виджет', e)
      }
    })()
  }, 1500)
}
