// Тактильный отклик — только в нативном приложении, в вебе no-op.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

/** Лёгкая вибрация на значимое действие (отметка, добавление). */
export function tap(style: 'light' | 'medium' = 'light'): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.impact({
    style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium,
  }).catch(() => {
    /* нет вибромотора — тихо пропускаем */
  })
}
