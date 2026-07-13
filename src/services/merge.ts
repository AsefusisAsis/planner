import type { AppData, Expense } from '../types'
import { createEmptyData } from '../types'

// ============================================================
// 3-way merge: base (последний синхронизированный снимок), local, remote.
// Коллекции сливаются по id с корректной обработкой удалений; синглтоны —
// по принципу «изменённая сторона побеждает», при двойном изменении — local.
// Конфликт возникает только когда ОДНА И ТА ЖЕ запись правилась с двух
// устройств между синхронизациями — тогда берём локальную.
// Контейнеры с вложенными элементами (товары списка покупок, шаги задачи)
// сливаются рекурсивно: правки разных элементов одного контейнера с двух
// устройств не затирают друг друга.
// ============================================================

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Копия объекта без указанного ключа (для сравнения контейнера без детей). */
function omitKey(obj: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj }
  delete copy[key]
  return copy
}

/**
 * Базовые правила 3-way для набора записей по id (без порядка):
 * - есть с обеих сторон → resolveBoth (по умолчанию: local не менялся → remote, иначе local)
 * - удалено на одной стороне → сохраняем только если другая сторона добавила/изменила
 */
function keep3<T extends { id: string }>(
  bMap: Map<string, T>,
  lMap: Map<string, T>,
  rMap: Map<string, T>,
  resolveBoth: (b: T | undefined, l: T, r: T) => T,
): Map<string, T> {
  const keep = new Map<string, T>()
  const ids = new Set<string>([...lMap.keys(), ...rMap.keys()])
  for (const id of ids) {
    const b = bMap.get(id)
    const l = lMap.get(id)
    const r = rMap.get(id)
    if (l && r) {
      keep.set(id, resolveBoth(b, l, r))
    } else if (l && !r) {
      // удалено на remote. Сохраняем только если локально добавлено/изменено.
      if (!b || !eq(l, b)) keep.set(id, l)
    } else if (!l && r) {
      // удалено локально. Сохраняем только если на remote добавлено/изменено.
      if (!b || !eq(r, b)) keep.set(id, r)
    }
  }
  return keep
}

const localWins = <T,>(b: T | undefined, l: T, r: T): T => (b && eq(l, b) ? r : l)

// ДЕТЕРМИНИРОВАННЫЙ порядок (одинаковый на всех устройствах), иначе массив
// переупорядочивается при каждом синке и данные «скачут» между устройствами.
// Сортируем по createdAt/date (новые сверху), затем по id для стабильности.
// (Экспортируется: облачный синк сортирует коллекции после применения правок.)
export function sortDeterministic<T extends { id: string }>(items: Iterable<T>): T[] {
  const sortKey = (x: T) =>
    (x as { createdAt?: string; date?: string }).createdAt ??
    (x as { createdAt?: string; date?: string }).date ??
    ''
  return [...items].sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    if (ka !== kb) return ka < kb ? 1 : -1 // по убыванию (новые сверху)
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function mergeCollection<T extends { id: string }>(
  base: T[] = [],
  local: T[] = [],
  remote: T[] = [],
): T[] {
  const keep = keep3(
    new Map(base.map((x) => [x.id, x])),
    new Map(local.map((x) => [x.id, x])),
    new Map(remote.map((x) => [x.id, x])),
    localWins,
  )
  return sortDeterministic(keep.values())
}

/**
 * Вложенные элементы (товары, шаги): у них нет createdAt, а id случайные,
 * поэтому сортировать нельзя — порядок «поплывёт». Детерминированный порядок:
 * общие элементы в порядке remote, локальные добавления — в конец в локальном
 * порядке. Это сохраняет привычный порядок и сходится между устройствами.
 * (Экспортируется: облачный синк использует её для конфликтов списков;
 * resolve позволяет задать детерминированный выбор спорного элемента.)
 */
export function mergeChildren<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  resolve: (b: T | undefined, l: T, r: T) => T = localWins,
): T[] {
  const keep = keep3(
    new Map(base.map((x) => [x.id, x])),
    new Map(local.map((x) => [x.id, x])),
    new Map(remote.map((x) => [x.id, x])),
    resolve,
  )
  const out: T[] = []
  for (const x of [...remote, ...local]) {
    const kept = keep.get(x.id)
    if (kept) {
      out.push(kept)
      keep.delete(x.id)
    }
  }
  return out
}

/**
 * Коллекция контейнеров с вложенными элементами. Скалярные поля контейнера
 * сравниваются БЕЗ детей (переименование списка на одном устройстве и отметка
 * товара на другом — не конфликт), дети сливаются рекурсивно через mergeChildren.
 */
function mergeWithChildren<
  K extends string,
  C extends { id: string },
  T extends { id: string } & Partial<Record<K, C[]>>,
>(base: T[] = [], local: T[] = [], remote: T[] = [], kidKey: K): T[] {
  const keep = keep3(
    new Map(base.map((x) => [x.id, x])),
    new Map(local.map((x) => [x.id, x])),
    new Map(remote.map((x) => [x.id, x])),
    (b, l, r) => {
      const scalarEq = (x: T, y: T) => eq(omitKey(x, kidKey), omitKey(y, kidKey))
      const winner = b && scalarEq(l, b) ? r : l
      // ни одна сторона не имеет детей — не навязываем пустой массив
      if (l[kidKey] === undefined && r[kidKey] === undefined) return winner
      const kids = mergeChildren<C>(b?.[kidKey] ?? [], l[kidKey] ?? [], r[kidKey] ?? [])
      return { ...winner, [kidKey]: kids } as T
    },
  )
  return sortDeterministic(keep.values())
}

/**
 * Дубли автоначислений: два устройства могли ОФЛАЙН начислить одну и ту же
 * повторяющуюся трату с разными id — после merge остались бы обе. Ключ дубля —
 * (sourceRecurringId, date): дата генерируется одинаково на всех устройствах.
 * Оставляем детерминированно одну (min createdAt, затем min id), чтобы
 * устройства сходились к одному результату.
 * (Экспортируется: облачный синк схлопывает те же дубли после pull.)
 */
export function dedupeRecurring(expenses: Expense[]): Expense[] {
  const best = new Map<string, Expense>()
  for (const e of expenses) {
    if (!e.sourceRecurringId) continue
    const key = `${e.sourceRecurringId}|${e.date}`
    const cur = best.get(key)
    if (!cur || e.createdAt < cur.createdAt || (e.createdAt === cur.createdAt && e.id < cur.id)) {
      best.set(key, e)
    }
  }
  return expenses.filter(
    (e) => !e.sourceRecurringId || best.get(`${e.sourceRecurringId}|${e.date}`) === e,
  )
}

function pick3<T>(base: T, local: T, remote: T): T {
  if (eq(local, base)) return remote
  if (eq(remote, base)) return local
  return local
}

/** Равны ли два документа по СОДЕРЖИМОМУ (без учёта updatedAt). */
export function sameContent(a: AppData, b: AppData): boolean {
  return JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' })
}

export function merge3(baseIn: AppData | null, localIn: AppData, remoteIn: AppData): AppData {
  // нормализуем под актуальную схему (старые снимки могут не иметь новых полей)
  const local = { ...createEmptyData(), ...localIn }
  const remote = { ...createEmptyData(), ...remoteIn }
  // Нет base (первый синк на устройстве / после переподключения) — базой служит
  // ПУСТОЙ документ: локальные записи трактуются как «добавленные» и выживают.
  // Подстановка local в base превращала бы merge в разрушительный 2-way:
  // несинхронизированные локальные записи выглядели бы как «удалённые на remote».
  const base = baseIn ? { ...createEmptyData(), ...baseIn } : createEmptyData()

  return {
    version: Math.max(local.version, remote.version),
    expenses: dedupeRecurring(mergeCollection(base.expenses, local.expenses, remote.expenses)),
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
    homeTasks: mergeWithChildren(base.homeTasks, local.homeTasks, remote.homeTasks, 'steps'),
    shoppingLists: mergeWithChildren(
      base.shoppingLists,
      local.shoppingLists,
      remote.shoppingLists,
      'items',
    ),
    calendarTasks: mergeCollection(base.calendarTasks, local.calendarTasks, remote.calendarTasks),
    weightLog: mergeCollection(base.weightLog, local.weightLog, remote.weightLog),
    waterLog: mergeCollection(base.waterLog, local.waterLog, remote.waterLog),
    measurements: mergeCollection(base.measurements, local.measurements, remote.measurements),
    foodLog: mergeCollection(base.foodLog, local.foodLog, remote.foodLog),
    workoutLog: mergeCollection(base.workoutLog, local.workoutLog, remote.workoutLog),
    cycleLog: mergeCollection(base.cycleLog, local.cycleLog, remote.cycleLog),
    cards: mergeCollection(base.cards, local.cards, remote.cards),
    cardSecurity: pick3(base.cardSecurity, local.cardSecurity, remote.cardSecurity),
    healthProfile: pick3(base.healthProfile, local.healthProfile, remote.healthProfile),
    fitnessPrefs: pick3(base.fitnessPrefs, local.fitnessPrefs, remote.fitnessPrefs),
    settings: pick3(base.settings, local.settings, remote.settings),
    dashboardWidgets: pick3(base.dashboardWidgets, local.dashboardWidgets, remote.dashboardWidgets),
    updatedAt: new Date().toISOString(),
  }
}
