import type { AppData } from '../types'
import { Capacitor } from '@capacitor/core'

/**
 * Скачивает data.json файлом (веб). На нативе возвращает false — Android
 * WebView игнорирует <a download>. Используется как резервная копия перед
 * сменой аккаунта / переносом.
 */
export function exportDataToFile(data: AppData): boolean {
  if (Capacitor.isNativePlatform()) return false
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
