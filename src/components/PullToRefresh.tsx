// Pull-to-refresh: мобильный жест «потянуть страницу вниз от верха — обновить».
// Обёртка над контентом страницы; на десктопе (без тача) просто рендерит children.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

/** Порог срабатывания обновления, px. */
const TRIGGER = 70
/** Максимальное смещение индикатора, px. */
const MAX_PULL = 90
/** Стартовая позиция индикатора над контентом (спрятан за шапкой), px. */
const HIDE_Y = -48

const SUPPORTS_TOUCH = typeof window !== 'undefined' && 'ontouchstart' in window

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>
  children: ReactNode
}) {
  const [pull, setPull] = useState(0) // текущее смещение индикатора
  const [refreshing, setRefreshing] = useState(false)
  const [settling, setSettling] = useState(false) // палец отпущен — анимируем возврат
  const rootRef = useRef<HTMLDivElement>(null)
  // refs-зеркала для нативных обработчиков (не пересоздаём слушатели на каждый рендер)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const startY = useRef<number | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const setP = (v: number) => {
      pullRef.current = v
      setPull(v)
    }

    const onStart = (e: TouchEvent) => {
      // жест начинается только от самого верха страницы и не во время обновления
      if (refreshingRef.current || window.scrollY > 0) return
      startY.current = e.touches[0].clientY
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      // движение вверх — обычный скролл, жест не мешает
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) setP(0)
        return
      }
      // тянем вниз от верха: гасим нативный скролл, двигаем индикатор с сопротивлением
      if (e.cancelable) e.preventDefault()
      setSettling(false)
      setP(Math.min(MAX_PULL, dy * 0.5))
    }

    const onEnd = () => {
      if (startY.current == null) return
      startY.current = null
      setSettling(true)
      if (pullRef.current > TRIGGER && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setP(TRIGGER)
        void (async () => {
          try {
            await onRefreshRef.current()
          } catch {
            /* ошибки обновления показывает сам вызывающий (статус синка и т.п.) */
          } finally {
            refreshingRef.current = false
            setRefreshing(false)
            setP(0)
          }
        })()
      } else {
        setP(0)
      }
    }

    // touchmove — non-passive: preventDefault нужен только когда реально тянем
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (!SUPPORTS_TOUCH) return <>{children}</>

  const y = refreshing ? TRIGGER : pull
  return (
    <div ref={rootRef} className="relative">
      {/* индикатор: круг со стрелкой, выезжает из-под шапки по мере вытягивания */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-20 flex h-10 w-10 items-center justify-center rounded-full border"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          boxShadow: '0 4px 14px rgb(0 0 0 / 0.18)',
          opacity: refreshing ? 1 : Math.min(1, y / TRIGGER),
          transform: `translateX(-50%) translateY(${HIDE_Y + y}px)`,
          transition: settling ? 'transform 0.25s ease, opacity 0.25s ease' : 'none',
        }}
      >
        <RefreshCw
          size={18}
          className={refreshing ? 'animate-spin' : undefined}
          style={{
            color: 'var(--accent)',
            // пока тянем — стрелка докручивается с прогрессом (подсказка жеста)
            transform: refreshing ? undefined : `rotate(${y * 2.5}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  )
}
