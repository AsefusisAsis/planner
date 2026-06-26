// Переиспользуемый contribution-heatmap (как в GitHub): год по неделям,
// 7 строк (пн..вс). Интенсивность — по значению counts[ISO].
// Самодостаточный: даты/подписи через date-fns + локаль по lang.

import { useMemo } from 'react'
import {
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  isSameMonth,
  format,
} from 'date-fns'
import { ru as ruLocale, enUS } from 'date-fns/locale'
import { toISODate } from '../lib/id'

const CELL = 12
const GAP = 3

interface Cell {
  iso: string
  date: Date
  inYear: boolean
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

function levelFor(count: number, max: number): Cell['level'] {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const r = count / max
  if (r <= 0.25) return 1
  if (r <= 0.5) return 2
  if (r <= 0.75) return 3
  return 4
}

function color(level: Cell['level'], colorVar: string): string {
  if (level === 0) return 'var(--bg-3)'
  const pct = [0, 25, 50, 75, 100][level]
  return `color-mix(in srgb, ${colorVar} ${pct}%, var(--bg-3))`
}

export function Heatmap({
  counts,
  year,
  lang = 'ru',
  colorVar = 'var(--accent)',
  today,
  tooltip,
}: {
  counts: Record<string, number>
  year: number
  lang?: 'ru' | 'en'
  colorVar?: string
  today?: string
  tooltip?: (iso: string, count: number) => string
}) {
  const locale = lang === 'ru' ? ruLocale : enUS

  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts])

  const weeks = useMemo<Cell[][]>(() => {
    const yStart = startOfYear(new Date(year, 0, 1))
    const yEnd = endOfYear(yStart)
    const gridStart = startOfWeek(yStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(yEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
    const cols: Cell[][] = []
    for (let i = 0; i < days.length; i += 7) {
      cols.push(
        days.slice(i, i + 7).map((date): Cell => {
          const iso = toISODate(date)
          const count = counts[iso] ?? 0
          return {
            iso,
            date,
            inYear: date.getFullYear() === year,
            count,
            level: levelFor(count, max),
          }
        }),
      )
    }
    return cols
  }, [year, counts, max])

  const monthLabels = useMemo(() => {
    const labels: { col: number; text: string }[] = []
    let lastMonth = -1
    weeks.forEach((col, idx) => {
      const first = col.find((c) => c.inYear)
      if (!first) return
      const m = first.date.getMonth()
      if (m !== lastMonth) {
        const hasStart = col.some(
          (c) => c.inYear && isSameMonth(c.date, first.date) && c.date.getDate() <= 7,
        )
        if (hasStart) {
          labels.push({ col: idx, text: format(first.date, 'LLL', { locale }) })
          lastMonth = m
        }
      }
    })
    return labels
  }, [weeks, locale])

  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const week = eachDayOfInterval({ start: monday, end: endOfWeek(monday, { weekStartsOn: 1 }) })
    return week.map((d) => format(d, 'EEEEEE', { locale }))
  }, [locale])

  const tip = (c: Cell) => (tooltip ? tooltip(c.iso, c.count) : `${c.iso}: ${c.count}`)

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
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
          <div className="flex flex-col" style={{ gap: GAP, width: 18 }}>
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

          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((c) => (
                  <div
                    key={c.iso}
                    title={tip(c)}
                    className="rounded-[3px]"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: c.inYear ? color(c.level, colorVar) : 'transparent',
                      outline: today && c.iso === today ? `1.5px solid ${colorVar}` : 'none',
                      outlineOffset: today && c.iso === today ? 1 : 0,
                      opacity: c.inYear ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
