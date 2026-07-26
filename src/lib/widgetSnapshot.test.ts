import { describe, it, expect } from 'vitest'
import { buildWidgetSnapshot } from './widgetSnapshot'
import { createEmptyData, type AppData, type HomeTask, type CalendarTask } from '../types'

const TODAY = '2026-07-26'
const YESTERDAY = '2026-07-25'

function task(over: Partial<HomeTask> & { id: string; title: string }): HomeTask {
  return {
    done: false,
    priority: 'medium',
    recurrence: 'none',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
  } as HomeTask
}

function event(over: Partial<CalendarTask> & { id: string; title: string }): CalendarTask {
  return {
    date: TODAY,
    done: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
  } as CalendarTask
}

function data(over: Partial<AppData> = {}): AppData {
  return { ...createEmptyData(), ...over }
}

const PROFILE = {
  sex: 'male' as const,
  age: 30,
  height: 180,
  weight: 80,
  goalWeight: 75,
  activity: 'moderate' as const,
  goal: 'lose' as const,
  pace: 0.5,
  updatedAt: '2026-07-01T00:00:00.000Z',
}

describe('widgetSnapshot / секция «Сегодня»', () => {
  it('пустой день: счётчик 0, строк нет, есть текст пустого состояния', () => {
    const s = buildWidgetSnapshot(data(), TODAY).today
    expect(s.count).toBe(0)
    expect(s.lines).toEqual([])
    expect(s.empty).toBe('На сегодня ничего')
    expect(s.footer).toBe('') // профиля здоровья нет — воду не показываем
  })

  it('порядок: просроченное → события по времени → задачи на сегодня', () => {
    const s = buildWidgetSnapshot(
      data({
        homeTasks: [
          task({ id: 't1', title: 'Сегодняшняя', dueDate: TODAY }),
          task({ id: 't2', title: 'Просроченная', dueDate: YESTERDAY }),
        ],
        calendarTasks: [event({ id: 'e1', title: 'Встреча', time: '10:00' })],
      }),
      TODAY,
    ).today
    expect(s.count).toBe(3)
    expect(s.lines).toEqual([
      { text: 'Просроченная', meta: 'просрочено', tone: 'danger' },
      { text: 'Встреча', meta: '10:00', tone: 'accent' },
      { text: 'Сегодняшняя', meta: '', tone: 'normal' },
    ])
  })

  it('события сортируются по времени, «весь день» — в конец', () => {
    const s = buildWidgetSnapshot(
      data({
        calendarTasks: [
          event({ id: 'e1', title: 'Поздно', time: '18:00' }),
          event({ id: 'e2', title: 'Без времени' }),
          event({ id: 'e3', title: 'Рано', time: '08:00' }),
        ],
      }),
      TODAY,
    ).today
    expect(s.lines.map((l) => [l.text, l.meta])).toEqual([
      ['Рано', '08:00'],
      ['Поздно', '18:00'],
      ['Без времени', 'весь день'],
    ])
  })

  it('лишние дела сворачиваются в «…и ещё N» (N учитывает вытесненную строку)', () => {
    const s = buildWidgetSnapshot(
      data({
        homeTasks: [1, 2, 3, 4, 5].map((n) =>
          task({ id: 't' + n, title: 'Задача ' + n, dueDate: TODAY }),
        ),
      }),
      TODAY,
    ).today
    expect(s.count).toBe(5)
    expect(s.lines.map((l) => l.text)).toEqual(['Задача 1', 'Задача 2', '…и ещё 3'])
    expect(s.lines[2].tone).toBe('muted')
  })

  it('выполненные и чужие дни не попадают в снимок', () => {
    const s = buildWidgetSnapshot(
      data({
        homeTasks: [
          task({ id: 't1', title: 'Готово', dueDate: TODAY, done: true }),
          task({ id: 't2', title: 'Без срока' }),
          task({ id: 't3', title: 'Завтра', dueDate: '2026-07-27' }),
        ],
        calendarTasks: [
          event({ id: 'e1', title: 'Проведено', time: '09:00', done: true }),
          event({ id: 'e2', title: 'Другой день', date: '2026-07-28' }),
        ],
      }),
      TODAY,
    ).today
    expect(s.count).toBe(0)
    expect(s.lines).toEqual([])
  })

  it('вода в подвале при заполненном профиле здоровья (только за сегодня)', () => {
    const s = buildWidgetSnapshot(
      data({
        healthProfile: PROFILE,
        waterLog: [
          { id: 'w1', date: TODAY, ml: 500 },
          { id: 'w2', date: TODAY, ml: 250 },
          { id: 'w3', date: YESTERDAY, ml: 1000 }, // вчерашнее не суммируем
        ],
      }),
      TODAY,
    ).today
    expect(s.footer).toMatch(/^Вода 750 \/ \d+ мл$/)
  })

  it('английская локаль', () => {
    const base = createEmptyData()
    const s = buildWidgetSnapshot(
      {
        ...base,
        settings: { ...base.settings, language: 'en' },
        calendarTasks: [event({ id: 'e1', title: 'Standup' })],
      },
      TODAY,
    ).today
    expect(s.title).toBe('Today')
    expect(s.empty).toBe('Nothing for today')
    expect(s.lines).toEqual([{ text: 'Standup', meta: 'all day', tone: 'accent' }])
  })
})

describe('widgetSnapshot / секция «Вода»', () => {
  it('без профиля здоровья цели нет — показываем только выпитое', () => {
    const s = buildWidgetSnapshot(
      data({ waterLog: [{ id: 'w1', date: TODAY, ml: 300 }] }),
      TODAY,
    ).water
    expect(s.goal).toBe(0)
    expect(s.drunk).toBe(300)
    expect(s.hero).toBe('300')
    expect(s.sub).toBe('мл')
    expect(s.pct).toBe(0)
  })

  it('с профилем считает цель и процент, вчерашнее не учитывает', () => {
    const s = buildWidgetSnapshot(
      data({
        healthProfile: PROFILE,
        waterLog: [
          { id: 'w1', date: TODAY, ml: 800 },
          { id: 'w2', date: YESTERDAY, ml: 5000 },
        ],
      }),
      TODAY,
    ).water
    expect(s.drunk).toBe(800)
    expect(s.goal).toBeGreaterThan(0)
    expect(s.hero).toBe('800')
    expect(s.sub).toBe(`из ${s.goal} мл`)
    expect(s.pct).toBe(Math.round((800 / s.goal) * 100))
  })

  it('процент не выходит за 100 при перевыполнении', () => {
    const s = buildWidgetSnapshot(
      data({ healthProfile: PROFILE, waterLog: [{ id: 'w1', date: TODAY, ml: 99999 }] }),
      TODAY,
    ).water
    expect(s.pct).toBe(100)
  })
})

describe('widgetSnapshot / секция «Цикл»', () => {
  it('трекер выключен — секция помечена как недоступная', () => {
    const s = buildWidgetSnapshot(data(), TODAY).cycle
    expect(s.enabled).toBe(false)
  })

  it('трекер включён, но данных нет — приглашение отметить', () => {
    const base = createEmptyData()
    const s = buildWidgetSnapshot(
      { ...base, settings: { ...base.settings, cycleEnabled: true } },
      TODAY,
    ).cycle
    expect(s.enabled).toBe(true)
    expect(s.hint).toBe('Отметьте менструацию')
    expect(s.dayNumber).toBe('')
    expect(s.phase).toBe('')
  })

  it('по истории считает день цикла, фазу и прогноз', () => {
    const base = createEmptyData()
    // менструации 1-го числа каждого месяца → цикл ~28-31 день
    const starts = ['2026-04-06', '2026-05-04', '2026-06-01', '2026-06-29']
    const cycleLog = starts.flatMap((d, i) =>
      [0, 1, 2].map((k) => {
        const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + k))
        return {
          date: dt.toISOString().slice(0, 10),
          period: true,
          updatedAt: '2026-07-01T00:00:00.000Z',
          id: `c${i}${k}`,
        }
      }),
    )
    const s = buildWidgetSnapshot(
      { ...base, settings: { ...base.settings, cycleEnabled: true }, cycleLog } as AppData,
      TODAY,
    ).cycle
    expect(s.enabled).toBe(true)
    expect(s.dayNumber).toMatch(/^\d+$/)
    expect(s.dayLabel).toBe('день цикла')
    expect(s.phase).not.toBe('')
    expect(s.next).not.toBe('')
  })
})

describe('widgetSnapshot / секция «Покупки»', () => {
  const list = (items: { id: string; name: string; plannedDate?: string; bought?: boolean }[]) => ({
    id: 'l1',
    name: 'Продукты',
    createdAt: '2026-07-01T00:00:00.000Z',
    items: items.map((i) => ({ qty: 1, bought: false, ...i })),
  })

  it('без дат покупок секция пуста', () => {
    const s = buildWidgetSnapshot(
      data({ shoppingLists: [list([{ id: 'i1', name: 'Хлеб' }])] as AppData['shoppingLists'] }),
      TODAY,
    ).shopping
    expect(s.count).toBe(0)
    expect(s.lines).toEqual([])
    expect(s.empty).toBe('Нет запланированных покупок')
  })

  it('ближайшее по дате выше, просроченное первым, купленное скрыто', () => {
    const s = buildWidgetSnapshot(
      data({
        shoppingLists: [
          list([
            { id: 'i1', name: 'Подарок', plannedDate: '2026-07-29' },
            { id: 'i2', name: 'Молоко', plannedDate: TODAY },
            { id: 'i3', name: 'Лампочка', plannedDate: YESTERDAY },
            { id: 'i4', name: 'Куплено', plannedDate: TODAY, bought: true },
          ]),
        ] as AppData['shoppingLists'],
      }),
      TODAY,
    ).shopping
    expect(s.count).toBe(3)
    expect(s.lines).toEqual([
      { text: 'Лампочка', meta: 'просрочено', tone: 'danger' },
      { text: 'Молоко', meta: 'сегодня', tone: 'warning' },
      { text: 'Подарок', meta: 'через 3 дн.', tone: 'muted' },
    ])
  })
})
