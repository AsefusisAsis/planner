import type { AppData } from '../types'
import { createEmptyData } from '../types'

// ============================================================
// 3-way merge: base (последний синхронизированный снимок), local, remote.
// Коллекции сливаются по id с корректной обработкой удалений; синглтоны —
// по принципу «изменённая сторона побеждает», при двойном изменении — local.
// Конфликт возникает только когда ОДНА И ТА ЖЕ запись правилась с двух
// устройств между синхронизациями — тогда берём локальную.
// ============================================================

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeCollection<T extends { id: string }>(
  base: T[] = [],
  local: T[] = [],
  remote: T[] = [],
): T[] {
  const bMap = new Map(base.map((x) => [x.id, x]))
  const lMap = new Map(local.map((x) => [x.id, x]))
  const rMap = new Map(remote.map((x) => [x.id, x]))
  const keep = new Map<string, T>()

  const ids = new Set<string>([...lMap.keys(), ...rMap.keys()])
  for (const id of ids) {
    const b = bMap.get(id)
    const l = lMap.get(id)
    const r = rMap.get(id)
    if (l && r) {
      // есть с обеих сторон: если локальная не менялась относительно base — берём remote
      keep.set(id, b && eq(l, b) ? r : l)
    } else if (l && !r) {
      // удалено на remote. Сохраняем только если локально добавлено/изменено.
      if (!b || !eq(l, b)) keep.set(id, l)
    } else if (!l && r) {
      // удалено локально. Сохраняем только если на remote добавлено/изменено.
      if (!b || !eq(r, b)) keep.set(id, r)
    }
  }

  // порядок: сначала по локальному порядку, затем уникальные из remote
  const out: T[] = []
  for (const x of local) {
    const v = keep.get(x.id)
    if (v) {
      out.push(v)
      keep.delete(x.id)
    }
  }
  for (const x of remote) {
    const v = keep.get(x.id)
    if (v) {
      out.push(v)
      keep.delete(x.id)
    }
  }
  return out
}

function pick3<T>(base: T, local: T, remote: T): T {
  if (eq(local, base)) return remote
  if (eq(remote, base)) return local
  return local
}

export function merge3(baseIn: AppData | null, localIn: AppData, remoteIn: AppData): AppData {
  // нормализуем под актуальную схему (старые снимки могут не иметь новых полей)
  const local = { ...createEmptyData(), ...localIn }
  const remote = { ...createEmptyData(), ...remoteIn }
  const base = { ...createEmptyData(), ...(baseIn ?? localIn) }

  return {
    version: Math.max(local.version, remote.version),
    expenses: mergeCollection(base.expenses, local.expenses, remote.expenses),
    expenseCategories: mergeCollection(
      base.expenseCategories,
      local.expenseCategories,
      remote.expenseCategories,
    ),
    recurringExpenses: mergeCollection(
      base.recurringExpenses,
      local.recurringExpenses,
      remote.recurringExpenses,
    ),
    homeTasks: mergeCollection(base.homeTasks, local.homeTasks, remote.homeTasks),
    shoppingLists: mergeCollection(base.shoppingLists, local.shoppingLists, remote.shoppingLists),
    calendarTasks: mergeCollection(base.calendarTasks, local.calendarTasks, remote.calendarTasks),
    weightLog: mergeCollection(base.weightLog, local.weightLog, remote.weightLog),
    waterLog: mergeCollection(base.waterLog, local.waterLog, remote.waterLog),
    measurements: mergeCollection(base.measurements, local.measurements, remote.measurements),
    foodLog: mergeCollection(base.foodLog, local.foodLog, remote.foodLog),
    workoutLog: mergeCollection(base.workoutLog, local.workoutLog, remote.workoutLog),
    cards: mergeCollection(base.cards, local.cards, remote.cards),
    cardSecurity: pick3(base.cardSecurity, local.cardSecurity, remote.cardSecurity),
    healthProfile: pick3(base.healthProfile, local.healthProfile, remote.healthProfile),
    fitnessPrefs: pick3(base.fitnessPrefs, local.fitnessPrefs, remote.fitnessPrefs),
    settings: pick3(base.settings, local.settings, remote.settings),
    updatedAt: new Date().toISOString(),
  }
}
