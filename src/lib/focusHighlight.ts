// Переход «с виджета — к конкретной записи»: страница раздела прокручивается
// к нужному элементу и коротко подсвечивает его (класс .focus-flash в
// index.css). Дашборд передаёт цель через navigate-state, страница читает её
// хуком useFocusTarget и вызывает flashElement.

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Цель перехода: какую запись показать на странице раздела. */
export interface FocusTarget {
  /** id записи (задачи, события, товара) */
  focusId?: string
  /** дата записи 'YYYY-MM-DD' — нужна календарю (какой день открыть) */
  focusDate?: string
  /** id списка — нужен покупкам (какой список сделать активным) */
  focusListId?: string
}

/** Сколько держим кольцо подсветки, мс. */
const FLASH_MS = 1600

/** Таймеры снятия подсветки по элементам — чтобы повторный переход к тому же
 *  элементу продлевал подсветку, а не гасил её раньше времени. */
const timers = new WeakMap<HTMLElement, number>()

/** Пользователь просит меньше движения? */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Прокрутить к элементу и подсветить его кольцом (.focus-flash).
 *
 * Снятие — по таймеру, а не по animationend: в неактивной вкладке анимации не
 * тикают и событие не приходит вовсе, класс бы завис. Подсветка статична (см.
 * index.css), поэтому она одинаково видна и при включённом «меньше движения».
 *
 * Плавную прокрутку тоже гасим сами: параметр behavior в JS имеет приоритет
 * над CSS scroll-behavior, так что глобальный reduced-motion-сброс сюда не
 * дотягивается.
 */
export function flashElement(el: HTMLElement): void {
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  const prev = timers.get(el)
  if (prev !== undefined) clearTimeout(prev)
  el.classList.add('focus-flash')
  timers.set(
    el,
    window.setTimeout(() => {
      el.classList.remove('focus-flash')
      timers.delete(el)
    }, FLASH_MS),
  )
}

/**
 * Забирает цель перехода из navigate-state ОДИН раз и сразу очищает state,
 * чтобы подсветка не повторялась при возврате назад или ре-рендере.
 * Возвращает цель в локальном состоянии страницы — страница сама решает,
 * когда подсветить (например, календарю сперва нужно открыть день).
 */
export function useFocusTarget(): [FocusTarget | null, (v: FocusTarget | null) => void] {
  const location = useLocation()
  const navigate = useNavigate()
  const [target, setTarget] = useState<FocusTarget | null>(null)

  useEffect(() => {
    const st = location.state as FocusTarget | null
    if (!st?.focusId && !st?.focusDate) return
    setTarget(st)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  return [target, setTarget]
}
