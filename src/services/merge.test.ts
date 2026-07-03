import { describe, it, expect } from 'vitest'
import { merge3, sameContent } from './merge'
import { createEmptyData } from '../types'
import type { AppData, Expense, ShoppingList, ShoppingItem, HomeTask, TaskStep } from '../types'

const exp = (id: string, note = 'n'): Expense => ({
  id,
  amount: 1,
  currency: 'BYN',
  categoryId: null,
  note,
  date: '2026-01-01',
  createdAt: '',
})
const expAt = (id: string, createdAt: string): Expense => ({ ...exp(id), createdAt })
const withExp = (list: Expense[]): AppData => ({ ...createEmptyData(), expenses: list })

const item = (id: string, name: string, patch: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  name,
  qty: 1,
  bought: false,
  ...patch,
})
const list = (name: string, items: ShoppingItem[]): ShoppingList => ({
  id: 'L1',
  name,
  items,
  createdAt: '2026-01-01T00:00:00Z',
})
const withLists = (lists: ShoppingList[]): AppData => ({
  ...createEmptyData(),
  shoppingLists: lists,
})

const step = (id: string, title: string, done = false): TaskStep => ({ id, title, done })
const task = (steps?: TaskStep[]): HomeTask => ({
  id: 'T1',
  title: 'Уборка',
  done: false,
  priority: 'medium',
  recurrence: 'none',
  createdAt: '2026-01-01T00:00:00Z',
  ...(steps ? { steps } : {}),
})
const withTasks = (tasks: HomeTask[]): AppData => ({ ...createEmptyData(), homeTasks: tasks })

describe('merge3', () => {
  it('сохраняет локальную правку, если remote не менялся', () => {
    const m = merge3(withExp([exp('a', 'old')]), withExp([exp('a', 'new')]), withExp([exp('a', 'old')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('new')
  })

  it('берёт правку remote, если локально не менялось', () => {
    const m = merge3(withExp([exp('a', 'old')]), withExp([exp('a', 'old')]), withExp([exp('a', 'remote')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('remote')
  })

  it('применяет удаление: локально убрали, remote не трогал', () => {
    const m = merge3(withExp([exp('a')]), withExp([]), withExp([exp('a')]))
    expect(m.expenses.length).toBe(0)
  })

  it('объединяет новые записи с обеих сторон', () => {
    const m = merge3(withExp([]), withExp([exp('b')]), withExp([exp('c')]))
    expect(m.expenses.map((e) => e.id).sort()).toEqual(['b', 'c'])
  })

  it('при конфликте (правили обе стороны) побеждает локальная', () => {
    const m = merge3(withExp([exp('a', 'base')]), withExp([exp('a', 'local')]), withExp([exp('a', 'remote')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('local')
  })
})

describe('base=null (первый синк / после переподключения)', () => {
  it('локальные несинхронизированные записи не теряются', () => {
    const m = merge3(null, withExp([exp('loc')]), withExp([exp('rem')]))
    expect(m.expenses.map((e) => e.id).sort()).toEqual(['loc', 'rem'])
  })

  it('при расхождении одной записи побеждает локальная', () => {
    const m = merge3(null, withExp([exp('a', 'local')]), withExp([exp('a', 'remote')]))
    expect(m.expenses.find((e) => e.id === 'a')?.note).toBe('local')
  })

  it('пустой local просто принимает remote', () => {
    const m = merge3(null, createEmptyData(), withExp([exp('rem')]))
    expect(m.expenses.map((e) => e.id)).toEqual(['rem'])
  })
})

describe('вложенный merge: товары списка покупок', () => {
  const base = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко')])])

  it('правки РАЗНЫХ товаров одного списка сливаются с обеих сторон', () => {
    const local = withLists([list('Список', [item('i1', 'Хлеб', { bought: true }), item('i2', 'Молоко')])])
    const remote = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко 2л')])])
    const m = merge3(base, local, remote)
    const items = m.shoppingLists[0].items
    expect(items.find((i) => i.id === 'i1')?.bought).toBe(true)
    expect(items.find((i) => i.id === 'i2')?.name).toBe('Молоко 2л')
  })

  it('переименование списка на одном устройстве + отметка товара на другом — не конфликт', () => {
    const local = withLists([list('Список', [item('i1', 'Хлеб', { bought: true }), item('i2', 'Молоко')])])
    const remote = withLists([list('На дачу', [item('i1', 'Хлеб'), item('i2', 'Молоко')])])
    const m = merge3(base, local, remote)
    expect(m.shoppingLists[0].name).toBe('На дачу')
    expect(m.shoppingLists[0].items.find((i) => i.id === 'i1')?.bought).toBe(true)
  })

  it('добавления с двух устройств объединяются, удаление применяется', () => {
    const local = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко'), item('i3', 'Сыр')])])
    const remote = withLists([list('Список', [item('i2', 'Молоко'), item('i4', 'Яйца')])]) // i1 удалён на remote
    const m = merge3(base, local, remote)
    expect(m.shoppingLists[0].items.map((i) => i.id).sort()).toEqual(['i2', 'i3', 'i4'])
  })

  it('порядок: общие товары в порядке remote, локальные добавления в конец', () => {
    const local = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко'), item('i3', 'Сыр')])])
    const remote = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко'), item('i4', 'Яйца')])])
    const m = merge3(base, local, remote)
    expect(m.shoppingLists[0].items.map((i) => i.id)).toEqual(['i1', 'i2', 'i4', 'i3'])
  })

  it('сходимость: сторона, чьи правки уже влиты, принимает remote без изменений', () => {
    const local = withLists([list('Список', [item('i1', 'Хлеб', { bought: true }), item('i2', 'Молоко')])])
    const remote = withLists([list('Список', [item('i1', 'Хлеб'), item('i2', 'Молоко 2л')])])
    const m1 = merge3(base, local, remote)
    // вторая сторона: её локальное состояние = прежний remote, приходит m1
    const m2 = merge3(base, remote, m1)
    expect(sameContent(m1, m2)).toBe(true)
  })
})

describe('дедупликация офлайн-автоначислений', () => {
  const rec = (id: string, createdAt: string): Expense => ({
    ...exp(id, 'Аренда'),
    createdAt,
    date: '2026-07-05',
    sourceRecurringId: 'rec-1',
  })

  it('два устройства начислили одну трату офлайн — остаётся одна (min createdAt)', () => {
    const base = withExp([])
    const a = rec('exp-a', '2026-07-05T08:00:00Z')
    const b = rec('exp-b', '2026-07-05T09:00:00Z')
    const m = merge3(base, withExp([a]), withExp([b]))
    expect(m.expenses.length).toBe(1)
    expect(m.expenses[0].id).toBe('exp-a')
  })

  it('результат сходится: обе стороны получают одинаковый набор', () => {
    const base = withExp([])
    const a = rec('exp-a', '2026-07-05T08:00:00Z')
    const b = rec('exp-b', '2026-07-05T09:00:00Z')
    const m1 = merge3(base, withExp([a]), withExp([b]))
    const m2 = merge3(base, withExp([b]), withExp([a]))
    expect(sameContent(m1, m2)).toBe(true)
  })

  it('обычные траты и разные месяцы не дедуплицируются', () => {
    const x = { ...exp('x', 'Аренда'), date: '2026-07-05' }
    const y = { ...rec('y', '2026-07-05T08:00:00Z') }
    const z = { ...rec('z', '2026-08-05T08:00:00Z'), date: '2026-08-05' }
    const m = merge3(withExp([]), withExp([x, y]), withExp([z]))
    expect(m.expenses.map((e) => e.id).sort()).toEqual(['x', 'y', 'z'])
  })
})

describe('вложенный merge: шаги задачи', () => {
  it('отметка шага + добавление шага с другого устройства сливаются', () => {
    const base = withTasks([task([step('s1', 'Пропылесосить'), step('s2', 'Помыть пол')])])
    const local = withTasks([task([step('s1', 'Пропылесосить', true), step('s2', 'Помыть пол')])])
    const remote = withTasks([
      task([step('s1', 'Пропылесосить'), step('s2', 'Помыть пол'), step('s3', 'Полить цветы')]),
    ])
    const m = merge3(base, local, remote)
    const steps = m.homeTasks[0].steps ?? []
    expect(steps.find((s) => s.id === 's1')?.done).toBe(true)
    expect(steps.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })

  it('задача без шагов не получает пустой массив steps', () => {
    const base = withTasks([task()])
    const local = withTasks([{ ...task(), done: true }])
    const m = merge3(base, local, withTasks([task()]))
    expect('steps' in m.homeTasks[0]).toBe(false)
    expect(m.homeTasks[0].done).toBe(true)
  })
})

describe('детерминизм и сходимость', () => {
  it('порядок результата не зависит от порядка входа (новые сверху)', () => {
    const a = expAt('a', '2026-01-01T00:00:00Z')
    const b = expAt('b', '2026-01-02T00:00:00Z')
    const c = expAt('c', '2026-01-03T00:00:00Z')
    const m1 = merge3(withExp([]), withExp([a, b, c]), withExp([]))
    const m2 = merge3(withExp([]), withExp([c, a, b]), withExp([]))
    expect(m1.expenses.map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(m1.expenses.map((e) => e.id)).toEqual(m2.expenses.map((e) => e.id))
  })

  it('идемпотентно: повторное слияние не меняет содержимое', () => {
    const d = withExp([expAt('a', '2026-01-01T00:00:00Z'), expAt('b', '2026-01-02T00:00:00Z')])
    const m1 = merge3(d, d, d)
    const m2 = merge3(m1, m1, m1)
    expect(sameContent(m1, m2)).toBe(true)
  })
})

describe('sameContent', () => {
  it('игнорирует updatedAt', () => {
    const a = { ...withExp([exp('x')]), updatedAt: '2026-01-01T00:00:00Z' }
    const b = { ...withExp([exp('x')]), updatedAt: '2030-12-31T00:00:00Z' }
    expect(sameContent(a, b)).toBe(true)
  })
  it('видит разницу в данных', () => {
    expect(sameContent(withExp([exp('x')]), withExp([exp('y')]))).toBe(false)
  })
})
