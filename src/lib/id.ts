/** Короткий уникальный id без внешних зависимостей. */
export function uid(prefix = ''): string {
  const rnd = crypto.getRandomValues(new Uint32Array(2))
  const base = rnd[0].toString(36) + rnd[1].toString(36)
  return prefix ? `${prefix}-${base}` : base
}

/** ISO дата YYYY-MM-DD из объекта Date (локальная зона). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}
