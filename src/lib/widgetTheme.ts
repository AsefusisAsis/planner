// Живые цвета темы для виджетов рабочего стола.
//
// Виджеты рисует натив, а палитру (классическая/тёплая/спокойная) и режим
// (светлый/тёмный) пользователь выбирает в приложении. Держать копию всех
// шести тем в values/colors.xml — гарантированное расхождение при любой
// правке дизайна, поэтому цвета читаются из тех же CSS-переменных, что
// использует само приложение, и уезжают в снимок. Натив красит по ним в
// рантайме.

/** Цвета, которыми красятся виджеты. Все — «#RRGGBB». */
export interface WidgetTheme {
  card: string
  text: string
  text2: string
  text3: string
  accent: string
  onAccent: string
  danger: string
  warning: string
  success: string
  /** приглушённый фон дорожек/чипов внутри карточки */
  track: string
}

/** Запасные цвета: если CSS ещё не применён (ранний вызов) — классическая тёмная. */
const FALLBACK: WidgetTheme = {
  card: '#18181b',
  text: '#fafafa',
  text2: '#b4b4bd',
  text3: '#8a8a93',
  accent: '#818cf8',
  onAccent: '#1e1b2e',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  track: '#27272a',
}

/** #abc → #aabbcc; всё остальное отдаём как есть (уже #rrggbb). */
function normalizeHex(v: string): string | null {
  const s = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('')
  return null
}

/**
 * Снять текущие цвета темы с <html>. Возвращает запасные, если переменная
 * не hex (например, кто-то задал oklch/цвет-функцию) — натив должен получать
 * только простые цвета, разбирать CSS-функции он не умеет.
 */
export function readWidgetTheme(): WidgetTheme {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return FALLBACK
  const cs = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string): string =>
    normalizeHex(cs.getPropertyValue(name)) ?? fallback
  return {
    card: pick('--card', FALLBACK.card),
    text: pick('--text', FALLBACK.text),
    text2: pick('--text-2', FALLBACK.text2),
    text3: pick('--text-3', FALLBACK.text3),
    accent: pick('--accent', FALLBACK.accent),
    onAccent: pick('--on-accent', FALLBACK.onAccent),
    danger: pick('--danger', FALLBACK.danger),
    warning: pick('--warning', FALLBACK.warning),
    success: pick('--success', FALLBACK.success),
    track: pick('--bg-3', FALLBACK.track),
  }
}
