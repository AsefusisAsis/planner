import {
  type ReactNode,
  type ButtonHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react'
import { X, Plus } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useBackCloser } from '../lib/backclose'

// ---------- Button ----------
type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}
export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed'
  const styles: Record<Variant, string> = {
    primary: 'text-white',
    ghost: 'hover:bg-[var(--bg-3)]',
    subtle: 'bg-[var(--bg-3)] hover:opacity-80',
    danger: 'text-white',
  }
  const inline =
    variant === 'primary'
      ? { background: 'var(--accent)' }
      : variant === 'danger'
        ? { background: 'var(--danger)' }
        : undefined
  return <button className={`${base} ${styles[variant]} ${className}`} style={inline} {...rest} />
}

// ---------- IconButton ----------
export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] transition hover:bg-[var(--bg-3)] hover:text-[var(--text)] active:scale-90 ${className}`}
      {...rest}
    />
  )
}

// ---------- Card ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
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

// ---------- Клавиатура (мобильный жест-хелпер) ----------
// поля, вызывающие экранную клавиатуру
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

/** Открыта ли экранная клавиатура — на телефоне прячем нижнюю навигацию
 *  и FAB, иначе они всплывают над клавиатурой посреди экрана. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // натив: честные события клавиатуры. Эвристика по фокусу здесь врёт:
    // системная «назад» прячет клавиатуру, НЕ снимая фокус с поля
    if (Capacitor.isNativePlatform()) {
      const subs = [
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ]
      return () => {
        for (const s of subs) void s.then((h) => h.remove()).catch(() => {})
      }
    }
    // веб: браузер о клавиатуре не сообщает — эвристика по фокусу
    let timer: ReturnType<typeof setTimeout> | null = null
    const onIn = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      if (timer) clearTimeout(timer)
      setOpen(true)
    }
    const onOut = (e: FocusEvent) => {
      if (!summonsKeyboard(e.target)) return
      // задержка, чтобы переход фокуса между полями не дёргал панель
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
      className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white transition active:scale-90 sm:hidden"
      style={{
        background: 'var(--accent)',
        boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 45%, transparent)',
      }}
    >
      <Plus size={26} />
    </button>
  )
}

// ---------- Modal (bottom-sheet на телефоне, окно на десктопе) ----------
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
  // свайп вниз за «ручку» закрывает лист
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  // системная «назад» на Android закрывает лист, а не выходит из приложения
  useBackCloser(open, onClose)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  useEffect(() => {
    if (!open) {
      setDragY(0)
      startY.current = null
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="anim-sheet flex max-h-[88svh] w-full max-w-md flex-col rounded-t-2xl border sm:max-h-[85vh] sm:rounded-2xl"
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
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton onClick={onClose} aria-label="close">
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

// ---------- Field ----------
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">{label}</span>
      {children}
    </label>
  )
}
