import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  subDays,
  format,
} from 'date-fns'
import { ru as ruLocale, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock, Flame } from 'lucide-react'
import { useStore } from '../../store'
import { Button, IconButton, Modal } from '../../components/ui'
import { Heatmap } from '../../components/Heatmap'
import { toISODate, todayISO } from '../../lib/id'
import type { CalendarTask } from '../../types'

type View = 'month' | 'activity'

function sortEvents(list: CalendarTask[]): CalendarTask[] {
  return [...list].sort((a, b) => {
    if (!a.time && b.time) return -1
    if (a.time && !b.time) return 1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    return 0
  })
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('ru') ? ruLocale : enUS

  const tasks = useStore((s) => s.data.calendarTasks)
  const addCalendarTask = useStore((s) => s.addCalendarTask)
  const toggleCalendarTask = useStore((s) => s.toggleCalendarTask)
  const deleteCalendarTask = useStore((s) => s.deleteCalendarTask)

  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [selected, setSelected] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTime, setDraftTime] = useState('')

  const today = todayISO()

  // события по дате
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarTask[]>()
    for (const task of tasks) {
      const arr = m.get(task.date) ?? []
      arr.push(task)
      m.set(task.date, arr)
    }
    return m
  }, [tasks])

  // сетка месяца
  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
    const out: Date[][] = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7))
    return out
  }, [cursor])

  const weekdays = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: monday, end: endOfWeek(monday, { weekStartsOn: 1 }) }).map((d) =>
      format(d, 'EEEEEE', { locale }),
    )
  }, [locale])

  // activity (heatmap) — по выполненным
  const doneCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const task of tasks) if (task.done) m[task.date] = (m[task.date] ?? 0) + 1
    return m
  }, [tasks])
  const doneThisYear = Object.entries(doneCounts).reduce(
    (n, [iso, c]) => (iso.startsWith(String(year)) ? n + c : n),
    0,
  )
  const streak = useMemo(() => {
    let n = 0
    let cur = new Date()
    while ((doneCounts[toISODate(cur)] ?? 0) > 0) {
      n += 1
      cur = subDays(cur, 1)
    }
    return n
  }, [doneCounts])

  const dayEvents = selected ? sortEvents(byDate.get(selected) ?? []) : []

  function openDay(iso: string) {
    setSelected(iso)
    setDraftTitle('')
    setDraftTime('')
  }
  function handleAdd() {
    const title = draftTitle.trim()
    if (!title || !selected) return
    addCalendarTask(selected, title, draftTime || undefined)
    setDraftTitle('')
    setDraftTime('')
  }

  return (
    <div>
      {/* Шапка: переключатель вида */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('calendar.title')}</h1>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-2)' }}>
          {(['month', 'activity'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={view === v ? { background: 'var(--card)', color: 'var(--text)' } : { color: 'var(--text-2)' }}
            >
              {t(v === 'month' ? 'calendar.viewMonth' : 'calendar.viewActivity')}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <IconButton onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="prev">
                <ChevronLeft size={18} />
              </IconButton>
              <span className="min-w-40 text-center text-lg font-semibold capitalize">
                {format(cursor, 'LLLL yyyy', { locale })}
              </span>
              <IconButton onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="next">
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <Button variant="subtle" onClick={() => setCursor(startOfMonth(new Date()))}>
              {t('calendar.today')}
            </Button>
          </div>

          {/* дни недели */}
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((w, i) => (
              <div key={i} className="pb-1 text-center text-[11px] font-medium uppercase text-[var(--text-3)]">
                {w}
              </div>
            ))}
          </div>

          {/* сетка дней */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day) => {
              const iso = toISODate(day)
              const inMonth = isSameMonth(day, cursor)
              const isToday = iso === today
              const events = sortEvents(byDate.get(iso) ?? [])
              return (
                <button
                  key={iso}
                  onClick={() => openDay(iso)}
                  className="flex min-h-[68px] flex-col gap-0.5 rounded-lg border p-1 text-left transition-colors hover:bg-[var(--bg-3)] sm:min-h-[92px]"
                  style={{
                    background: 'var(--card)',
                    borderColor: isToday ? 'var(--accent)' : 'var(--border)',
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <span
                    className="mb-0.5 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-xs tabular-nums"
                    style={
                      isToday
                        ? { background: 'var(--accent)', color: '#fff', fontWeight: 600 }
                        : { color: 'var(--text-2)' }
                    }
                  >
                    {day.getDate()}
                  </span>
                  {events.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="truncate rounded px-1 text-[10px] leading-tight"
                      style={{
                        background: e.done ? 'transparent' : 'color-mix(in srgb, var(--accent) 18%, transparent)',
                        color: e.done ? 'var(--text-3)' : 'var(--text)',
                        textDecoration: e.done ? 'line-through' : 'none',
                      }}
                    >
                      {e.time ? `${e.time} ` : ''}
                      {e.title}
                    </span>
                  ))}
                  {events.length > 3 && (
                    <span className="px-1 text-[10px] text-[var(--text-3)]">
                      {t('calendar.moreEvents', { count: events.length - 3 })}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <IconButton onClick={() => setYear((y) => y - 1)} aria-label={t('calendar.prevYear')}>
                <ChevronLeft size={18} />
              </IconButton>
              <span className="min-w-14 text-center text-lg font-semibold tabular-nums">{year}</span>
              <IconButton onClick={() => setYear((y) => y + 1)} aria-label={t('calendar.nextYear')}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Flame size={15} style={{ color: streak > 0 ? 'var(--warning)' : 'var(--text-3)' }} />
              <span className="text-[var(--text-3)]">{t('calendar.streak')}:</span>
              <span className="font-medium tabular-nums">{t('calendar.streakDays', { count: streak })}</span>
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <Heatmap
              counts={doneCounts}
              year={year}
              lang={i18n.language.startsWith('ru') ? 'ru' : 'en'}
              today={today}
              tooltip={(iso, c) =>
                `${iso} — ${c > 0 ? t('calendar.tooltipTasks', { count: c }) : t('calendar.tooltipNone')}`
              }
            />
            <p className="mt-2 text-xs text-[var(--text-3)]">
              {t('calendar.doneThisYear')}: <span className="font-medium text-[var(--accent)]">{doneThisYear}</span>
            </p>
          </div>
        </>
      )}

      {/* Модалка дня */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? format(new Date(`${selected}T00:00:00`), 'd MMMM, EEEE', { locale }) : ''}
      >
        {dayEvents.length === 0 ? (
          <p className="mb-3 py-3 text-center text-sm text-[var(--text-3)]">{t('calendar.noEvents')}</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {dayEvents.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: 'var(--bg-2)' }}
              >
                <input
                  type="checkbox"
                  checked={e.done}
                  onChange={() => toggleCalendarTask(e.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                />
                <span
                  className="inline-flex w-14 shrink-0 items-center gap-0.5 text-xs tabular-nums"
                  style={{ color: 'var(--text-3)' }}
                >
                  {e.time ? (
                    <>
                      <Clock size={11} /> {e.time}
                    </>
                  ) : (
                    t('calendar.allDay')
                  )}
                </span>
                <span
                  className={`flex-1 text-sm ${e.done ? 'line-through' : ''}`}
                  style={{ color: e.done ? 'var(--text-3)' : 'var(--text)' }}
                >
                  {e.title}
                </span>
                <IconButton onClick={() => deleteCalendarTask(e.id)} aria-label={t('calendar.delete')}>
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="time"
            value={draftTime}
            onChange={(ev) => setDraftTime(ev.target.value)}
            className="w-28 shrink-0"
            aria-label={t('calendar.time')}
          />
          <input
            value={draftTitle}
            onChange={(ev) => setDraftTitle(ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && handleAdd()}
            placeholder={t('calendar.titlePlaceholder')}
            autoFocus
          />
          <Button onClick={handleAdd} disabled={!draftTitle.trim()} className="shrink-0">
            <Plus size={16} />
          </Button>
        </div>
      </Modal>
    </div>
  )
}
