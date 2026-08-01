// Слияние общего списка покупок — чистые функции (unit-тесты).
//
// ЗАЧЕМ ОТДЕЛЬНАЯ ЛОГИКА. Список правят ДВА человека одновременно: один в
// магазине отмечает купленное, другой дома дописывает товары. Победитель «по
// всему списку целиком» (last-write-wins) стёр бы половину работы: чей push
// пришёл вторым, того версия и осталась. Поэтому сливаем ПОЗИЦИЯМИ.
//
// Правила, и почему именно такие:
//  • новая позиция у любой стороны — сохраняется (потерять товар хуже, чем
//    показать лишний: лишний видно и легко убрать, потерянный не заметен);
//  • одна и та же позиция у обоих — берём свежую по updatedAt;
//  • удаление уважаем, но только если оно СВЕЖЕЕ правки: иначе «удалил, пока
//    другой дописывал» затирало бы дописанное;
//  • при равных штампах решаем детерминированно (по id), чтобы у двух
//    устройств не получилось разного результата из одних данных.

import type { ShoppingItem } from '../types'

/** Позиция общего списка: та же, что локально, плюс метки синхронизации. */
export interface SharedItem extends ShoppingItem {
  /** когда позицию последний раз меняли (ISO) */
  updatedAt?: string
  /** позиция удалена; строку не выкидываем сразу — иначе она вернётся
   *  с устройства, которое об удалении ещё не знает */
  deleted?: boolean
}

export interface SharedListState {
  name: string
  items: SharedItem[]
  /** штамп правки списка целиком (нужен для имени) */
  updatedAt?: string
}

/** Свежее ли a, чем b. Пустой штамп считаем самым старым. */
function newer(a?: string, b?: string): boolean {
  if (!a) return false
  if (!b) return true
  return a > b
}

/**
 * Устойчивое представление позиции — для развязки ничьи по штампу.
 *
 * Ключи сортируются: иначе одна и та же позиция, собранная в разном порядке
 * полей, дала бы разные строки и правило перестало быть детерминированным.
 */
function stable(item: SharedItem): string {
  const keys = Object.keys(item).sort()
  return JSON.stringify(keys.map((k) => [k, (item as unknown as Record<string, unknown>)[k]]))
}

/**
 * Сливает две версии общего списка. Симметрична: результат не зависит от
 * того, какую версию назвали «своей» — иначе два устройства пришли бы к
 * разным состояниям и расхождение зацикливалось бы.
 */
export function mergeSharedList(a: SharedListState, b: SharedListState): SharedListState {
  const byId = new Map<string, SharedItem>()

  const put = (item: SharedItem) => {
    const prev = byId.get(item.id)
    if (!prev) {
      byId.set(item.id, item)
      return
    }
    // свежая правка побеждает; при равенстве — детерминированно, чтобы
    // устройства не разошлись
    if (newer(item.updatedAt, prev.updatedAt)) {
      byId.set(item.id, item)
    } else if (!newer(prev.updatedAt, item.updatedAt)) {
      // Штампы равны (или оба пустые) — о том, кто новее, информации нет, и
      // одна правка неизбежно проиграет. Важно лишь, чтобы ОБА устройства
      // выбрали одинаково: иначе они разойдутся и будут догонять друг друга
      // бесконечно. Сначала удаление, затем — устойчивое сравнение
      // содержимого (по id разрешить нельзя: id у них один и тот же).
      if (item.deleted !== prev.deleted) {
        if (item.deleted) byId.set(item.id, item)
      } else if (stable(item) < stable(prev)) {
        byId.set(item.id, item)
      }
    }
  }

  for (const i of a.items) put(i)
  for (const i of b.items) put(i)

  // Имя списка — обычный last-write-wins: это одна строка, терять в ней
  // нечего, а сливать по буквам бессмысленно.
  const name = newer(a.updatedAt, b.updatedAt) ? a.name : newer(b.updatedAt, a.updatedAt) ? b.name : a.name

  return {
    name,
    updatedAt: newer(a.updatedAt, b.updatedAt) ? a.updatedAt : b.updatedAt,
    // порядок стабильный: без сортировки список «прыгал» бы после каждого
    // синка, потому что порядок ключей Map зависит от порядка вставки
    items: [...byId.values()].sort((x, y) => x.id.localeCompare(y.id)),
  }
}

/** Позиции для показа: без удалённых. */
export function visibleItems(items: SharedItem[]): SharedItem[] {
  return items.filter((i) => !i.deleted)
}

/**
 * Убрать давно удалённые позиции (сборка мусора).
 *
 * Держать «надгробия» вечно — расти файлу без предела; убирать сразу —
 * получить возврат позиции с устройства, которое об удалении не знает.
 * Компромисс: чистим то, что удалено давнее `days` дней.
 */
export function pruneDeleted(items: SharedItem[], nowISO: string, days = 30): SharedItem[] {
  const cutoff = new Date(new Date(nowISO).getTime() - days * 24 * 3600 * 1000).toISOString()
  return items.filter((i) => !i.deleted || !i.updatedAt || i.updatedAt > cutoff)
}
