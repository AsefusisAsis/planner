// ============================================================
// Синхронизация data.json через GitHub Contents API.
// Работает прямо из браузера (CORS поддерживается).
// ============================================================

import type { AppData } from '../types'
import type { GitHubConfig } from '../lib/localConfig'
import i18n from '../i18n'

const API = 'https://api.github.com'

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// base64 <-> UTF-8 (btoa не умеет кириллицу напрямую)
function encodeContent(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function decodeContent(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export interface PullResult {
  data: AppData | null
  sha: string | null
  /** true если файла ещё нет в репозитории */
  notFound: boolean
}

/** Читает data.json. Если файла нет — notFound:true. */
export async function pull(cfg: GitHubConfig): Promise<PullResult> {
  // Обход кэша: уникальный параметр + no-store + no-cache,
  // иначе GET может вернуть устаревший SHA и любая запись будет 409.
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(
    cfg.path,
  )}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`
  // no-store + уникальный URL обходят кэш, НЕ добавляя заголовков (иначе ломается CORS-preflight GitHub).
  const res = await fetch(url, { headers: headers(cfg.token), cache: 'no-store' })

  if (res.status === 404) return { data: null, sha: null, notFound: true }
  if (!res.ok) throw await httpError(res)

  const body = await res.json()
  const json = decodeContent(body.content)
  return { data: JSON.parse(json) as AppData, sha: body.sha, notFound: false }
}

/**
 * Записывает data.json. sha обязателен при обновлении существующего файла;
 * при создании — null/undefined. Возвращает новый sha.
 */
export async function push(
  cfg: GitHubConfig,
  data: AppData,
  sha: string | null,
): Promise<string> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(
    cfg.path,
  )}`
  const content = encodeContent(JSON.stringify(data, null, 2))
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `sync ${new Date().toISOString()}`,
      content,
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  })

  if (!res.ok) throw await httpError(res)
  const body = await res.json()
  return body.content.sha as string
}

/** Проверка доступа: дергаем сам репозиторий. */
export async function testConnection(cfg: GitHubConfig): Promise<true> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}`
  const res = await fetch(url, { headers: headers(cfg.token) })
  if (!res.ok) throw await httpError(res)
  return true
}

// Подсказки к типовым статусам на обоих языках приложения
const STATUS_HINTS: Record<number, { ru: string; en: string }> = {
  401: { ru: 'неверный или истёкший токен', en: 'invalid or expired token' },
  403: { ru: 'нет прав / лимит запросов', en: 'no access / rate limit' },
  409: { ru: 'конфликт версий', en: 'version conflict' },
}

async function describeError(res: Response, lang: 'ru' | 'en' = 'ru'): Promise<string> {
  let msg = `GitHub ${res.status}`
  try {
    const j = (await res.json()) as { message?: string }
    if (j.message) msg += `: ${j.message}`
  } catch {
    /* ignore */
  }
  const hint = STATUS_HINTS[res.status]
  if (hint) msg += ` (${hint[lang]})`
  return msg
}

/** Ошибка с HTTP-статусом, чтобы вызывающий код мог обработать, например, 409. */
export type HttpError = Error & { status: number }

async function httpError(res: Response): Promise<HttpError> {
  // сообщение собираем на текущем языке UI — дальше оно уходит в sync.error как есть
  const lang = i18n.language === 'en' ? 'en' : 'ru'
  const err = new Error(await describeError(res, lang)) as HttpError
  err.status = res.status
  return err
}
