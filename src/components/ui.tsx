import {
  type ReactNode,
  type ButtonHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { X, Plus, Check, Loader2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useBackCloser } from '../lib/backclose'
import { useFocusTrap } from '../lib/focusTrap'
import { tap } from '../lib/haptics'

// ---------- Button ----------
type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
  fullWidth?: boolean
}
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...rest
}: BtnProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm' }
  const styles: Record<Variant, string> = {
    primary: '',
    ghost: 'hover:bg-[var(--bg-3)]',
    subtle: 'bg-[var(--bg-3)] hover:opacity-80',
    danger: '',
  }
  const bg =
    variant === 'primary'
      ? { background: 'var(--accent)', color: 'var(--on-accent)' }
      : variant === 'danger'
        ? { background: 'var(--danger)', color: '#ffffff' }
        : undefined
  return (
    <button
      className={`${base} ${sizes[size]} ${styles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ borderRadius: 'var(--radius-sm)', ...bg }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

// ---------- IconButton ----------
interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** красный оттенок для деструктивных действий (удаление) */
  danger?: boolean
  /** крупная тач-зона 44×44 (WCAG 2.5.5) — для деструктивных/самостоятельных кнопок */
  big?: boolean
}
export function IconButton({ className = '', danger = false, big = false, ...rest }: IconBtnProps) {
  const size = big ? 'h-11 w-11' : 'h-8 w-8'
  const color = danger
    ? 'text-[var(--text-3)] hover:bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] hover:text-[var(--danger-text)]'
    : 'text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)]'
  return (
    <button
      className={`inline-flex ${size} items-center justify-center rounded-lg transition active:scale-90 ${color} ${className}`}
      {...rest}
    />
  )
}

// ---------- Card ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`border p-4 ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}
    >
      {children}
    </div>
  )
}

// ---------- Page header ----------
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--text-2)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------- Empty state ----------
export function Empty({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-[var(--text-3)]">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ---------- Checkbox (единый на всё приложение) ----------
export function Checkbox({
  checked,
  onChange,
  label,
  className = '',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      // визуально 24px, но тач-зона расширена невидимым псевдоэлементом до 44px
      // (WCAG 2.5.5) — раскладка не меняется: подпись рядом инертна, чекбокс —
      // единственная цель нажатия в строках покупок/задач
      className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition active:scale-90 before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] ${className}`}
      style={{
        background: checked ? 'var(--accent)' : 'transparent',
        borderColor: checked ? 'var(--accent)' : 'var(--border)',
      }}
    >
      {checked && <Check size={15} strokeWidth={3} style={{ color: 'var(--on-accent)' }} />}
    </button>
  )
}

// ---------- SegmentedControl (тема/язык/валюта/тип операции…) ----------
export interface Segment<T extends string> {
  value: T
  label?: string
  icon?: ReactNode
}
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Segment<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={boxRef}
      // radiogroup, а не tablist: контрол выбирает значение, панелей-вкладок нет.
      // Roving tabindex: одна остановка Tab на группу, стрелки ходят по сегментам
      role="radiogroup"
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value)
        let next = -1
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = options.length - 1
        if (next < 0 || next === i) return
        e.preventDefault()
        onChange(options[next].value)
        boxRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
      }}
      // визуал (фон/радиус/активное состояние) — в index.css через .seg,
      // характер по темам задаётся там же селекторами [data-palette]
      className={`seg grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              tap()
              onChange(o.value)
            }}
            className="seg__item flex items-center justify-center gap-1.5 text-sm font-medium"
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Клавиатура (мобильный жест-хелпер) ----------
const KEYBOARD_INPUTS = new Set([
  'text', 'number', 'search', 'email', 'tel', 'url', 'password',
  'date', 'time', 'datetime-local', 'month', 'week',
])
function summonsKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') return KEYBOARD_INPUTS.has((el as HTMLInputElement).type)
  return false
}

/** Открыта ли экранная клавиатура — на телефоне прячем нижнюю навигацию/FAB. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // натив: честные события клавиатуры (системная «назад» прячет её без снятия фокуса)
    if (Capacitor.isNativePlatform()) {
      const subs = [
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ]
      return () => {
        for (const s of subs) void s.then((h) => h.remove()).catch(() => {})
      }
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const onIn = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      if (timer) clearTimeout(timer)
      setOpen(true)
    }
    const onOut = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      timer = setTimeout(() => setOpen(false), 150)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      if (timer) clearTimeout(timer)
    }
  }, [])
  return open
}

// ---------- FAB (плавающая кнопка добавления, только мобильный) ----------
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full transition active:scale-90 sm:hidden"
      style={{
        background: 'var(--accent)',
        color: 'var(--on-accent)',
        boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 45%, transparent)',
      }}
    >
      <Plus size={26} />
    </button>
  )
}

// ---------- Modal (bottom-sheet на телефоне, окно на десктопе) ----------
// стек открытых модалок в порядке открытия (аналог backclose для Escape)
const escStack: symbol[] = []
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  const titleId = useId()

  // системная «назад» на Android закрывает лист
  useBackCloser(open, onClose)

  useEffect(() => {
    if (!open) return
    // Escape закрывает только верхнюю модалку: без стека одно нажатие
    // схлопывало вложенные диалоги вместе с формой под ними
    const token = Symbol('modal')
    escStack.push(token)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (escStack[escStack.length - 1] !== token) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      const i = escStack.indexOf(token)
      if (i >= 0) escStack.splice(i, 1)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // блокируем прокрутку фона, пока лист открыт
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // фокус-ловушка вынесена в общий хук — используется также
  // листом «Ещё» (Layout) и модалкой поиска
  useFocusTrap(open, panelRef)

  useEffect(() => {
    if (open) openedAt.current = performance.now()
    else {
      setDragY(0)
      startY.current = null
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      // игнорируем клик по фону в первые 300мс: быстрый двойной тап по FAB
      // (второй тап уже по оверлею) больше не закрывает только что открытый лист
      onClick={() => {
        if (performance.now() - openedAt.current > 300) onClose()
      }}
    >
      <div
        ref={panelRef}
        data-sheet
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="anim-sheet flex max-h-[88svh] w-full max-w-md flex-col rounded-t-2xl border outline-none sm:max-h-[85vh] sm:rounded-2xl"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: startY.current == null && dragY === 0 ? undefined : startY.current == null ? 'transform .2s' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ручка: тянешь вниз — лист закрывается */}
        <div
          className="shrink-0 touch-none cursor-grab px-5 pt-3 pb-1 sm:hidden"
          onTouchStart={(e) => {
            startY.current = e.touches[0].clientY
          }}
          onTouchMove={(e) => {
            if (startY.current != null) {
              setDragY(Math.max(0, e.touches[0].clientY - startY.current))
            }
          }}
          onTouchEnd={() => {
            const y = dragY
            startY.current = null
            if (y > 90) onClose()
            else setDragY(0)
          }}
        >
          <div className="mx-auto h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-3 sm:pt-5">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <IconButton onClick={onClose} aria-label={title}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

// ---------- Field ----------
export function Field({
  label,
  children,
  required = false,
  hint,
  error,
}: {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
  error?: string
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
        {label}
        {required && <span style={{ color: 'var(--danger-text)' }}> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[var(--text-3)]">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs" style={{ color: 'var(--danger-text)' }}>
          {error}
        </span>
      )}
    </label>
  )
}
