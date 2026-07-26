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

describe('widgetSnapshot / снимок дня для виджета', () => {
  it('пустой день: счётчик 0, строк нет, есть текст пустого состояния', () => {
    const s = buildWidgetSnapshot(data(), TODAY)
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
    )
    expect(s.count).toBe(3)
    expect(s.lines).toEqual(['! Просроченная', '10:00  Встреча', '• Сегодняшняя'])
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
    )
    expect(s.lines).toEqual(['08:00  Рано', '18:00  Поздно', 'весь день  Без времени'])
  })

  it('лишние дела сворачиваются в «…и ещё N» (N учитывает вытесненную строку)', () => {
    const s = buildWidgetSnapshot(
      data({
        homeTasks: [1, 2, 3, 4, 5].map((n) =>
          task({ id: 't' + n, title: 'Задача ' + n, dueDate: TODAY }),
        ),
      }),
      TODAY,
    )
    expect(s.count).toBe(5)
    expect(s.lines).toHaveLength(3)
    // показаны 2 первые, третья строка заменена сводкой об оставшихся ТРЁХ
    expect(s.lines[0]).toBe('• Задача 1')
    expect(s.lines[1]).toBe('• Задача 2')
    expect(s.lines[2]).toBe('…и ещё 3')
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
    )
    expect(s.count).toBe(0)
    expect(s.lines).toEqual([])
  })

  it('вода в подвале при заполненном профиле здоровья (только за сегодня)', () => {
    const s = buildWidgetSnapshot(
      data({
        healthProfile: {
          sex: 'male',
          age: 30,
          height: 180,
          weight: 80,
          goalWeight: 75,
          activity: 'moderate',
          goal: 'lose',
          pace: 0.5,
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        waterLog: [
          { id: 'w1', date: TODAY, ml: 500 },
          { id: 'w2', date: TODAY, ml: 250 },
          { id: 'w3', date: YESTERDAY, ml: 1000 }, // вчерашнее не суммируем
        ],
      }),
      TODAY,
    )
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
    )
    expect(s.title).toBe('Today')
    expect(s.empty).toBe('Nothing for today')
    expect(s.lines).toEqual(['all day  Standup'])
  })
})
