// Сохранение/отправка файла с телефона и из веба.
//
// Android WebView игнорирует <a download>, поэтому на нативе файл сначала
// пишется во временную папку приложения, а потом отдаётся системному
// «Поделиться» — оттуда его можно отправить в почту, мессенджер или
// сохранить в «Файлы». В вебе остаётся обычное скачивание.

import { Capacitor } from '@capacitor/core'

/** Чем закончилась попытка отдать файл — вызывающий код объясняет это словами. */
export type ShareResult =
  /** файл скачан (веб) */
  | { ok: true; how: 'download' }
  /** открыт системный диалог «Поделиться» (натив) */
  | { ok: true; how: 'share' }
  /** пользователь закрыл диалог — не ошибка, ругаться не на что */
  | { ok: false; how: 'cancelled' }
  /** не получилось; message — причина для показа */
  | { ok: false; how: 'failed'; message: string }

function downloadInBrowser(name: string, text: string, mime: string): ShareResult {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return { ok: true, how: 'download' }
}

/**
 * Отдать текстовый файл пользователю.
 *
 * Веб — скачивание. Натив — запись в кэш приложения + системное «Поделиться».
 * Кэш, а не Documents: файл нужен только на время отправки, и засорять
 * хранилище пользователя копиями отчётов ни к чему.
 */
export async function shareTextFile(
  name: string,
  text: string,
  opts: { mime?: string; title?: string; dialogTitle?: string } = {},
): Promise<ShareResult> {
  const mime = opts.mime ?? 'text/plain'
  if (!Capacitor.isNativePlatform()) return downloadInBrowser(name, text, mime)

  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache })

    await Share.share({
      title: opts.title ?? name,
      // files, а не text: отчёт нужен файлом — вставленный в тело письма
      // текст бухгалтер не откроет таблицей
      files: [uri],
      dialogTitle: opts.dialogTitle ?? opts.title ?? name,
    })
    return { ok: true, how: 'share' }
  } catch (e) {
    const msg = (e as Error)?.message ?? ''
    // Закрытие диалога плагин тоже отдаёт исключением — это не сбой, и
    // показывать пользователю ошибку после его же отмены неправильно.
    if (/cancel/i.test(msg)) return { ok: false, how: 'cancelled' }
    return { ok: false, how: 'failed', message: msg }
  }
}
