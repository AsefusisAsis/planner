// ============================================================
// Локальные уведомления — только в нативном приложении (Capacitor).
// В вебе no-op: там работает Notification API на дашборде.
// Планируем на 7 дней вперёд и пересоздаём весь набор при каждом
// изменении данных (дебаунс), поэтому список всегда актуален.
// ============================================================

import { Capacitor } from '@capacitor/core'
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications'
import type { AppData } from '../types'

/** Стабильный положительный int32 из строкового id (для id уведомления). */
function numId(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h & 0x7fffffff
}

let permissionAsked = false
async function ensurePermission(): Promise<boolean> {
  const st = await LocalNotifications.checkPermissions()
  if (st.display === 'granted') return true
  if (permissionAsked) return false
  permissionAsked = true
  const req = await LocalNotifications.requestPermissions()
  return req.display === 'granted'
}

/** Локальная дата+время из 'YYYY-MM-DD' и 'HH:MM'. */
function atTime(dateISO: string, time = '09:00'): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function buildPlan(data: AppData): LocalNotificationSchema[] {
  const ru = data.settings.language !== 'en'
  const now = new Date()
  const horizon = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const out: LocalNotificationSchema[] = []

  const add = (id: string, title: string, body: string, at: Date) => {
    if (at <= now || at > horizon) return
    out.push({ id: numId(id), title, body, schedule: { at, allowWhileIdle: true } })
  }

  // события календаря: в своё время, «весь день» — в 09:00
  for (const e of data.calendarTasks) {
    if (e.done) continue
    add(
      'cal:' + e.id,
      e.title,
      ru ? 'Событие в календаре' : 'Calendar event',
      atTime(e.date, e.time ?? '09:00'),
    )
  }
  // задачи по дому со сроком — утром в день срока
  for (const t of data.homeTasks) {
    if (t.done || !t.dueDate) continue
    add('task:' + t.id, t.title, ru ? 'Срок задачи сегодня' : 'Task due today', atTime(t.dueDate))
  }
  // повторяющиеся платежи — утром в день начисления (этот или следующий месяц)
  for (const r of data.recurringExpenses) {
    const y = now.getFullYear()
    const m = now.getMonth()
    const thisMonth = new Date(y, m, r.dayOfMonth, 9, 0, 0, 0)
    const next = thisMonth > now ? thisMonth : new Date(y, m + 1, r.dayOfMonth, 9, 0, 0, 0)
    add(
      'rec:' + r.id,
      r.label,
      (ru ? 'Платёж: ' : 'Payment: ') + r.amount + ' ' + r.currency,
      next,
    )
  }
  return out
}

let timer: ReturnType<typeof setTimeout> | null = null

/** Пересоздать запланированные уведомления по текущим данным (дебаунс 3 с). */
export function rescheduleNotifications(data: AppData): void {
  if (!Capacitor.isNativePlatform()) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void (async () => {
      try {
        if (!(await ensurePermission())) return
        const pending = await LocalNotifications.getPending()
        if (pending.notifications.length) await LocalNotifications.cancel(pending)
        const plan = buildPlan(data)
        if (plan.length) await LocalNotifications.schedule({ notifications: plan })
      } catch {
        /* плагин недоступен — работаем без уведомлений */
      }
    })()
  }, 3000)
}
