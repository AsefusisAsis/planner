// ============================================================
// Облачная синхронизация через Supabase (таблица records, RLS).
// Принцип local-first: интерфейс всегда работает с локальными данными,
// облако — точка синхронизации между устройствами.
//
// Механика:
// - каждое изменение записи штампуется updatedAt и попадает в outbox
//   (ВСЕГДА, даже без аккаунта — правки при протухшей сессии не теряются);
// - push: upsert записей outbox по ключу (user, collection, id); id записей
//   сохраняются с устройства, поэтому перенос/повтор идемпотентны (нет дублей);
//   запись убирается из outbox только если её штамп не изменился за время
//   сетевого ожидания (правка во время push не потеряется);
// - pull: сначала СЕТЬ (fetchCloudRows), потом СИНХРОННОЕ применение к свежим
//   данным (applyCloudRows) — правка во время сетевого ожидания не откатится.
//   Пагинация дочитывает группы с равным server_updated_at целиком, курсор
//   отступает на 30с назад (видимость параллельных коммитов), повторное
//   применение идемпотентно;
// - конфликт: новее по updatedAt — победил; у списков/задач вложенные
//   элементы сливаются, спорные дети берутся со стороны победителя
//   (детерминированно — устройства сходятся);
// - удаления — tombstone (deleted=true), локальная правка переживает
//   чужое удаление (та же политика, что в GitHub-синке);
// - дубли офлайн-автоначислений схлопываются после pull (как в merge3),
//   лишняя копия тумбстоунится.
// ============================================================

import { supabase } from './supabase'
import { mergeChildren, sortDeterministic, dedupeRecurring } from './merge'
import type { AppData, Expense } from '../types'

const COLLECTIONS = [
  'expenses',
  'expenseCategories',
  'recurringExpenses',
  'homeTasks',
  'shoppingLists',
  'calendarTasks',
  'weightLog',
  'waterLog',
  'measurements',
  'foodLog',
  'workoutLog',
  'cards',
] as const
type CollectionKey = (typeof COLLECTIONS)[number]

const SINGLETONS = [
  'settings',
  'healthProfile',
  'fitnessPrefs',
  'cardSecurity',
  'dashboardWidgets',
] as const
type SingletonKey = (typeof SINGLETONS)[number]

/** Общий вид записи для слоя синка (конкретные типы — в types.ts). */
interface Rec {
  id: string
  updatedAt?: string
  createdAt?: string
  date?: string
}

interface OutboxEntry {
  c: string // имя коллекции или 'singleton'
  id: string
  del?: boolean
  /** штамп момента постановки — защита от потери правок во время push */
  at: string
}

interface ServerRow {
  collection: string
  id: string
  payload: Record<string, unknown>
  updated_at: string
  server_updated_at: string
  deleted: boolean
}

const OUTBOX_KEY = 'planner.cloud.outbox'
const CURSOR_KEY = 'planner.cloud.cursor'
const STAMPS_KEY = 'planner.cloud.singletonStamps'
const USER_KEY = 'planner.cloud.user'

/** Отступ курсора назад: строка, закоммиченная позже, может иметь штамп
 *  раньше уже увиденных (время ставится в начале транзакции). */
const CURSOR_BACKOFF_MS = 30_000

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const nowISO = () => new Date().toISOString()

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const readOutbox = () => readJSON<Record<string, OutboxEntry>>(OUTBOX_KEY, {})
const writeOutbox = (o: Record<string, OutboxEntry>) =>
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(o))
const readStamps = () => readJSON<Record<string, string>>(STAMPS_KEY, {})
const writeStamps = (s: Record<string, string>) =>
  localStorage.setItem(STAMPS_KEY, JSON.stringify(s))

export function clearCloudState(): void {
  localStorage.removeItem(OUTBOX_KEY)
  localStorage.removeItem(CURSOR_KEY)
  localStorage.removeItem(STAMPS_KEY)
}

export function hasPendingCloud(): boolean {
  return Object.keys(readOutbox()).length > 0
}

/** id пользователя, входившего на этом устройстве (защита от смешивания данных). */
export const getLastCloudUser = () => localStorage.getItem(USER_KEY)
export const setLastCloudUser = (uid: string) => localStorage.setItem(USER_KEY, uid)

const recs = (d: AppData, c: CollectionKey) => d[c] as unknown as Rec[]

/**
 * Сравнить prev/next, проштамповать изменённым записям updatedAt и записать
 * изменения в outbox. Вызывается из store.mutate и после GitHub-merge.
 */
export function diffAndStamp(prev: AppData, next: AppData): void {
  const outbox = readOutbox()
  const stamp = nowISO()
  let outboxChanged = false

  for (const c of COLLECTIONS) {
    const before = new Map(recs(prev, c).map((x) => [x.id, x]))
    const after = recs(next, c)
    const afterIds = new Set<string>()
    for (const rec of after) {
      afterIds.add(rec.id)
      const old = before.get(rec.id)
      if (!old || !eq(old, rec)) {
        rec.updatedAt = stamp
        outbox[`${c}|${rec.id}`] = { c, id: rec.id, at: stamp }
        outboxChanged = true
      }
    }
    for (const [id] of before) {
      if (!afterIds.has(id)) {
        outbox[`${c}|${id}`] = { c, id, del: true, at: stamp }
        outboxChanged = true
      }
    }
  }

  const stamps = readStamps()
  let stampsChanged = false
  for (const s of SINGLETONS) {
    if (!eq(prev[s], next[s])) {
      stamps[s] = stamp
      stampsChanged = true
      outbox[`singleton|${s}`] = { c: 'singleton', id: s, at: stamp }
      outboxChanged = true
    }
  }
  if (stampsChanged) writeStamps(stamps)
  if (outboxChanged) writeOutbox(outbox)
}

/**
 * Пометить ВСЁ содержимое на выгрузку (первичный перенос / восстановление
 * бэкапа). restamp=true обновляет updatedAt всех записей — восстановленный
 * бэкап побеждает облако при конфликтах. Возвращает число записей коллекций.
 */
export function stageAllForUpload(data: AppData, restamp = false): number {
  const outbox = readOutbox()
  const stamp = nowISO()
  let count = 0
  for (const c of COLLECTIONS) {
    for (const rec of recs(data, c)) {
      if (restamp) rec.updatedAt = stamp
      outbox[`${c}|${rec.id}`] = { c, id: rec.id, at: rec.updatedAt ?? stamp }
      count += 1
    }
  }
  const stamps = readStamps()
  for (const s of SINGLETONS) {
    if (restamp || !stamps[s]) stamps[s] = stamp
    outbox[`singleton|${s}`] = { c: 'singleton', id: s, at: stamps[s] }
  }
  writeStamps(stamps)
  writeOutbox(outbox)
  return count
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Не выполнен вход в аккаунт')
  return id
}

/** Выгрузить накопленные изменения. Ошибка — исключение (outbox сохраняется). */
export async function cloudPush(data: AppData): Promise<number> {
  // снимок outbox и построение строк — СИНХРОННО, до сетевых ожиданий
  const outbox = readOutbox()
  const snapshot = Object.entries(outbox).map(([key, e]) => ({ key, e }))
  if (snapshot.length === 0) return 0
  const stamps = readStamps()

  const buildRow = (e: OutboxEntry, uid: string) => {
    if (e.c === 'singleton') {
      const s = e.id as SingletonKey
      const at = stamps[s] ?? nowISO()
      return {
        user_id: uid,
        collection: 'singleton',
        id: s,
        payload: { v: data[s] ?? null, updatedAt: at },
        updated_at: at,
        deleted: false,
      }
    }
    const rec = recs(data, e.c as CollectionKey).find((x) => x.id === e.id)
    if (!rec || e.del) {
      return {
        user_id: uid,
        collection: e.c,
        id: e.id,
        payload: {},
        updated_at: e.at,
        deleted: true,
      }
    }
    return {
      user_id: uid,
      collection: e.c,
      id: e.id,
      payload: rec as unknown as Record<string, unknown>,
      updated_at: rec.updatedAt ?? rec.createdAt ?? e.at,
      deleted: false,
    }
  }

  const uid = await userId()
  const rows = snapshot.map(({ e }) => buildRow(e, uid))

  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from('records').upsert(rows.slice(i, i + 400))
    if (error) throw new Error(`Облако: ${error.message}`)
  }

  // чистим outbox ТОЛЬКО от неизменившихся записей: если запись правили,
  // пока шёл push, её новый штамп не совпадёт — она уедет следующим синком
  const fresh = readOutbox()
  for (const { key, e } of snapshot) {
    if (fresh[key] && fresh[key].at === e.at) delete fresh[key]
  }
  writeOutbox(fresh)
  return snapshot.length
}

/** Свежесть записи для выбора победителя при конфликте. */
const recStamp = (r: Rec) => r.updatedAt ?? r.createdAt ?? r.date ?? ''

/**
 * СЕТЕВАЯ фаза pull: скачать изменения с сервера. Ничего не применяет.
 * Дочитывает группы равных server_updated_at целиком (граница страницы
 * не может отрезать хвост группы), дедуплицирует строки.
 */
export async function fetchCloudRows(): Promise<{ rows: ServerRow[]; cursor: string | null }> {
  const since = localStorage.getItem(CURSOR_KEY) ?? '1970-01-01T00:00:00Z'
  const byKey = new Map<string, ServerRow>()
  let from = since
  let maxStamp: string | null = null

  for (;;) {
    const { data: batch, error } = await supabase
      .from('records')
      .select('collection,id,payload,updated_at,server_updated_at,deleted')
      .gt('server_updated_at', from)
      .order('server_updated_at', { ascending: true })
      .order('collection', { ascending: true })
      .order('id', { ascending: true })
      .limit(1000)
    if (error) throw new Error(`Облако: ${error.message}`)
    if (!batch || batch.length === 0) break
    for (const r of batch as ServerRow[]) byKey.set(`${r.collection}|${r.id}`, r)
    const last = (batch[batch.length - 1] as ServerRow).server_updated_at
    maxStamp = last
    if (batch.length < 1000) break
    // граница страницы могла разрезать группу с одинаковым штампом — дочитываем её целиком
    for (let off = 0; ; off += 1000) {
      const { data: extra, error: e2 } = await supabase
        .from('records')
        .select('collection,id,payload,updated_at,server_updated_at,deleted')
        .eq('server_updated_at', last)
        .order('collection', { ascending: true })
        .order('id', { ascending: true })
        .range(off, off + 999)
      if (e2) throw new Error(`Облако: ${e2.message}`)
      for (const r of (extra ?? []) as ServerRow[]) byKey.set(`${r.collection}|${r.id}`, r)
      if (!extra || extra.length < 1000) break
    }
    from = last
  }

  const rows = [...byKey.values()].sort((a, b) =>
    a.server_updated_at < b.server_updated_at ? -1 : a.server_updated_at > b.server_updated_at ? 1 : 0,
  )
  // курсор с отступом назад: параллельный коммит мог получить штамп «в прошлом»
  let cursor: string | null = null
  if (maxStamp) {
    const backed = new Date(Date.parse(maxStamp) - CURSOR_BACKOFF_MS).toISOString()
    cursor = backed > since ? backed : since
  }
  return { rows, cursor }
}

/**
 * СИНХРОННАЯ фаза pull: применить скачанные строки к АКТУАЛЬНЫМ данным.
 * Вызывать сразу после fetchCloudRows, без await между get().data и persist.
 */
export function applyCloudRows(
  current: AppData,
  rows: ServerRow[],
): { data: AppData; changed: boolean } {
  const outbox = readOutbox()
  const stamps = readStamps()
  const next = structuredClone(current)
  let changed = false
  let outboxChanged = false
  const touched = new Set<CollectionKey>()

  for (const row of rows) {
    if (row.collection === 'singleton') {
      const s = row.id as SingletonKey
      if (!SINGLETONS.includes(s)) continue
      const payload = row.payload as { v?: unknown; updatedAt?: string }
      const remoteAt = payload.updatedAt ?? row.updated_at
      const localAt = stamps[s] ?? ''
      // честный LWW и для «грязного» синглтона: свежее побеждает
      if (remoteAt > localAt) {
        ;(next as unknown as Record<string, unknown>)[s] = payload.v ?? null
        stamps[s] = remoteAt
        if (outbox[`singleton|${s}`]) {
          delete outbox[`singleton|${s}`]
          outboxChanged = true
        }
        changed = true
      }
      continue
    }

    const c = row.collection as CollectionKey
    if (!COLLECTIONS.includes(c)) continue
    const arr = recs(next, c)
    const idx = arr.findIndex((x) => x.id === row.id)
    const dirty = !!outbox[`${c}|${row.id}`]

    if (row.deleted) {
      // локальная правка переживает чужое удаление (политика edit-wins)
      if (!dirty && idx >= 0) {
        arr.splice(idx, 1)
        changed = true
      }
      continue
    }

    const remote = row.payload as unknown as Rec
    if (idx < 0) {
      arr.push(remote)
      touched.add(c)
      changed = true
    } else {
      const local = arr[idx]
      if (eq(local, remote)) continue
      if (!dirty) {
        arr[idx] = remote
        changed = true
      } else {
        // конфликт: правили с двух сторон. Победитель — по штампу
        // (при равенстве — детерминированный тай-брейк по содержимому,
        // чтобы устройства сошлись к одному результату)
        const ls = recStamp(local)
        const rs = recStamp(remote)
        const preferRemote =
          rs > ls || (rs === ls && JSON.stringify(remote) > JSON.stringify(local))
        const winner = preferRemote ? remote : local
        if (c === 'shoppingLists' || c === 'homeTasks') {
          const key = c === 'shoppingLists' ? 'items' : 'steps'
          const l = (local as unknown as Record<string, Rec[] | undefined>)[key]
          const r = (remote as unknown as Record<string, Rec[] | undefined>)[key]
          const merged = { ...winner } as unknown as Record<string, unknown>
          if (l !== undefined || r !== undefined) {
            // спорные дети — со стороны победителя контейнера (детерминированно)
            merged[key] = mergeChildren([], l ?? [], r ?? [], (_b, li, ri) =>
              preferRemote ? ri : li,
            )
          }
          arr[idx] = merged as unknown as Rec
        } else {
          arr[idx] = winner
        }
        changed = true
        // запись остаётся в outbox — слитый результат уедет на сервер
      }
    }
  }

  // дубли офлайн-автоначислений (два устройства начислили одну повторяющуюся
  // трату с разными id): схлопываем как в merge3, лишнюю копию тумбстоуним
  const dedupedExpenses = dedupeRecurring(next.expenses as Expense[])
  if (dedupedExpenses.length !== next.expenses.length) {
    const keep = new Set(dedupedExpenses.map((e) => e.id))
    for (const e of next.expenses as Expense[]) {
      if (!keep.has(e.id)) {
        outbox[`expenses|${e.id}`] = { c: 'expenses', id: e.id, del: true, at: nowISO() }
        outboxChanged = true
      }
    }
    next.expenses = dedupedExpenses
    changed = true
  }

  for (const c of touched) {
    ;(next as unknown as Record<string, unknown>)[c] = sortDeterministic(recs(next, c))
  }
  writeStamps(stamps)
  if (outboxChanged) writeOutbox(outbox)

  return { data: next, changed }
}

export function saveCursor(cursor: string | null): void {
  if (cursor) localStorage.setItem(CURSOR_KEY, cursor)
}

/** Количество записей на сервере (для мастера переноса). */
export async function serverCounts(): Promise<{ total: number }> {
  const { count, error } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('deleted', false)
    .neq('collection', 'singleton')
  if (error) throw new Error(`Облако: ${error.message}`)
  return { total: count ?? 0 }
}

/** Количество локальных записей (для мастера переноса). */
export function localCounts(data: AppData): { total: number } {
  let total = 0
  for (const c of COLLECTIONS) total += recs(data, c).length
  return { total }
}
