import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  isSameMonth,
  format,
  subDays,
} from 'date-fns'
import { ru as ruLocale, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Flame } from 'lucide-react'
import { useStore } from '../../store'
import { Button, Card, Empty, IconButton, Modal, PageHeader } from '../../components/ui'
import type { CalendarTask } from '../../types'
import { toISODate, todayISO } from '../../lib/id'

const CELL = 12 // px
const GAP = 3 // px

interface DayCell {
  iso: string
  date: Date
  inYear: boolean
  total: number
  done: number
  level: 0 | 1 | 2 | 3 | 4
}

function levelFor(done: number): DayCell['level'] {
  if (done <= 0) return 0
  if (done === 1) return 1
  if (done === 2) return 2
  if (done === 3) return 3
  return 4
}

function cellColor(level: DayCell['level']): string {
  if (level === 0) return 'var(--bg-3)'
  const pct = [0, 25, 50, 75, 100][level]
  return `color-mix(in srgb, var(--accent) ${pct}%, var(--bg-3))`
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation()
  const tasks = useStore((s) => s.data.calendarTasks)
  const addCalendarTask = useStore((s) => s.addCalendarTask)
  const toggleCalendarTask = useStore((s) => s.toggleCalendarTask)
  const deleteCalendarTask = useStore((s) => s.deleteCalendarTask)

  const locale = i18n.language.startsWith('ru') ? ruLocale : enUS

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // done-count per ISO date (только выполненные задачи участвуют в интенсивности)
  const doneByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const task of tasks) {
      if (task.done) m.set(task.date, (m.get(task.date) ?? 0) + 1)
    }
    return m
  }, [tasks])

  // total-count per ISO date (для тултипа)
  const totalByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const task of tasks) m.set(task.date, (m.get(task.date) ?? 0) + 1)
    return m
  }, [tasks])

  // Сетка недель: от начала недели года (пн) до конца недели последнего дня года.
  const weeks = useMemo<DayCell[][]>(() => {
    const yStart = startOfYear(new Date(year, 0, 1))
    const yEnd = endOfYear(yStart)
    const gridStart = startOfWeek(yStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(yEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

    const cols: DayCell[][] = []
    for (let i = 0; i < days.length; i += 7) {
      const col = days.slice(i, i + 7).map((date): DayCell => {
        const iso = toISODate(date)
        const done = doneByDate.get(iso) ?? 0
        return {
          iso,
          date,
          inYear: date.getFullYear() === year,
          total: totalByDate.get(iso) ?? 0,
          done,
          level: levelFor(done),
        }
      })
      cols.push(col)
    }
    return cols
  }, [year, doneByDate, totalByDate])

  // Подписи месяцев над колонками: показываем имя месяца над первой неделей,
  // которая содержит первый день месяца (в пределах года).
  const monthLabels = useMemo(() => {
    const labels: { col: number; text: string }[] = []
    let lastMonth = -1
    weeks.forEach((col, idx) => {
      const firstInYear = col.find((c) => c.inYear)
      if (!firstInYear) return
      const m = firstInYear.date.getMonth()
      if (m !== lastMonth) {
        // только если в этой колонке реально начинается месяц (есть день <= 7 числа)
        const hasMonthStart = col.some(
          (c) => c.inYear && isSameMonth(c.date, firstInYear.date) && c.date.getDate() <= 7,
        )
        if (hasMonthStart) {
          labels.push({ col: idx, text: format(firstInYear.date, 'LLL', { locale }) })
          lastMonth = m
        }
      }
    })
    return labels
  }, [weeks, locale])

  // Подписи дней недели (пн..вс) — короткие, через date-fns.
  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) =>
      format(eachDayOfInterval({ start: monday, end: endOfWeek(monday, { weekStartsOn: 1 }) })[i], 'EEEEEE', {
        locale,
      }),
    )
  }, [locale])

  // Всего выполнено за год.
  const doneThisYear = useMemo(() => {
    let n = 0
    doneByDate.forEach((count, iso) => {
      if (iso.startsWith(String(year))) n += count
    })
    return n
  }, [doneByDate, year])

  // Текущая серия: дни подряд (заканчивая сегодня) с >=1 выполненной задачей.
  const streak = useMemo(() => {
    let n = 0
    let cursor = new Date()
    // если сегодня пусто — серия 0; считаем назад пока есть выполненные.
    while ((doneByDate.get(toISODate(cursor)) ?? 0) > 0) {
      n += 1
      cursor = subDays(cursor, 1)
    }
    return n
  }, [doneByDate])

  const dayTasks = useMemo<CalendarTask[]>(
    () => (selected ? tasks.filter((x) => x.date === selected) : []),
    [tasks, selected],
  )

  function openDay(iso: string) {
    setSelected(iso)
    setDraft('')
  }

  function handleAdd() {
    const title = draft.trim()
    if (!title || !selected) return
    addCalendarTask(selected, title)
    setDraft('')
  }

  function tooltipFor(c: DayCell): string {
    const dateStr = format(c.date, 'd MMMM yyyy', { locale })
    if (c.total === 0) return `${dateStr} — ${t('calendar.tooltipNone')}`
    return `${dateStr} — ${t('calendar.tooltipTasks', { count: c.total })}, ${t('calendar.tooltipDone', { done: c.done })}`
  }

  const today = todayISO()
  const selectedDone = dayTasks.filter((x) => x.done).length

  return (
    <div>
      <PageHeader title={t('calendar.title')} subtitle={t('calendar.subtitle')} />

      {/* Год + сводка */}
      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton onClick={() => setYear((y) => y - 1)} aria-label={t('calendar.prevYear')}>
              <ChevronLeft size={18} />
            </IconButton>
            <span className="min-w-14 text-center text-lg font-semibold tabular-nums">{year}</span>
            <IconButton onClick={() => setYear((y) => y + 1)} aria-label={t('calendar.nextYear')}>
              <ChevronRight size={18} />
            </IconButton>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
              <Flame size={15} style={{ color: streak > 0 ? 'var(--warning)' : 'var(--text-3)' }} />
              <span className="text-[var(--text-3)]">{t('calendar.streak')}:</span>
              <span className="font-medium text-[var(--text)] tabular-nums">
                {t('calendar.streakDays', { count: streak })}
              </span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[var(--text-3)]">{t('calendar.doneThisYear')}:</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--accent)' }}>
                {doneThisYear}
              </span>
            </div>
          </div>
        </div>

        {/* Граф */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-1">
            {/* подписи месяцев */}
            <div className="flex" style={{ paddingLeft: 22 }}>
              <div className="relative" style={{ height: 14, width: weeks.length * (CELL + GAP) }}>
                {monthLabels.map((m) => (
                  <span
                    key={`${m.col}-${m.text}`}
                    className="absolute text-[10px] text-[var(--text-3)]"
                    style={{ left: m.col * (CELL + GAP) }}
                  >
                    {m.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              {/* дни недели */}
              <div
                className="flex flex-col"
                style={{ gap: GAP, width: 18 }}
              >
                {weekdayLabels.map((w, i) => (
                  <span
                    key={i}
                    className="text-[9px] leading-none text-[var(--text-3)]"
                    style={{ height: CELL, display: 'flex', alignItems: 'center' }}
                  >
                    {i % 2 === 0 ? w : ''}
                  </span>
                ))}
              </div>

              {/* колонки-недели */}
              <div className="flex" style={{ gap: GAP }}>
                {weeks.map((col, ci) => (
                  <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                    {col.map((c) => (
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => c.inYear && openDay(c.iso)}
                        disabled={!c.inYear}
                        title={tooltipFor(c)}
                        aria-label={tooltipFor(c)}
                        className="rounded-[3px] transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-30"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: cellColor(c.level),
                          outline: c.iso === today ? '1.5px solid var(--accent)' : 'none',
                          outlineOffset: c.iso === today ? 1 : 0,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* легенда */}
            <div
              className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-3)]"
              style={{ paddingLeft: 22 }}
            >
              <span>{t('calendar.less')}</span>
              {([0, 1, 2, 3, 4] as DayCell['level'][]).map((lv) => (
                <span
                  key={lv}
                  className="rounded-[3px]"
                  style={{ width: CELL, height: CELL, background: cellColor(lv) }}
                />
              ))}
              <span>{t('calendar.more')}</span>
            </div>
          </div>
        </div>

        {doneThisYear === 0 && (
          <Empty icon={<CalendarDays size={28} />} text={t('calendar.emptyYear')} />
        )}
      </Card>

      {/* Модалка дня */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? format(new Date(`${selected}T00:00:00`), 'd MMMM yyyy', { locale }) : ''}
      >
        <p className="mb-3 text-xs text-[var(--text-3)]">
          {t('calendar.dayTitle')} · {t('calendar.doneCount', { done: selectedDone, total: dayTasks.length })}
        </p>

        {dayTasks.length === 0 ? (
          <p className="mb-3 py-4 text-center text-sm text-[var(--text-3)]">{t('calendar.noTasksDay')}</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {dayTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: 'var(--bg-2)' }}
              >
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleCalendarTask(task.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                  style={{ width: 16 }}
                />
                <span
                  className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}
                  style={{ color: task.done ? 'var(--text-3)' : 'var(--text)' }}
                >
                  {task.title}
                </span>
                <IconButton onClick={() => deleteCalendarTask(task.id)} aria-label={t('calendar.delete')}>
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={t('calendar.addPlaceholder')}
            autoFocus
          />
          <Button onClick={handleAdd} disabled={!draft.trim()} className="shrink-0">
            <Plus size={16} />
            {t('calendar.add')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
