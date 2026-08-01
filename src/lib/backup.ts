import type { AppData } from '../types'
import { shareTextFile } from './shareFile'

/**
 * Отдать пользователю резервную копию data.json.
 *
 * В вебе скачивается файлом, на телефоне открывается системное «Поделиться»
 * (WebView игнорирует <a download>, поэтому раньше здесь просто возвращался
 * false и копия НЕ создавалась — как раз перед тем, как локальные данные
 * заменит другой аккаунт).
 *
 * Возвращает, получил ли пользователь файл: по этому флагу вызывающий код
 * решает, предупреждать ли, что данные заменены без копии. Отказ от диалога
 * тоже даёт false — копии в этом случае действительно нет.
 */
export async function exportDataToFile(data: AppData): Promise<boolean> {
  const name = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
  const res = await shareTextFile(name, JSON.stringify(data, null, 2), {
    mime: 'application/json',
    title: name,
  })
  return res.ok
}
