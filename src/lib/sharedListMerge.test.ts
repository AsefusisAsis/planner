import { describe, it, expect } from 'vitest'
import {
  mergeSharedList,
  pruneDeleted,
  visibleItems,
  type SharedItem,
  type SharedListState,
} from './sharedListMerge'

const it_ = (over: Partial<SharedItem> & { id: string }): SharedItem => ({
  name: over.id,
  qty: 1,
  bought: false,
  ...over,
})

const list = (items: SharedItem[], name = 'Продукты', updatedAt?: string): SharedListState => ({
  name,
  items,
  updatedAt,
})

describe('mergeSharedList / ничего не теряем', () => {
  it('ГЛАВНОЕ: оба дописали разное — сохраняются обе позиции', () => {
    // он в магазине добавил хлеб, она дома добавила молоко
    const mine = list([it_({ id: 'bread', updatedAt: '2026-08-01T10:00:00Z' })])
    const theirs = list([it_({ id: 'milk', updatedAt: '2026-08-01T10:01:00Z' })])
    const m = mergeSharedList(mine, theirs)
    expect(m.items.map((i) => i.id).sort()).toEqual(['bread', 'milk'])
  })

  it('отметка «куплено» у одного не откатывается версией другого', () => {
    const shop = list([it_({ id: 'milk', bought: true, updatedAt: '2026-08-01T12:00:00Z' })])
    const home = list([it_({ id: 'milk', bought: false, updatedAt: '2026-08-01T11:00:00Z' })])
    expect(mergeSharedList(shop, home).items[0].bought).toBe(true)
    // и в обратном порядке — результат тот же
    expect(mergeSharedList(home, shop).items[0].bought).toBe(true)
  })

  it('слияние симметрично: порядок аргументов не меняет результат', () => {
    const a = list(
      [it_({ id: 'a', updatedAt: '2026-08-01T10:00:00Z' }), it_({ id: 'b', qty: 2, updatedAt: '2026-08-01T10:05:00Z' })],
      'Список A',
      '2026-08-01T10:05:00Z',
    )
    const b = list(
      [it_({ id: 'b', qty: 5, updatedAt: '2026-08-01T10:04:00Z' }), it_({ id: 'c', updatedAt: '2026-08-01T10:06:00Z' })],
      'Список B',
      '2026-08-01T10:01:00Z',
    )
    expect(mergeSharedList(a, b)).toEqual(mergeSharedList(b, a))
  })
})

describe('mergeSharedList / удаление', () => {
  it('свежее удаление побеждает старую правку', () => {
    const del = list([it_({ id: 'milk', deleted: true, updatedAt: '2026-08-01T12:00:00Z' })])
    const old = list([it_({ id: 'milk', qty: 3, updatedAt: '2026-08-01T11:00:00Z' })])
    expect(mergeSharedList(del, old).items[0].deleted).toBe(true)
  })

  it('СТАРОЕ удаление НЕ затирает свежую правку', () => {
    // «удалил, пока другой дописывал» — дописанное должно выжить
    const del = list([it_({ id: 'milk', deleted: true, updatedAt: '2026-08-01T11:00:00Z' })])
    const edit = list([it_({ id: 'milk', qty: 3, updatedAt: '2026-08-01T12:00:00Z' })])
    const m = mergeSharedList(del, edit)
    expect(m.items[0].deleted).toBeFalsy()
    expect(m.items[0].qty).toBe(3)
  })

  it('удалённые не показываются, но остаются в данных', () => {
    const m = mergeSharedList(
      list([it_({ id: 'a' }), it_({ id: 'b', deleted: true })]),
      list([]),
    )
    expect(m.items).toHaveLength(2)
    expect(visibleItems(m.items).map((i) => i.id)).toEqual(['a'])
  })
})

describe('mergeSharedList / детерминированность', () => {
  it('при равных штампах результат одинаков на обоих устройствах', () => {
    const ts = '2026-08-01T10:00:00Z'
    const a = list([it_({ id: 'x', qty: 1, updatedAt: ts })])
    const b = list([it_({ id: 'x', qty: 9, updatedAt: ts })])
    expect(mergeSharedList(a, b)).toEqual(mergeSharedList(b, a))
  })

  it('при равных штампах удаление приоритетнее правки', () => {
    const ts = '2026-08-01T10:00:00Z'
    const a = list([it_({ id: 'x', updatedAt: ts })])
    const b = list([it_({ id: 'x', deleted: true, updatedAt: ts })])
    expect(mergeSharedList(a, b).items[0].deleted).toBe(true)
    expect(mergeSharedList(b, a).items[0].deleted).toBe(true)
  })

  it('слияние идемпотентно: повторные синки сходятся, а не качаются', () => {
    // если merge(merge(a,b), b) != merge(a,b), устройства гоняли бы правки
    // друг другу по кругу
    const a = list(
      [it_({ id: 'x', qty: 1, updatedAt: '2026-08-01T10:00:00Z' }), it_({ id: 'y' })],
      'A',
      '2026-08-01T10:00:00Z',
    )
    const b = list(
      [it_({ id: 'x', qty: 9, updatedAt: '2026-08-01T10:00:00Z' }), it_({ id: 'z', deleted: true })],
      'B',
      '2026-08-01T09:00:00Z',
    )
    const once = mergeSharedList(a, b)
    expect(mergeSharedList(once, b)).toEqual(once)
    expect(mergeSharedList(once, a)).toEqual(once)
    expect(mergeSharedList(once, once)).toEqual(once)
  })

  it('порядок позиций стабилен — список не «прыгает» после синка', () => {
    const a = list([it_({ id: 'zebra' }), it_({ id: 'apple' })])
    const b = list([it_({ id: 'milk' })])
    expect(mergeSharedList(a, b).items.map((i) => i.id)).toEqual(['apple', 'milk', 'zebra'])
  })

  it('позиция без штампа не вытесняет позицию со штампом', () => {
    const stamped = list([it_({ id: 'x', qty: 7, updatedAt: '2026-08-01T10:00:00Z' })])
    const bare = list([it_({ id: 'x', qty: 1 })])
    expect(mergeSharedList(stamped, bare).items[0].qty).toBe(7)
    expect(mergeSharedList(bare, stamped).items[0].qty).toBe(7)
  })
})

describe('mergeSharedList / имя списка', () => {
  it('берётся из свежей версии', () => {
    const a = list([], 'Новое имя', '2026-08-01T12:00:00Z')
    const b = list([], 'Старое имя', '2026-08-01T10:00:00Z')
    expect(mergeSharedList(a, b).name).toBe('Новое имя')
    expect(mergeSharedList(b, a).name).toBe('Новое имя')
  })
})

describe('pruneDeleted', () => {
  const now = '2026-08-01T00:00:00Z'
  it('давние надгробия убираются', () => {
    const items = [it_({ id: 'old', deleted: true, updatedAt: '2026-06-01T00:00:00Z' })]
    expect(pruneDeleted(items, now)).toEqual([])
  })
  it('свежие удаления сохраняются — иначе позиция вернётся с другого устройства', () => {
    const items = [it_({ id: 'fresh', deleted: true, updatedAt: '2026-07-30T00:00:00Z' })]
    expect(pruneDeleted(items, now)).toHaveLength(1)
  })
  it('живые позиции не трогаются никогда', () => {
    const items = [it_({ id: 'alive', updatedAt: '2020-01-01T00:00:00Z' })]
    expect(pruneDeleted(items, now)).toHaveLength(1)
  })
})
