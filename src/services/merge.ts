import type { AppData } from '../types'

/**
 * Слияние локальной и удалённой версий.
 *
 * Стратегия: last-write-wins на уровне документа по полю updatedAt.
 * Для персонального использования с частой синхронизацией это предсказуемо
 * и корректно обрабатывает удаления. Риск — одновременные правки оффлайн
 * на двух устройствах: победит более поздняя по времени версия целиком.
 */
export function merge(local: AppData, remote: AppData): AppData {
  const lt = new Date(local.updatedAt).getTime()
  const rt = new Date(remote.updatedAt).getTime()
  return rt > lt ? remote : local
}
